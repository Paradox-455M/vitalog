package handler

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/repository"
)

type DashboardHandler struct {
	docRepo *repository.DocumentRepository
}

func NewDashboardHandler(docRepo *repository.DocumentRepository) *DashboardHandler {
	return &DashboardHandler{docRepo: docRepo}
}

func (h *DashboardHandler) Stats(w http.ResponseWriter, r *http.Request) {
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

	stats, err := h.docRepo.GetDashboardStats(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch stats")
		return
	}

	respondJSON(w, http.StatusOK, stats)
}
