package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/vitalog/backend/internal/config"
	"github.com/vitalog/backend/internal/crypto"
	"github.com/vitalog/backend/internal/handler"
	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/migrate"
	"github.com/vitalog/backend/internal/observability"
	"github.com/vitalog/backend/internal/repository"
	"github.com/vitalog/backend/internal/service"
	"github.com/vitalog/backend/internal/storage"
	"github.com/vitalog/backend/internal/supabaseauth"
)

func main() {
	_ = godotenv.Load()

	logLevel := slog.LevelInfo
	if env := os.Getenv("ENV"); env == "" || env == "development" {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)
	logHub := observability.NewLogHub(500)
	observability.SetDefaultHub(logHub)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := repository.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	slog.Info("running migrations...")
	if err := migrate.Run(ctx, pool); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations complete")

	slog.Info("building JWT keyfunc") // L3: do not log supabase_url at startup
	keyfunc := middleware.NewKeyfunc(cfg.SupabaseURL, cfg.SupabaseJWTSecret)
	slog.Info("JWT keyfunc ready")

	slog.Info("loading encryption key from vault")
	kek, err := crypto.LoadKEK(ctx, pool, cfg.VaultSecretName)
	if err != nil {
		slog.Error("failed to load KEK from vault", "error", err)
		os.Exit(1)
	}
	cryptoSvc := crypto.NewService(pool, kek)
	slog.Info("encryption service ready")

	// If no callback secret is configured, generate a random one at startup.
	// This is sufficient for local dev where analyser and backend share the same machine.
	callbackSecret := cfg.CallbackSecret
	if callbackSecret == "" {
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			slog.Error("failed to generate callback secret", "error", err)
			os.Exit(1)
		}
		callbackSecret = hex.EncodeToString(buf)
		slog.Info("extraction callback secret auto-generated (set EXTRACTION_CALLBACK_SECRET to pin it)")
	}

	storageClient := storage.NewSupabaseStorage(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)
	analyserSvc := service.NewAnalyserService(cfg.AnalyserURL)

	docRepo := repository.NewDocumentRepository(pool, cryptoSvc)
	hvRepo := repository.NewHealthValueRepository(pool, cryptoSvc)
	familyRepo := repository.NewFamilyRepository(pool, cryptoSvc)
	profileRepo := repository.NewProfileRepository(pool)
	notifRepo := repository.NewNotificationRepository(pool)
	paymentEventRepo := repository.NewPaymentEventRepository(pool)
	accessEventRepo := repository.NewAccessEventRepository(pool)
	authAdmin := supabaseauth.NewAdminClient(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)
	privacyHandler := handler.NewPrivacyHandler(accessEventRepo, docRepo, profileRepo, familyRepo, hvRepo, storageClient, authAdmin)

	docHandler := handler.NewDocumentHandler(ctx, docRepo, hvRepo, profileRepo, familyRepo, notifRepo, storageClient, analyserSvc, cryptoSvc, cfg.CallbackBaseURL, callbackSecret)
	extractionHandler := handler.NewExtractionHandler(ctx, docRepo, hvRepo, profileRepo, familyRepo, notifRepo, storageClient, analyserSvc, cryptoSvc, cfg.CallbackBaseURL, callbackSecret)
	dashboardHandler := handler.NewDashboardHandler(docRepo, familyRepo)
	familyHandler := handler.NewFamilyHandler(familyRepo, profileRepo, cfg.FamilyLimitFree, cfg.FamilyLimitPro)
	profileHandler := handler.NewProfileHandler(profileRepo)
	notifHandler := handler.NewNotificationHandler(profileRepo, notifRepo)
	razorpayHandler := handler.NewRazorpayHandler(profileRepo, paymentEventRepo, cfg.RazorpayWebhookSecret)
	subscriptionHandler := handler.NewSubscriptionHandler(paymentEventRepo, profileRepo, cfg.RazorpayKeyID, cfg.RazorpayKeySecret)
	healthHandler := handler.NewHealthHandler(pool)
	devLogsHandler := handler.NewDevLogsHandler(logHub, cfg.IsDevelopment())

	// H2: rate limiter for document uploads (10 uploads per user per hour).
	uploadLimiter := middleware.NewRateLimiter(10)
	// Stricter rate limiter for sensitive endpoints (3 per user per hour).
	sensitiveLimiter := middleware.NewRateLimiter(3)

	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.RequestLogger(logHub))
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS)            // C2: allowlist-based
	r.Use(middleware.SecurityHeaders) // M7: CSP + X-Frame-Options etc.
	// Note: Timeout is NOT applied globally — the SSE log stream needs no deadline.
	// It is applied per-group below for all non-streaming routes.

	r.Get("/health", healthHandler.Check)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Auth(keyfunc))
		// SSE log stream — no timeout so the connection stays open indefinitely.
		r.Get("/dev/logs/stream", devLogsHandler.Stream)

		// All other API routes get a 60-second request deadline.
		r.Group(func(r chi.Router) {
			r.Use(chimw.Timeout(60 * time.Second))

		r.Route("/documents", func(r chi.Router) {
			r.Get("/", docHandler.List)
			// /labs must be registered before /{id} so chi doesn't treat "labs" as a UUID.
			r.Get("/labs", docHandler.ListLabs)
			// H2: per-user upload rate limit (key = user UUID from JWT).
			r.With(uploadLimiter.Middleware(func(r *http.Request) string {
				return middleware.GetUserID(r.Context())
			})).Post("/upload", docHandler.Upload)
			r.Get("/{id}", docHandler.Get)
			r.Get("/{id}/file", docHandler.DownloadFile)
			r.Delete("/{id}", docHandler.Delete)
			r.With(uploadLimiter.Middleware(func(r *http.Request) string {
				return middleware.GetUserID(r.Context())
			})).Post("/{id}/extract", extractionHandler.Extract)
		})

		r.Get("/dashboard/stats", dashboardHandler.Stats)

		r.Get("/health-values", docHandler.ListHealthValues)
		r.Get("/timeline/{canonical_name}", docHandler.Timeline)

		r.Route("/family", func(r chi.Router) {
			r.Get("/", familyHandler.List)
			r.Post("/", familyHandler.Create)
			r.Put("/{id}", familyHandler.Update)
			r.Delete("/{id}", familyHandler.Delete)
		})

		r.Route("/profile", func(r chi.Router) {
			r.Get("/", profileHandler.Get)
			r.Put("/", profileHandler.Update)
		})

		r.Get("/notification-preferences", notifHandler.GetPreferences)
		r.Put("/notification-preferences", notifHandler.PutPreferences)

		r.Route("/notifications", func(r chi.Router) {
			r.Get("/", notifHandler.List)
			r.Post("/mark-all-read", notifHandler.MarkAllRead)
			r.Patch("/{id}", notifHandler.Patch)
		})

		sensitiveMw := sensitiveLimiter.Middleware(func(r *http.Request) string {
			return middleware.GetUserID(r.Context())
		})
		r.Route("/privacy", func(r chi.Router) {
			r.Post("/access-events", privacyHandler.PostAccessEvent)
			r.Get("/access-events", privacyHandler.ListAccessEvents)
			r.With(sensitiveMw).Get("/data-export", privacyHandler.DataExport)
			r.With(sensitiveMw).Post("/delete-account", privacyHandler.DeleteAccount)
		})

		r.Route("/subscription", func(r chi.Router) {
			r.Get("/payments", subscriptionHandler.ListPayments)
			r.With(sensitiveMw).Post("/create-order", subscriptionHandler.CreateOrder)
		})
		}) // end r.Group (60s timeout)
	})

	r.Post("/api/webhooks/razorpay", razorpayHandler.Handle)

	// Internal endpoint for the analyser's async callback — verified by HMAC token in URL.
	r.Post("/internal/extraction-callback", extractionHandler.HandleCallback)

	r.NotFound(jsonNotFound(cfg))

	srv := &http.Server{
		Addr:           ":" + cfg.Port,
		Handler:        r,
		ReadTimeout:    60 * time.Second,
		WriteTimeout:   6 * time.Minute, // accommodate large data-export responses
		IdleTimeout:    60 * time.Second,
		MaxHeaderBytes: 1 << 20, // H6: 1MB header cap
	}

	go func() {
		slog.Info("server starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	slog.Info("server stopped")
}

// jsonNotFound replaces the default plain-text 404 and helps confirm requests hit *this* API.
// In production, only return the error; in development, include path and hint for debugging.
func jsonNotFound(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slog.Debug("not found", "method", r.Method, "path", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		if cfg.IsDevelopment() {
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "not found",
				"path":  r.URL.Path,
				"hint":  "Vitalog API: GET /health must return 200. If you see 404 for /api/... paths, a different app may be bound to this port, or the server is an old build — rebuild and run cmd/server; auth routes return 401 without Authorization.",
			})
		} else {
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "not found",
			})
		}
	}
}
