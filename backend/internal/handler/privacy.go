package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
	"github.com/vitalog/backend/internal/storage"
	"github.com/vitalog/backend/internal/supabaseauth"
)

// PrivacyHandler serves data export, access audit, and account deletion.
// v1 data-export is synchronous JSON only (see plan); large accounts may need async jobs later.
type PrivacyHandler struct {
	accessRepo  *repository.AccessEventRepository
	docRepo     *repository.DocumentRepository
	profileRepo *repository.ProfileRepository
	familyRepo  *repository.FamilyRepository
	hvRepo      *repository.HealthValueRepository
	storage     *storage.SupabaseStorage
	authAdmin   *supabaseauth.AdminClient
}

func NewPrivacyHandler(
	accessRepo *repository.AccessEventRepository,
	docRepo *repository.DocumentRepository,
	profileRepo *repository.ProfileRepository,
	familyRepo *repository.FamilyRepository,
	hvRepo *repository.HealthValueRepository,
	storage *storage.SupabaseStorage,
	authAdmin *supabaseauth.AdminClient,
) *PrivacyHandler {
	return &PrivacyHandler{
		accessRepo:  accessRepo,
		docRepo:     docRepo,
		profileRepo: profileRepo,
		familyRepo:  familyRepo,
		hvRepo:      hvRepo,
		storage:     storage,
		authAdmin:   authAdmin,
	}
}

type postAccessEventRequest struct {
	UserAgent *string `json:"user_agent"`
}

func (h *PrivacyHandler) PostAccessEvent(w http.ResponseWriter, r *http.Request) {
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

	r.Body = http.MaxBytesReader(w, r.Body, 4*1024) // 4KB limit
	var body postAccessEventRequest
	_ = json.NewDecoder(r.Body).Decode(&body)

	// chimw.RealIP runs globally; RemoteAddr is the client IP when proxies set X-Forwarded-For / X-Real-IP.
	ip := strings.TrimSpace(r.RemoteAddr)
	var ipPtr *string
	if ip != "" {
		ipPtr = &ip
	}

	if err := h.accessRepo.Insert(r.Context(), uid, ipPtr, body.UserAgent, "sign_in"); err != nil {
		slog.Error("access_events insert", "error", err)
		respondError(w, http.StatusInternalServerError, "failed to record access event")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (h *PrivacyHandler) ListAccessEvents(w http.ResponseWriter, r *http.Request) {
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

	limit := 50
	if q := r.URL.Query().Get("limit"); q != "" {
		if n, err := strconv.Atoi(q); err == nil {
			limit = n
		}
	}

	events, err := h.accessRepo.ListRecent(r.Context(), uid, limit)
	if err != nil {
		slog.Error("access_events list", "error", err)
		respondError(w, http.StatusInternalServerError, "failed to list access events")
		return
	}
	if events == nil {
		events = []model.AccessEvent{}
	}
	respondJSON(w, http.StatusOK, events)
}

type dataExportPayload struct {
	ExportedAt              time.Time            `json:"exported_at"`
	Profile                 *model.Profile       `json:"profile"`
	NotificationPreferences json.RawMessage      `json:"notification_preferences"`
	FamilyMembers           []model.FamilyMember `json:"family_members"`
	Documents               []model.Document     `json:"documents"`
	HealthValues            []model.HealthValue  `json:"health_values"`
	HealthValuesTruncated   bool                 `json:"health_values_truncated,omitempty"`
	Note                    string               `json:"note,omitempty"`
}

func (h *PrivacyHandler) DataExport(w http.ResponseWriter, r *http.Request) {
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

	profile, err := h.profileRepo.GetByID(r.Context(), uid)
	if err != nil {
		respondError(w, http.StatusNotFound, "profile not found")
		return
	}
	prefsJSON, err := h.profileRepo.GetNotificationPreferencesJSON(r.Context(), uid)
	if err != nil {
		prefsJSON = []byte("{}")
	}
	family, err := h.familyRepo.List(r.Context(), uid)
	if err != nil {
		slog.Error("data export family", "error", err)
		respondError(w, http.StatusInternalServerError, "export failed")
		return
	}
	docItems, _, err := h.docRepo.List(r.Context(), uid, &model.DocumentsFilter{Limit: 1000}, h.hvRepo)
	if err != nil {
		slog.Error("data export documents", "error", err)
		respondError(w, http.StatusInternalServerError, "export failed")
		return
	}
	docs := make([]model.Document, len(docItems))
	for i, item := range docItems {
		docs[i] = item.Document
	}
	// Fetch one extra to detect truncation without a separate COUNT query.
	hvs, err := h.hvRepo.ListByUser(r.Context(), uid, &model.HealthValuesFilter{Limit: 1001})
	if err != nil {
		slog.Error("data export health values", "error", err)
		respondError(w, http.StatusInternalServerError, "export failed")
		return
	}
	truncated := len(hvs) > 1000
	if truncated {
		hvs = hvs[:1000]
	}

	payload := dataExportPayload{
		ExportedAt:              time.Now().UTC(),
		Profile:                 profile,
		NotificationPreferences: prefsJSON,
		FamilyMembers:           family,
		Documents:               docs,
		HealthValues:            hvs,
		HealthValuesTruncated:   truncated,
	}
	if truncated {
		payload.Note = "health_values capped at 1000; contact support for a full export"
	}

	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		respondError(w, http.StatusInternalServerError, "export failed")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="vitalog-export.json"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

type deleteAccountRequest struct {
	Confirm string `json:"confirm"`
}

func (h *PrivacyHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
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

	r.Body = http.MaxBytesReader(w, r.Body, 4*1024) // 4KB limit
	var req deleteAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Confirm != "DELETE_MY_ACCOUNT" {
		respondError(w, http.StatusBadRequest, "confirmation must be exactly DELETE_MY_ACCOUNT")
		return
	}

	docItems, _, err := h.docRepo.List(r.Context(), uid, &model.DocumentsFilter{Limit: 1000}, h.hvRepo)
	if err != nil {
		slog.Error("delete account list docs", "error", err)
		respondError(w, http.StatusInternalServerError, "failed to prepare account deletion")
		return
	}

	for _, item := range docItems {
		objectPath := strings.TrimPrefix(item.StoragePath, "documents/")
		if err := h.storage.Delete("documents", objectPath); err != nil {
			slog.Warn("delete account storage object", "path", objectPath, "error", err)
			// continue — idempotent cleanup, object may already be gone
		}
	}

	if err := h.authAdmin.DeleteUser(userID); err != nil {
		slog.Error("delete account auth user", "error", err)
		respondError(w, http.StatusInternalServerError, "failed to delete account")
		return
	}

	respondJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}
