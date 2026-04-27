package middleware

import (
	"net/http"
	"sync"
	"time"
)

type bucket struct {
	mu       sync.Mutex
	tokens   float64
	lastFill time.Time
	lastSeen time.Time
}

// RateLimiter is a simple per-key token-bucket limiter (in-process).
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     float64 // tokens refilled per second
	capacity float64
}

// NewRateLimiter returns a limiter allowing requestsPerHour per key.
// A background goroutine evicts idle buckets every 10 minutes to prevent unbounded map growth.
func NewRateLimiter(requestsPerHour int) *RateLimiter {
	rl := &RateLimiter{
		buckets:  make(map[string]*bucket),
		rate:     float64(requestsPerHour) / 3600.0,
		capacity: float64(requestsPerHour),
	}
	go rl.evictLoop()
	return rl
}

// evictLoop removes buckets that have been idle for more than 20 minutes.
func (rl *RateLimiter) evictLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-20 * time.Minute)
		rl.mu.Lock()
		for key, b := range rl.buckets {
			b.mu.Lock()
			idle := b.lastSeen.Before(cutoff)
			b.mu.Unlock()
			if idle {
				delete(rl.buckets, key)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	b, ok := rl.buckets[key]
	if !ok {
		now := time.Now()
		b = &bucket{tokens: rl.capacity, lastFill: now, lastSeen: now}
		rl.buckets[key] = b
	}
	rl.mu.Unlock()

	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(b.lastFill).Seconds()
	b.tokens = min(rl.capacity, b.tokens+elapsed*rl.rate)
	b.lastFill = now
	b.lastSeen = now

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Middleware returns a handler that rate-limits by the key returned by keyFn.
// If keyFn returns "", falls back to the remote address.
func (rl *RateLimiter) Middleware(keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFn(r)
			if key == "" {
				key = r.RemoteAddr
			}
			if !rl.allow(key) {
				http.Error(w, `{"error":"rate limit exceeded, try again later"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
