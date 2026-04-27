package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
	"github.com/vitalog/backend/internal/service"
	"github.com/vitalog/backend/internal/storage"
)

// extractionConcurrency is the max number of simultaneous analyser calls (M3).
const extractionConcurrency = 10

// freeTierMaxDocuments is the max non-deleted documents for non-pro plans; keep aligned with frontend FREE_TIER_MAX_DOCUMENTS.
const freeTierMaxDocuments = 3

const errCodeFreeUploadLimit = "free_upload_limit"

var unsafeFilenameChars = regexp.MustCompile(`[^a-zA-Z0-9._\- ]`)

type DocumentHandler struct {
	docRepo       *repository.DocumentRepository
	hvRepo        *repository.HealthValueRepository
	profileRepo   *repository.ProfileRepository
	familyRepo    *repository.FamilyRepository
	notifRepo     *repository.NotificationRepository
	storage       *storage.SupabaseStorage
	analyserSvc   *service.AnalyserService
	extractionSem chan struct{} // bounded goroutine pool for analyser calls
	serverCtx     context.Context
}

func NewDocumentHandler(
	serverCtx context.Context,
	docRepo *repository.DocumentRepository,
	hvRepo *repository.HealthValueRepository,
	profileRepo *repository.ProfileRepository,
	familyRepo *repository.FamilyRepository,
	notifRepo *repository.NotificationRepository,
	storage *storage.SupabaseStorage,
	analyserSvc *service.AnalyserService,
) *DocumentHandler {
	return &DocumentHandler{
		docRepo:       docRepo,
		hvRepo:        hvRepo,
		profileRepo:   profileRepo,
		familyRepo:    familyRepo,
		notifRepo:     notifRepo,
		storage:       storage,
		analyserSvc:   analyserSvc,
		extractionSem: make(chan struct{}, extractionConcurrency),
		serverCtx:     serverCtx,
	}
}

func (h *DocumentHandler) Upload(w http.ResponseWriter, r *http.Request) {
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

	if err := h.profileRepo.EnsureExists(r.Context(), userUUID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to ensure profile")
		return
	}

	profile, err := h.profileRepo.GetByID(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to load profile")
		return
	}
	if profile.Plan != "pro" {
		count, err := h.profileRepo.GetDocumentCount(r.Context(), userUUID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to count documents")
			return
		}
		if count >= freeTierMaxDocuments {
			respondCodedError(w, http.StatusForbidden,
				fmt.Sprintf("Free plan allows up to %d reports. Upgrade to Pro for unlimited uploads.", freeTierMaxDocuments),
				errCodeFreeUploadLimit)
			return
		}
	}

	if err := r.ParseMultipartForm(20 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "file too large or invalid form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	fileData, err := io.ReadAll(file)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	// C4: Validate actual file content against magic bytes before trusting the extension.
	if err := validateMagicBytes(fileData); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	ext := getExtension(header.Filename, contentType)
	fileID := uuid.New()
	storagePath := userID + "/" + fileID.String() + ext

	if err := h.storage.Upload("documents", storagePath, fileData, contentType); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to upload file")
		return
	}

	var familyMemberID *uuid.UUID
	if fmID := r.FormValue("family_member_id"); fmID != "" {
		parsed, err := uuid.Parse(fmID)
		if err == nil {
			familyMemberID = &parsed
		}
	}

	doc := &model.Document{
		OwnerID:        userUUID,
		FamilyMemberID: familyMemberID,
		StoragePath:    "documents/" + storagePath,
		FileName:       sanitizeFilename(header.Filename), // M2: strip unsafe chars
		FileType:       &contentType,
	}

	if err := h.docRepo.Create(r.Context(), doc); err != nil {
		h.storage.Delete("documents", storagePath)
		respondError(w, http.StatusInternalServerError, "failed to create document")
		return
	}

	// Single extraction trigger for this document (clients should not also POST /extract unless retrying).
	go h.runExtraction(doc)

	respondJSON(w, http.StatusCreated, doc)
}

