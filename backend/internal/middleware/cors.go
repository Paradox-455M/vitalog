package middleware

import (
	"net/http"
	"os"
	"strings"
)

// CORS sets Access-Control-Allow-Origin to a per-request allowlist check.
// Configure allowed origins via the ALLOWED_ORIGINS env var (comma-separated).
// Defaults to http://localhost:5173 when the env var is unset.
func CORS(next http.Handler) http.Handler {
	allowed := parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-Request-ID")
		w.Header().Set("Access-Control-Max-Age", "3600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func parseAllowedOrigins(raw string) map[string]bool {
	allowed := map[string]bool{}
	for _, o := range strings.Split(raw, ",") {
		if o = strings.TrimSpace(o); o != "" {
			allowed[o] = true
		}
	}
	if len(allowed) == 0 {
		allowed["http://localhost:5173"] = true
		allowed["http://localhost:5174"] = true
	}
	return allowed
}
