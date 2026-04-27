package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/vitalog/backend/internal/observability"
)

type DevLogsHandler struct {
	hub         *observability.LogHub
	development bool
}

func NewDevLogsHandler(hub *observability.LogHub, development bool) *DevLogsHandler {
	return &DevLogsHandler{hub: hub, development: development}
}

func (h *DevLogsHandler) Stream(w http.ResponseWriter, r *http.Request) {
	if !h.development {
		http.NotFound(w, r)
		return
	}
	if h.hub == nil {
		respondError(w, http.StatusServiceUnavailable, "log stream unavailable")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		respondError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	events, recent := h.hub.Subscribe(r.Context())
	for _, event := range recent {
		if !writeLogEvent(w, event) {
			return
		}
	}
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			if !writeLogEvent(w, event) {
				return
			}
			flusher.Flush()
		}
	}
}

func writeLogEvent(w http.ResponseWriter, event observability.LogEvent) bool {
	payload, err := json.Marshal(event)
	if err != nil {
		return false
	}
	_, err = fmt.Fprintf(w, "event: log\ndata: %s\n\n", payload)
	return err == nil
}