func (h *DocumentHandler) List(w http.ResponseWriter, r *http.Request) {
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

	q := r.URL.Query()
	filter := &model.DocumentsFilter{}

	if fmID := q.Get("family_member_id"); fmID != "" {
		if parsed, err := uuid.Parse(fmID); err == nil {
			filter.FamilyMemberID = &parsed
		}
	}
	if docType := q.Get("document_type"); docType != "" {
		filter.DocumentType = &docType
	}
	if status := q.Get("status"); status != "" {
		filter.Status = &status
	}
	if fromDate := q.Get("from_date"); fromDate != "" {
		if t, err := time.Parse("2006-01-02", fromDate); err == nil {
			filter.FromDate = &t
		}
	}
	if toDate := q.Get("to_date"); toDate != "" {
		if t, err := time.Parse("2006-01-02", toDate); err == nil {
			filter.ToDate = &t
		}
	}
	if search := q.Get("search"); search != "" {
		filter.Search = &search
	}
	if lab := q.Get("lab"); lab != "" {
		filter.LabName = &lab
	}
	if limitStr := q.Get("limit"); limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 {
			filter.Limit = n
		}
	}
	if offsetStr := q.Get("offset"); offsetStr != "" {
		if n, err := strconv.Atoi(offsetStr); err == nil && n >= 0 {
			filter.Offset = n
		}
	}

	items, total, err := h.docRepo.List(r.Context(), userUUID, filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch documents")
		return
	}

	limit := filter.Limit
	if limit == 0 {
		limit = 20
	}
	respondJSON(w, http.StatusOK, model.PaginatedDocuments{
		Items:  items,
		Total:  total,
		Limit:  limit,
		Offset: filter.Offset,
	})
}

func (h *DocumentHandler) ListLabs(w http.ResponseWriter, r *http.Request) {
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

	labs, err := h.docRepo.GetLabNames(r.Context(), userUUID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch lab names")
		return
	}

	respondJSON(w, http.StatusOK, labs)
}

func (h *DocumentHandler) Get(w http.ResponseWriter, r *http.Request) {
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

	healthValues, err := h.hvRepo.GetByDocumentID(r.Context(), docID)
	if err != nil {
		healthValues = []model.HealthValue{}
	}

	result := model.DocumentWithHealthValues{
		Document:     *doc,
		HealthValues: healthValues,
	}

	respondJSON(w, http.StatusOK, result)
}

func (h *DocumentHandler) SignedURL(w http.ResponseWriter, r *http.Request) {
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

	// Validate that storage_path belongs to this user before using it (path traversal guard).
	expectedPrefix := "documents/" + userID + "/"
	if !strings.HasPrefix(doc.StoragePath, expectedPrefix) {
		respondError(w, http.StatusForbidden, "invalid storage path")
		return
	}
	objectPath := strings.TrimPrefix(doc.StoragePath, "documents/")
	signedURL, err := h.storage.CreateSignedURL("documents", objectPath, 3600)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create signed URL")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"signed_url": signedURL})
}

