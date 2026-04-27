package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/vitalog/backend/internal/observability"
)

func TestDevLogsStreamHiddenOutsideDevelopment(t *testing.T) {
	handler := NewDevLogsHandler(observability.NewLogHub(10), false)

	req := httptest.NewRequest(http.MethodGet, "/api/dev/logs/stream", nil)
	rec := httptest.NewRecorder()

	handler.Stream(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestDevLogsStreamReplaysRecentSafeEvents(t *testing.T) {
	hub := observability.NewLogHub(10)
	hub.Publish("info", "request_completed", map[string]any{"path": "/health"})
	handler := NewDevLogsHandler(hub, true)

	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/api/dev/logs/stream", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		handler.Stream(rec, req)
		close(done)
	}()

	time.Sleep(20 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("stream did not stop after request context cancellation")
	}

	body := rec.Body.String()
	if !strings.Contains(body, "event: log") {
		t.Fatalf("body = %q, want SSE log event", body)
	}
	if !strings.Contains(body, "request_completed") {
		t.Fatalf("body = %q, want recent event message", body)
	}
}
