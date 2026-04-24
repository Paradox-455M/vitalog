package middleware

import "net/http"

// SecurityHeaders adds defensive HTTP headers to every response.
// CSP is scoped to the Vitalog frontend and Supabase endpoints.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		h.Set("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self'; "+
				"connect-src 'self' https://*.supabase.co; "+
				"img-src 'self' data:; "+
				"frame-ancestors 'none'",
		)
		next.ServeHTTP(w, r)
	})
}