func (h *DocumentHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

	if err := h.docRepo.SoftDelete(r.Context(), userUUID, docID); err != nil {
		respondError(w, http.StatusNotFound, "document not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *DocumentHandler) ListHealthValues(w http.ResponseWriter, r *http.Request) {
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

	filter := &model.HealthValuesFilter{}

	if fmID := r.URL.Query().Get("family_member_id"); fmID != "" {
		parsed, err := uuid.Parse(fmID)
		if err == nil {
			filter.FamilyMemberID = &parsed
		}
	}

	if canonical := r.URL.Query().Get("canonical_name"); canonical != "" {
		filter.CanonicalName = &canonical
	}

	if fromDate := r.URL.Query().Get("from_date"); fromDate != "" {
		if t, err := time.Parse("2006-01-02", fromDate); err == nil {
			filter.FromDate = &t
		}
	}

	if toDate := r.URL.Query().Get("to_date"); toDate != "" {
		if t, err := time.Parse("2006-01-02", toDate); err == nil {
			filter.ToDate = &t
		}
	}

	values, err := h.hvRepo.ListByUser(r.Context(), userUUID, filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch health values")
		return
	}

	if values == nil {
		values = []model.HealthValue{}
	}

	respondJSON(w, http.StatusOK, values)
}

func (h *DocumentHandler) Timeline(w http.ResponseWriter, r *http.Request) {
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

	canonicalName := chi.URLParam(r, "canonical_name")
	if canonicalName == "" {
		respondError(w, http.StatusBadRequest, "missing canonical_name")
		return
	}

	var familyMemberID *uuid.UUID
	if fmID := r.URL.Query().Get("family_member_id"); fmID != "" {
		parsed, err := uuid.Parse(fmID)
		if err == nil {
			familyMemberID = &parsed
		}
	}

	timeline, err := h.hvRepo.GetTimeline(r.Context(), userUUID, canonicalName, familyMemberID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch timeline")
		return
	}

	respondJSON(w, http.StatusOK, timeline)
}

// runExtraction downloads the file, calls the analyser, and persists results.
// Called in a goroutine — all errors are logged, never returned.
func (h *DocumentHandler) runExtraction(doc *model.Document) {
	// M3: Acquire bounded semaphore to cap concurrent analyser calls.
	select {
	case h.extractionSem <- struct{}{}:
	default:
		slog.Warn("extraction: semaphore full, dropping", "doc_id", doc.ID)
		_ = h.docRepo.UpdateStatus(h.serverCtx, doc.OwnerID, doc.ID, model.ExtractionStatusFailed)
		return
	}
	defer func() { <-h.extractionSem }()

	// Derive from serverCtx so in-flight extractions are cancelled on graceful shutdown.
	ctx, cancel := context.WithTimeout(h.serverCtx, 5*time.Minute)
	defer cancel()

	log := slog.With("doc_id", doc.ID)
	log.Info("extraction: starting")

	mimeType := ""
	if doc.FileType != nil {
		mimeType = strings.ToLower(*doc.FileType)
	}
	if strings.Contains(mimeType, "image") {
		log.Warn("extraction: image files are not supported by the text analyser")
		_ = h.docRepo.UpdateStatus(ctx, doc.OwnerID, doc.ID, model.ExtractionStatusFailed)
		return
	}

	objectPath := strings.TrimPrefix(doc.StoragePath, "documents/")
	fileBytes, err := h.storage.Download("documents", objectPath)
	if err != nil {
		log.Error("extraction: download failed", "error", err)
		_ = h.docRepo.UpdateStatus(ctx, doc.OwnerID, doc.ID, model.ExtractionStatusFailed)
		return
	}
	log.Info("extraction: file downloaded", "bytes", len(fileBytes))

	if err := h.docRepo.UpdateStatus(ctx, doc.OwnerID, doc.ID, model.ExtractionStatusProcessing); err != nil {
		log.Error("extraction: failed to set processing status", "error", err)
	}

	result, err := h.analyserSvc.AnalyzeFile(ctx, doc.FileName, fileBytes)
	if err != nil {
		log.Error("extraction: analyser failed", "error", err)
		_ = h.docRepo.UpdateStatus(ctx, doc.OwnerID, doc.ID, model.ExtractionStatusFailed)
		return
	}
	log.Info("extraction: analyser returned", "findings", len(result.Layer2.Findings))

	reportDate := time.Now()
	if result.Layer1.PatientInfo.ReportDate != nil {
		if t, err := time.Parse("2006-01-02", *result.Layer1.PatientInfo.ReportDate); err == nil {
			reportDate = t
		}
	}

	var healthValues []model.HealthValue
	for _, finding := range result.Layer2.Findings {
		if finding.Value == nil {
			continue
		}
		referenceLow, referenceHigh := parseRangeBounds(finding.ReferenceRange)
		isFlagged := finding.Status == "flagged"
		if !isFlagged {
			isFlagged = service.ComputeIsFlagged(*finding.Value, referenceLow, referenceHigh)
		}
		var unit *string
		if finding.Unit != "" {
			unit = &finding.Unit
		}
		healthValues = append(healthValues, model.HealthValue{
			DocumentID:     doc.ID,
			FamilyMemberID: doc.FamilyMemberID,
			CanonicalName:  service.NormalizeCanonicalName(finding.CanonicalName),
			DisplayName:    finding.DisplayName,
			Value:          *finding.Value,
			Unit:           unit,
			ReferenceLow:   referenceLow,
			ReferenceHigh:  referenceHigh,
			IsFlagged:      isFlagged,
			ReportDate:     reportDate,
		})
	}

	// Flag values where the delta vs the previous report exceeds 15% (CLAUDE.md rule #3).
	for i, hv := range healthValues {
		if hv.IsFlagged {
			continue // already flagged by reference range
		}
		prev, ok, err := h.hvRepo.GetPreviousValue(ctx, doc.OwnerID, hv.CanonicalName, hv.FamilyMemberID, reportDate)
		if err == nil && ok && prev != 0 {
			if math.Abs((hv.Value-prev)/prev)*100 > 15 {
				healthValues[i].IsFlagged = true
			}
		}
	}

	if err := h.hvRepo.CreateBatch(ctx, healthValues); err != nil {
		log.Error("extraction: failed to save health values", "error", err)
		_ = h.docRepo.UpdateStatus(ctx, doc.OwnerID, doc.ID, model.ExtractionStatusFailed)
		return
	}

	explanationPayload, _ := json.Marshal(result.Layer2)
	explanation := string(explanationPayload)
	docType := inferDocumentType(result, doc.FileType)
	reportDatePtr := &reportDate

	if err := h.docRepo.UpdateExtraction(ctx, doc.OwnerID, doc.ID, &docType, result.Layer1.PatientInfo.LabName, reportDatePtr, explanation); err != nil {
		log.Error("extraction: failed to update document", "error", err)
		_ = h.docRepo.UpdateStatus(ctx, doc.OwnerID, doc.ID, model.ExtractionStatusFailed)
		return
	}

	h.emitExtractionNotifications(ctx, doc, healthValues, result.Layer1.PatientInfo.LabName)

	log.Info("extraction: complete", "health_values", len(healthValues))
}

// emitExtractionNotifications creates in-app rows according to user notification preferences.
func (h *DocumentHandler) emitExtractionNotifications(
	ctx context.Context,
	doc *model.Document,
	healthValues []model.HealthValue,
	labName *string,
) {
	if h.notifRepo == nil {
		return
	}
	raw, err := h.profileRepo.GetNotificationPreferencesJSON(ctx, doc.OwnerID)
	if err != nil {
		return
	}
	prefs, err := model.ParseNotificationPreferences(raw)
	if err != nil {
		return
	}
	docID := doc.ID
	fileLabel := doc.FileName
	lab := ""
	if labName != nil {
		lab = strings.TrimSpace(*labName)
	}

	var kind, title, body string
	if doc.FamilyMemberID != nil {
		if prefs.FamilyUpdates {
			kind = "family"
			memberName := "a family member"
			if h.familyRepo != nil {
				if m, err := h.familyRepo.GetByID(ctx, doc.OwnerID, *doc.FamilyMemberID); err == nil {
					memberName = m.Name
				}
			}
			title = "New report for " + memberName
			if lab != "" {
				body = fmt.Sprintf("%s is ready. Lab: %s.", fileLabel, lab)
			} else {
				body = fmt.Sprintf("%s is ready to view.", fileLabel)
			}
		} else if prefs.NewReport {
			kind = "new_report"
			title = "Report processed"
			if lab != "" {
				body = fmt.Sprintf("%s from %s is ready to view.", fileLabel, lab)
			} else {
				body = fmt.Sprintf("%s is ready to view.", fileLabel)
			}
		}
	} else if prefs.NewReport {
		kind = "new_report"
		title = "Report processed"
		if lab != "" {
			body = fmt.Sprintf("Your report %s from %s is ready to view.", fileLabel, lab)
		} else {
			body = fmt.Sprintf("Your report %s is ready to view.", fileLabel)
		}
	}
	if kind != "" {
		_ = h.notifRepo.Create(ctx, doc.OwnerID, kind, title, body, &docID, map[string]any{
			"document_id": docID.String(),
		})
	}

	if !prefs.TrendDetected {
		return
	}
	flagged := 0
	for _, hv := range healthValues {
		if hv.IsFlagged {
			flagged++
		}
	}
	if flagged == 0 {
		return
	}
	tTitle := "Markers need attention"
	tBody := fmt.Sprintf("%d value(s) in this report are outside the reference range.", flagged)
	_ = h.notifRepo.Create(ctx, doc.OwnerID, "trend", tTitle, tBody, &docID, map[string]any{
		"document_id":   docID.String(),
		"flagged_count": flagged,
	})
}

// inferDocumentType uses the analyser result to determine document type, falling back to
// MIME-type heuristics. Images without analyser context are classified as scans.
func inferDocumentType(result *service.PipelineResult, fileType *string) string {
	if result != nil {
		summary := strings.ToLower(result.Layer2.Summary)
		for _, kw := range []string{"scan", "x-ray", "xray", "mri", "ct scan", "ultrasound", "sonography"} {
			if strings.Contains(summary, kw) {
				return "scan"
			}
		}
		for _, kw := range []string{"prescription", "rx ", "tablet", "capsule", "syrup", "dosage"} {
			if strings.Contains(summary, kw) {
				return "prescription"
			}
		}
		// Any findings with recognised blood-test canonical names → blood_test
		if len(result.Layer2.Findings) > 0 {
			return "blood_test"
		}
	}

	if fileType == nil {
		return "other"
	}
	ft := strings.ToLower(*fileType)
	if strings.Contains(ft, "image") {
		return "scan"
	}
	if strings.Contains(ft, "pdf") {
		return "blood_test"
	}
	return "other"
}

func parseRangeBounds(rangeStr *string) (*float64, *float64) {
	if rangeStr == nil || strings.TrimSpace(*rangeStr) == "" {
		return nil, nil
	}
	s := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(*rangeStr), "–", "-"), "—", "-")

	var low, high float64
	if _, err := fmt.Sscanf(s, "%f-%f", &low, &high); err == nil {
		return &low, &high
	}
	if strings.HasPrefix(s, "<") {
		if _, err := fmt.Sscanf(strings.TrimPrefix(s, "<"), "%f", &high); err == nil {
			return nil, &high
		}
	}
	if strings.HasPrefix(s, ">") {
		if _, err := fmt.Sscanf(strings.TrimPrefix(s, ">"), "%f", &low); err == nil {
			return &low, nil
		}
	}
	return nil, nil
}

