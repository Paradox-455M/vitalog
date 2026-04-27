package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
	"github.com/vitalog/backend/internal/service"
	"github.com/vitalog/backend/internal/storage"
)


type ExtractionHandler struct {
	docRepo *repository.DocumentRepository
	docH    *DocumentHandler
}

func NewExtractionHandler(
	serverCtx context.Context,
	docRepo *repository.DocumentRepository,
	hvRepo *repository.HealthValueRepository,
	profileRepo *repository.ProfileRepository,
	familyRepo *repository.FamilyRepository,
	notifRepo *repository.NotificationRepository,
	storageClient *storage.SupabaseStorage,
	analyserSvc *service.AnalyserService,
	cryptoSvc interface {
		Encrypt(ctx context.Context, userID uuid.UUID, plaintext []byte) ([]byte, error)
		Decrypt(ctx context.Context, userID uuid.UUID, ciphertext []byte) ([]byte, error)
	},
) *ExtractionHandler {
	return &ExtractionHandler{
		docRepo: docRepo,
		docH:    NewDocumentHandler(serverCtx, docRepo, hvRepo, profileRepo, familyRepo, notifRepo, storageClient, analyserSvc, cryptoSvc),
	}
}

func (h *ExtractionHandler) Extract(w http.ResponseWriter, r *http.Request) {
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

	docID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid document id")
		return
	}

	doc, err := h.docRepo.GetByID(r.Context(), userUUID, docID)
	if err != nil {
		respondError(w, http.StatusNotFound, "document not found")
		return
	}

	if doc.ExtractionStatus == model.ExtractionStatusProcessing {
		respondJSON(w, http.StatusAccepted, map[string]string{
			"status":      "processing",
			"document_id": docID.String(),
		})
		return
	}

	go h.docH.runExtraction(doc)

	respondJSON(w, http.StatusAccepted, map[string]string{
		"status":      "processing",
		"document_id": docID.String(),
	})
}
