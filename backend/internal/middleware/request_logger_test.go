package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/vitalog/backend/internal/observability"
)

func TestRequestLoggerPublishesSafeRequestEvents(t *testing.T) {
	hub := observability.NewLogHub(10)
	handler := RequestLogger(hub)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		SetLogUserID(r.Context(), "user-123")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("response body"))
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/documents/upload?token=secret", nil)
	req.Header.Set(middleware.RequestIDHeader, "req-123")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	events := hub.Recent()
	if len(events) != 2 {
		t.Fatalf("len(events) = %d, want 2", len(events))
	}

	completed := events[1]
	if completed.Message != "request_completed" {
		t.Fatalf("Message = %q, want request_completed", completed.Message)
	}
	if completed.Fields["method"] != http.MethodPost {
		t.Fatalf("method = %v, want POST", completed.Fields["method"])
	}
	if completed.Fields["path"] != "/api/documents/upload" {
		t.Fatalf("path = %v, want path without query", completed.Fields["path"])
	}
	if completed.Fields["status"] != http.StatusCreated {
		t.Fatalf("status = %v, want 201", completed.Fields["status"])
	}
	if completed.Fields["user_id"] != "user-123" {
		t.Fatalf("user_id = %v, want user-123", completed.Fields["user_id"])
	}
	if _, ok := completed.Fields["query"]; ok {
		t.Fatal("query field must not be logged")
	}
	if _, ok := completed.Fields["body"]; ok {
		t.Fatal("body field must not be logged")
	}
}
