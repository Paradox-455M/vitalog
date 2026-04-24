package main

import (
	"context"
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
	"github.com/vitalog/backend/internal/handler"
	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/migrate"
	"github.com/vitalog/backend/internal/repository"
	"github.com/vitalog/backend/internal/service"
	"github.com/vitalog/backend/internal/storage"
	"github.com/vitalog/backend/internal/supabaseauth"
)

func main() {
	_ = godotenv.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

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

	storageClient := storage.NewSupabaseStorage(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)
	analyserSvc := service.NewAnalyserService(cfg.AnalyserURL)

	docRepo := repository.NewDocumentRepository(pool)
	hvRepo := repository.NewHealthValueRepository(pool)
	familyRepo := repository.NewFamilyRepository(pool)
	profileRepo := repository.NewProfileRepository(pool)
	notifRepo := repository.NewNotificationRepository(pool)
	paymentEventRepo := repository.NewPaymentEventRepository(pool)
	accessEventRepo := repository.NewAccessEventRepository(pool)
	authAdmin := supabaseauth.NewAdminClient(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)
	privacyHandler := handler.NewPrivacyHandler(accessEventRepo, docRepo, profileRepo, familyRepo, hvRepo, storageClient, authAdmin)

	docHandler := handler.NewDocumentHandler(ctx, docRepo, hvRepo, profileRepo, familyRepo, notifRepo, storageClient, analyserSvc)
	extractionHandler := handler.NewExtractionHandler(ctx, docRepo, hvRepo, profileRepo, familyRepo, notifRepo, storageClient, analyserSvc)
	dashboardHandler := handler.NewDashboardHandler(docRepo)
	familyHandler := handler.NewFamilyHandler(familyRepo, profileRepo, cfg.FamilyLimitFree, cfg.FamilyLimitPro)
	profileHandler := handler.NewProfileHandler(profileRepo)
	notifHandler := handler.NewNotificationHandler(profileRepo, notifRepo)
	razorpayHandler := handler.NewRazorpayHandler(profileRepo, paymentEventRepo, cfg.RazorpayWebhookSecret)
	subscriptionHandler := handler.NewSubscriptionHandler(paymentEventRepo)
	healthHandler := handler.NewHealthHandler(pool)

	// H2: rate limiter for document uploads (10 uploads per user per hour).
	uploadLimiter := middleware.NewRateLimiter(10)

	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS)          // C2: allowlist-based
	r.Use(middleware.SecurityHeaders) // M7: CSP + X-Frame-Options etc.
	r.Use(chimw.Timeout(60 * time.Second))

	r.Get("/health", healthHandler.Check)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Auth(keyfunc))

		r.Route("/documents", func(r chi.Router) {
			r.Get("/", docHandler.List)
			// /labs must be registered before /{id} so chi doesn't treat "labs" as a UUID.
			r.Get("/labs", docHandler.ListLabs)
			// H2: per-user upload rate limit (key = user UUID from JWT).
			r.With(uploadLimiter.Middleware(func(r *http.Request) string {
				return middleware.GetUserID(r.Context())
			})).Post("/upload", docHandler.Upload)
			r.Get("/{id}", docHandler.Get)
			r.Get("/{id}/signed-url", docHandler.SignedURL)
			r.Delete("/{id}", docHandler.Delete)
			r.Post("/{id}/extract", extractionHandler.Extract)
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

		r.Route("/privacy", func(r chi.Router) {
			r.Post("/access-events", privacyHandler.PostAccessEvent)
			r.Get("/access-events", privacyHandler.ListAccessEvents)
			r.Get("/data-export", privacyHandler.DataExport)
			r.Post("/delete-account", privacyHandler.DeleteAccount)
		})

		r.Get("/subscription/payments", subscriptionHandler.ListPayments)
	})

	r.Post("/api/webhooks/razorpay", razorpayHandler.Handle)

	r.NotFound(jsonNotFound)

	srv := &http.Server{
		Addr:           ":" + cfg.Port,
		Handler:        r,
		ReadTimeout:    60 * time.Second,
		WriteTimeout:   60 * time.Second,
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
func jsonNotFound(w http.ResponseWriter, r *http.Request) {
	slog.Debug("not found", "method", r.Method, "path", r.URL.Path)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": "not found",
		"path":  r.URL.Path,
		"hint":  "Vitalog API: GET /health must return 200. If you see 404 for /api/... paths, a different app may be bound to this port, or the server is an old build — rebuild and run cmd/server; auth routes return 401 without Authorization.",
	})
}
