package handler

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
)

type NotificationHandler struct {
	profileRepo *repository.ProfileRepository
	notifRepo   *repository.NotificationRepository
}

func NewNotificationHandler(
	profileRepo *repository.ProfileRepository,
	notifRepo *repository.NotificationRepository,
) *NotificationHandler {
	return &NotificationHandler{
		profileRepo: profileRepo,
		notifRepo:   notifRepo,
	}
}

func (h *NotificationHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if err := h.profileRepo.EnsureExists(r.Context(), uid); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to ensure profile")
		return
	}
	raw, err := h.profileRepo.GetNotificationPreferencesJSON(r.Context(), uid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to load preferences")
		return
	}
	prefs, err := model.ParseNotificationPreferences(raw)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "invalid preferences in database")
		return
	}
	respondJSON(w, http.StatusOK, prefs)
}

func (h *NotificationHandler) PutPreferences(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if err := h.profileRepo.EnsureExists(r.Context(), uid); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to ensure profile")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4*1024)
	var body model.NotificationPreferences
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body = model.NormalizeNotificationPreferencesStruct(body)
	if err := h.profileRepo.SetNotificationPreferences(r.Context(), uid, body); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save preferences")
		return
	}
	respondJSON(w, http.StatusOK, body)
}

// --- inbox ---

type notificationItemResponse struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Body       string  `json:"body"`
	Kind       string  `json:"kind"`
	Read       bool    `json:"read"`
	CreatedAt  string  `json:"created_at"`
	Icon       string  `json:"icon"`
	DocumentID *string `json:"document_id,omitempty"`
}

type notificationsListResponse struct {
	Items       []notificationItemResponse `json:"items"`
	NextCursor  *string                    `json:"next_cursor"`
	UnreadCount int                        `json:"unread_count"`
}

func iconForKind(kind string) string {
	switch kind {
	case "new_report":
		return "description"
	case "trend":
		return "trending_down"
	case "family":
		return "family_restroom"
	case "health_tip":
		return "auto_awesome"
	default:
		return "notifications"
	}
}

func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, e := strconv.Atoi(v); e == nil && n > 0 {
			limit = n
		}
	}
	var after *repository.ListCursor
	if c := r.URL.Query().Get("before"); c != "" {
		dec, err := decodeNotificationCursor(c)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid before cursor")
			return
		}
		after = dec
	}
	items, next, err := h.notifRepo.List(r.Context(), uid, limit, after)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list notifications")
		return
	}
	unread, _ := h.notifRepo.UnreadCount(r.Context(), uid)

	out := make([]notificationItemResponse, 0, len(items))
	for _, n := range items {
		var docID *string
		if n.SourceDocumentID != nil {
			s := n.SourceDocumentID.String()
			docID = &s
		}
		out = append(out, notificationItemResponse{
			ID:         n.ID.String(),
			Title:      n.Title,
			Body:       n.Body,
			Kind:       n.Kind,
			Read:       n.ReadAt != nil,
			CreatedAt:  n.CreatedAt.UTC().Format(time.RFC3339),
			Icon:       iconForKind(n.Kind),
			DocumentID: docID,
		})
	}
	var nextStr *string
	if next != nil {
		enc := encodeNotificationCursor(*next)
		nextStr = &enc
	}
	respondJSON(w, http.StatusOK, notificationsListResponse{
		Items:       out,
		NextCursor:  nextStr,
		UnreadCount: unread,
	})
}

func encodeNotificationCursor(c repository.ListCursor) string {
	s := c.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + c.ID.String()
	return base64.RawURLEncoding.EncodeToString([]byte(s))
}

func decodeNotificationCursor(s string) (*repository.ListCursor, error) {
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	parts := strings.SplitN(string(b), "|", 2)
	if len(parts) != 2 {
		return nil, err
	}
	t, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		// try RFC3339
		t, err = time.Parse(time.RFC3339, parts[0])
		if err != nil {
			return nil, err
		}
	}
	id, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, err
	}
	return &repository.ListCursor{CreatedAt: t, ID: id}, nil
}

type patchNotificationBody struct {
	Read *bool `json:"read"`
}

func (h *NotificationHandler) Patch(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	nid, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid notification id")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1*1024)
	var body patchNotificationBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Read == nil || !*body.Read {
		respondError(w, http.StatusBadRequest, "read: true is required")
		return
	}
	if err := h.notifRepo.MarkRead(r.Context(), uid, nid); err != nil {
		if errors.Is(err, repository.ErrNotificationNotFound) {
			respondError(w, http.StatusNotFound, "notification not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update notification")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if err := h.notifRepo.MarkAllRead(r.Context(), uid); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to mark all read")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