// validateMagicBytes checks the first bytes of the file against known signatures.
// Rejects files that don't match PDF, JPEG, PNG, or WebP magic bytes (C4).
func validateMagicBytes(data []byte) error {
	if len(data) < 4 {
		return fmt.Errorf("file too small")
	}
	switch {
	case bytes.HasPrefix(data, []byte("%PDF")):
		return nil
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}):
		return nil // JPEG
	case bytes.HasPrefix(data, []byte{0x89, 'P', 'N', 'G'}):
		return nil // PNG
	case bytes.HasPrefix(data, []byte("RIFF")) && len(data) >= 12 && bytes.Equal(data[8:12], []byte("WEBP")):
		return nil // WebP
	}
	return fmt.Errorf("unsupported file type: only PDF, JPEG, PNG, and WebP are accepted")
}

// sanitizeFilename strips characters that could cause XSS or path issues (M2).
func sanitizeFilename(name string) string {
	safe := unsafeFilenameChars.ReplaceAllString(name, "_")
	if len(safe) > 255 {
		safe = safe[:255]
	}
	if safe == "" {
		safe = "upload"
	}
	return safe
}

func getExtension(filename, contentType string) string {
	if idx := strings.LastIndex(filename, "."); idx >= 0 {
		return filename[idx:]
	}

	switch contentType {
	case "application/pdf":
		return ".pdf"
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	default:
		return ""
	}
}
