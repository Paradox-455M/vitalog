package handler

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/repository"
)

type DashboardHandler struct {
	docRepo    *repository.DocumentRepository
	familyRepo *repository.FamilyRepository
}

func NewDashboardHandler(docRepo *repository.DocumentRepository, familyRepo *repository.FamilyRepository) *DashboardHandler {
	return &DashboardHandler{docRepo: docRepo, familyRepo: familyRepo}
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

	var familyMemberID *uuid.UUID
	if fmid := r.URL.Query().Get("family_member_id"); fmid != "" {
		parsed, err := uuid.Parse(fmid)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid family_member_id")
			return
		}
		if _, err := h.familyRepo.GetByID(r.Context(), userUUID, parsed); err != nil {
			respondError(w, http.StatusForbidden, "family member not found or not owned by you")
			return
		}
		familyMemberID = &parsed
	}

	stats, err := h.docRepo.GetDashboardStats(r.Context(), userUUID, familyMemberID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch stats")
		return
	}

	respondJSON(w, http.StatusOK, stats)
}
