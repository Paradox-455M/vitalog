package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/vitalog/backend/internal/observability"
)

type logContextKey string

const requestLogContextKey logContextKey = "request_log_fields"

type requestLogFields struct {
	UserID string
}

func RequestLogger(hub *observability.LogHub) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			fields := &requestLogFields{}
			ctx := context.WithValue(r.Context(), requestLogContextKey, fields)
			req := r.WithContext(ctx)

			requestID := chimw.GetReqID(req.Context())
			if requestID == "" {
				requestID = r.Header.Get(chimw.RequestIDHeader)
			}

			startFields := map[string]any{
				"request_id": requestID,
				"method":     r.Method,
				"path":       r.URL.Path,
				"remote_ip":  r.RemoteAddr,
			}
			slog.Info("request_started", slogFields(startFields)...)
			if hub != nil {
				hub.Publish("info", "request_started", startFields)
			}

			ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, req)
			status := ww.Status()
			if status == 0 {
				status = http.StatusOK
			}

			completedFields := map[string]any{
				"request_id":  requestID,
				"method":      r.Method,
				"path":        r.URL.Path,
				"status":      status,
				"bytes":       ww.BytesWritten(),
				"duration_ms": time.Since(start).Milliseconds(),
				"remote_ip":   r.RemoteAddr,
			}
			if fields.UserID != "" {
				completedFields["user_id"] = fields.UserID
			}

			slog.Info("request_completed", slogFields(completedFields)...)
			if hub != nil {
				hub.Publish("info", "request_completed", completedFields)
			}
		})
	}
}

func SetLogUserID(ctx context.Context, userID string) {
	fields, ok := ctx.Value(requestLogContextKey).(*requestLogFields)
	if !ok || fields == nil {
		return
	}
	fields.UserID = userID
}

func slogFields(fields map[string]any) []any {
	args := make([]any, 0, len(fields)*2)
	for key, value := range fields {
		args = append(args, key, value)
	}
	return args
}
