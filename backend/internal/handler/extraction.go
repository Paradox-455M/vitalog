package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/observability"
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
	callbackBaseURL, callbackSecret string,
) *ExtractionHandler {
	return &ExtractionHandler{
		docRepo: docRepo,
		docH:    NewDocumentHandler(serverCtx, docRepo, hvRepo, profileRepo, familyRepo, notifRepo, storageClient, analyserSvc, cryptoSvc, callbackBaseURL, callbackSecret),
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
		slog.Info("extraction already processing", "doc_id", docID, "user_id", userUUID)
		observability.Publish("info", "extraction_already_processing", map[string]any{
			"doc_id":  docID.String(),
			"user_id": userUUID.String(),
		})
		respondJSON(w, http.StatusAccepted, map[string]string{
			"status":      "processing",
			"document_id": docID.String(),
		})
		return
	}

	slog.Info("extraction queued", "doc_id", docID, "user_id", userUUID)
	observability.Publish("info", "extraction_queued", map[string]any{
		"doc_id":  docID.String(),
		"user_id": userUUID.String(),
	})
	go h.docH.runExtraction(doc)

	respondJSON(w, http.StatusAccepted, map[string]string{
		"status":      "processing",
		"document_id": docID.String(),
	})
}

// callbackPayload mirrors the body the analyser's /api/pipeline-file-async endpoint POSTs
// when processing is complete.
type callbackPayload struct {
	JobID  string              `json:"jobId"`
	OK     bool                `json:"ok"`
	Error  string              `json:"error,omitempty"`
	Layer1 service.PipelineLayer1 `json:"layer1"`
	Layer2 service.PipelineLayer2 `json:"layer2"`
}

// HandleCallback receives the result from the analyser's async pipeline endpoint.
// Route: POST /internal/extraction-callback?doc_id=X&owner_id=Y&token=Z
// The token is an HMAC-SHA256 of "doc_id:owner_id" signed with the callback secret;
// it is embedded in the callback URL by makeCallbackURL and verified here.
func (h *ExtractionHandler) HandleCallback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	docID, err := uuid.Parse(q.Get("doc_id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid doc_id")
		return
	}
	ownerID, err := uuid.Parse(q.Get("owner_id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid owner_id")
		return
	}
	token := q.Get("token")

	// Verify the HMAC token.
	mac := hmac.New(sha256.New, []byte(h.docH.callbackSecret))
	mac.Write([]byte(docID.String() + ":" + ownerID.String()))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(token), []byte(expected)) {
		slog.Warn("extraction_callback: invalid token", "doc_id", docID)
		respondError(w, http.StatusUnauthorized, "invalid callback token")
		return
	}

	var payload callbackPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}

	observability.Publish("info", "analyser_callback_received", map[string]any{
		"doc_id": docID.String(),
		"job_id": payload.JobID,
		"ok":     payload.OK,
	})

	if !payload.OK {
		reason := "analyser_async_failed"
		if payload.Error != "" {
			reason += ": " + payload.Error
		}
		h.docH.markFailed(ownerID, docID, reason)
		respondJSON(w, http.StatusOK, map[string]string{"status": "acknowledged"})
		return
	}

	doc, err := h.docRepo.GetByID(r.Context(), ownerID, docID)
	if err != nil {
		slog.Error("extraction_callback: document not found", "doc_id", docID, "owner_id", ownerID)
		respondError(w, http.StatusNotFound, "document not found")
		return
	}

	result := &service.PipelineResult{
		Layer1: payload.Layer1,
		Layer2: payload.Layer2,
	}

	ctx, cancel := context.WithTimeout(h.docH.serverCtx, 60*time.Second)
	defer cancel()

	h.docH.persistExtractionResult(ctx, doc, result)
	respondJSON(w, http.StatusOK, map[string]string{"status": "processed"})
}
