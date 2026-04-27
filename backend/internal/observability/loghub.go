package observability

import (
	"context"
	"sync"
	"time"
)

var defaultHubMu sync.RWMutex
var defaultHub *LogHub

type LogEvent struct {
	ID      int64          `json:"id"`
	Time    time.Time      `json:"time"`
	Level   string         `json:"level"`
	Message string         `json:"message"`
	Fields  map[string]any `json:"fields,omitempty"`
}

func SetDefaultHub(hub *LogHub) {
	defaultHubMu.Lock()
	defer defaultHubMu.Unlock()
	defaultHub = hub
}

func Publish(level, message string, fields map[string]any) {
	defaultHubMu.RLock()
	hub := defaultHub
	defaultHubMu.RUnlock()
	if hub == nil {
		return
	}
	hub.Publish(level, message, fields)
}

type LogHub struct {
	mu          sync.RWMutex
	capacity    int
	nextID      int64
	recent      []LogEvent
	subscribers map[chan LogEvent]struct{}
}

func NewLogHub(capacity int) *LogHub {
	if capacity <= 0 {
		capacity = 200
	}
	return &LogHub{
		capacity:    capacity,
		subscribers: make(map[chan LogEvent]struct{}),
	}
}

func (h *LogHub) Publish(level, message string, fields map[string]any) LogEvent {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.nextID++
	event := LogEvent{
		ID:      h.nextID,
		Time:    time.Now().UTC(),
		Level:   level,
		Message: message,
		Fields:  copyFields(fields),
	}

	h.recent = append(h.recent, event)
	if len(h.recent) > h.capacity {
		h.recent = h.recent[len(h.recent)-h.capacity:]
	}

	for ch := range h.subscribers {
		select {
		case ch <- event:
		default:
		}
	}

	return event
}

func (h *LogHub) Recent() []LogEvent {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return append([]LogEvent(nil), h.recent...)
}

func (h *LogHub) Subscribe(ctx context.Context) (<-chan LogEvent, []LogEvent) {
	ch := make(chan LogEvent, 64)

	h.mu.Lock()
	recent := append([]LogEvent(nil), h.recent...)
	h.subscribers[ch] = struct{}{}
	h.mu.Unlock()

	go func() {
		<-ctx.Done()
		h.mu.Lock()
		delete(h.subscribers, ch)
		close(ch)
		h.mu.Unlock()
	}()

	return ch, recent
}

func copyFields(fields map[string]any) map[string]any {
	if len(fields) == 0 {
		return nil
	}
	copied := make(map[string]any, len(fields))
	for key, value := range fields {
		copied[key] = value
	}
	return copied
}
