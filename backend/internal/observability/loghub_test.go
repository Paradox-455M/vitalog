package observability

import (
	"context"
	"testing"
	"time"
)

func TestHubKeepsBoundedRecentEvents(t *testing.T) {
	hub := NewLogHub(2)

	hub.Publish("info", "first", nil)
	hub.Publish("info", "second", nil)
	hub.Publish("info", "third", nil)

	recent := hub.Recent()
	if len(recent) != 2 {
		t.Fatalf("len(recent) = %d, want 2", len(recent))
	}
	if recent[0].Message != "second" || recent[1].Message != "third" {
		t.Fatalf("recent = %#v, want second and third", recent)
	}
}

func TestHubSubscribeReturnsRecentAndLiveEvents(t *testing.T) {
	hub := NewLogHub(10)
	hub.Publish("info", "before-subscribe", map[string]any{"path": "/health"})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch, recent := hub.Subscribe(ctx)
	if len(recent) != 1 || recent[0].Message != "before-subscribe" {
		t.Fatalf("recent = %#v, want pre-subscribe event", recent)
	}

	hub.Publish("info", "after-subscribe", nil)

	select {
	case event := <-ch:
		if event.Message != "after-subscribe" {
			t.Fatalf("event.Message = %q, want after-subscribe", event.Message)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for live event")
	}
}
