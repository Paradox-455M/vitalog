package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
)

type ProfileHandler struct {
	repo *repository.ProfileRepository
}

func NewProfileHandler(repo *repository.ProfileRepository) *ProfileHandler {
	return &ProfileHandler{repo: repo}
}

type ProfileResponse struct {
	model.Profile
	DocumentCount int `json:"document_count"`
}

func (h *ProfileHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	profile, err := h.repo.GetByID(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusNotFound, "profile not found")
		return
	}

	docCount, err := h.repo.GetDocumentCount(r.Context(), userUUID)
	if err != nil {
		docCount = 0
	}

	resp := ProfileResponse{
		Profile:       *profile,
		DocumentCount: docCount,
	}

	respondJSON(w, http.StatusOK, resp)
}

func (h *ProfileHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 4*1024)
	var req model.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.FullName != nil {
		if len(*req.FullName) > 255 {
			respondError(w, http.StatusBadRequest, "full_name must be 255 characters or fewer")
			return
		}
	}
	if req.AvatarURL != nil {
		u := *req.AvatarURL
		if len(u) > 2048 {
			respondError(w, http.StatusBadRequest, "avatar_url must be 2048 characters or fewer")
			return
		}
		if u != "" && !strings.HasPrefix(u, "https://") && !strings.HasPrefix(u, "http://") {
			respondError(w, http.StatusBadRequest, "avatar_url must be an http or https URL")
			return
		}
	}

	if err := h.repo.Update(r.Context(), userUUID, req.FullName, req.AvatarURL); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	profile, err := h.repo.GetByID(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch updated profile")
		return
	}

	respondJSON(w, http.StatusOK, profile)
}
