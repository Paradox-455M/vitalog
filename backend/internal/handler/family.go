package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
)

type FamilyHandler struct {
	repo            *repository.FamilyRepository
	profileRepo     *repository.ProfileRepository
	limitFree       int
	limitPro        int
}

func NewFamilyHandler(repo *repository.FamilyRepository, profileRepo *repository.ProfileRepository, limitFree, limitPro int) *FamilyHandler {
	return &FamilyHandler{repo: repo, profileRepo: profileRepo, limitFree: limitFree, limitPro: limitPro}
}

func (h *FamilyHandler) List(w http.ResponseWriter, r *http.Request) {
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

	members, err := h.repo.List(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch family members")
		return
	}

	if members == nil {
		members = []model.FamilyMember{}
	}

	respondJSON(w, http.StatusOK, members)
}

func (h *FamilyHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateFamilyMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required")
		return
	}

	profile, err := h.profileRepo.GetByID(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to load profile")
		return
	}
	maxMembers := h.limitFree
	if profile.Plan == "pro" {
		maxMembers = h.limitPro
	}
	n, err := h.repo.Count(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to check family member limit")
		return
	}
	if n >= maxMembers {
		respondError(w, http.StatusForbidden, "family member limit reached")
		return
	}

	var dob *time.Time
	if req.DateOfBirth != nil {
		t, err := time.Parse("2006-01-02", *req.DateOfBirth)
		if err == nil {
			dob = &t
		}
	}

	member := &model.FamilyMember{
		OwnerID:      userUUID,
		Name:         req.Name,
		Relationship: req.Relationship,
		DateOfBirth:  dob,
	}

	if err := h.repo.Create(r.Context(), member); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create family member")
		return
	}

	respondJSON(w, http.StatusCreated, member)
}

func (h *FamilyHandler) Update(w http.ResponseWriter, r *http.Request) {
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

	memberID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid member id")
		return
	}

	var req model.UpdateFamilyMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var dob *time.Time
	if req.DateOfBirth != nil {
		t, err := time.Parse("2006-01-02", *req.DateOfBirth)
		if err == nil {
			dob = &t
		}
	}

	if err := h.repo.Update(r.Context(), userUUID, memberID, req.Name, req.Relationship, dob); err != nil {
		respondError(w, http.StatusNotFound, "family member not found")
		return
	}

	member, err := h.repo.GetByID(r.Context(), userUUID, memberID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch updated member")
		return
	}

	respondJSON(w, http.StatusOK, member)
}

func (h *FamilyHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

	memberID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid member id")
		return
	}

	if err := h.repo.Delete(r.Context(), userUUID, memberID); err != nil {
		respondError(w, http.StatusNotFound, "family member not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}
