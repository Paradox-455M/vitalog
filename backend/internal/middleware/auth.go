package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "user_id"

type SupabaseClaims struct {
	jwt.RegisteredClaims
	Email string `json:"email"`
	Role  string `json:"role"`
}

func Auth(keyfunc jwt.Keyfunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error": "missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, `{"error": "invalid authorization header format"}`, http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			token, err := jwt.ParseWithClaims(tokenString, &SupabaseClaims{}, keyfunc)
			if err != nil || !token.Valid {
				slog.Warn("auth: token validation failed", "error", err)
				http.Error(w, `{"error": "invalid token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(*SupabaseClaims)
			if !ok {
				http.Error(w, `{"error": "invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			userID := claims.Subject
			if userID == "" {
				http.Error(w, `{"error": "missing user id in token"}`, http.StatusUnauthorized)
				return
			}

			SetLogUserID(r.Context(), userID)
			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) string {
	if userID, ok := ctx.Value(UserIDKey).(string); ok {
		return userID
	}
	return ""
}
