package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/repository"
)

type RazorpayHandler struct {
	profileRepo   *repository.ProfileRepository
	paymentRepo   *repository.PaymentEventRepository
	webhookSecret string
}

func NewRazorpayHandler(
	profileRepo *repository.ProfileRepository,
	paymentRepo *repository.PaymentEventRepository,
	webhookSecret string,
) *RazorpayHandler {
	return &RazorpayHandler{
		profileRepo:   profileRepo,
		paymentRepo:   paymentRepo,
		webhookSecret: webhookSecret,
	}
}

type RazorpayWebhookEvent struct {
	Event     string `json:"event"`
	CreatedAt int64  `json:"created_at"` // Unix seconds sent by Razorpay
	Payload   struct {
		Payment struct {
			Entity struct {
				ID       string            `json:"id"`
				Amount   int               `json:"amount"`
				Currency string            `json:"currency"`
				Status   string            `json:"status"`
				Notes    map[string]string `json:"notes"`
			} `json:"entity"`
		} `json:"payment"`
	} `json:"payload"`
}

func (h *RazorpayHandler) Handle(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024) // 64KB limit for unauthenticated webhook
	body, err := io.ReadAll(r.Body)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	signature := r.Header.Get("X-Razorpay-Signature")
	if signature == "" {
		respondError(w, http.StatusUnauthorized, "missing signature")
		return
	}

	if !h.verifySignature(body, signature) {
		respondError(w, http.StatusUnauthorized, "invalid signature")
		return
	}

	var event RazorpayWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		respondError(w, http.StatusBadRequest, "invalid event payload")
		return
	}

	// Reject stale webhooks (replay protection — H3).
	if event.CreatedAt > 0 {
		if age := time.Since(time.Unix(event.CreatedAt, 0)); age > 5*time.Minute {
			slog.Warn("razorpay webhook: rejected stale event", "age_seconds", int(age.Seconds()))
			respondError(w, http.StatusBadRequest, "stale webhook")
			return
		}
	}

	if event.Event != "payment.captured" {
		respondJSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}

	// Validate that payment amount matches expected Pro plan price (29900 paise = ₹299).
	const expectedAmountPaise = 29900
	if event.Payload.Payment.Entity.Amount != expectedAmountPaise {
		slog.Warn("razorpay webhook: unexpected payment amount", "amount", event.Payload.Payment.Entity.Amount, "expected", expectedAmountPaise)
		respondError(w, http.StatusBadRequest, "unexpected payment amount")
		return
	}

	userIDStr := event.Payload.Payment.Entity.Notes["user_id"]
	if userIDStr == "" {
		slog.Warn("razorpay webhook: missing user_id in notes")
		respondError(w, http.StatusBadRequest, "missing user_id in notes")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		slog.Warn("razorpay webhook: invalid user_id format")
		respondError(w, http.StatusBadRequest, "invalid user_id")
		return
	}

	// Idempotency: skip DB write if already on pro (H3).
	if profile, err := h.profileRepo.GetByID(r.Context(), userID); err == nil && profile.Plan == "pro" {
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}

	if err := h.profileRepo.UpdatePlan(r.Context(), userID, "pro"); err != nil {
		slog.Error("razorpay webhook: failed to update plan", "error", err)
		respondError(w, http.StatusInternalServerError, "failed to update plan")
		return
	}

	ent := event.Payload.Payment.Entity
	if ent.ID != "" {
		currency := ent.Currency
		status := ent.Status
		if status == "" {
			status = "captured"
		}
		if err := h.paymentRepo.InsertIfNew(r.Context(), userID, ent.ID, ent.Amount, currency, status); err != nil {
			slog.Warn("razorpay webhook: failed to record payment event", "error", err, "payment_id", ent.ID)
		}
	} else {
		slog.Warn("razorpay webhook: missing payment id, skipping payment_events row")
	}

	slog.Info("razorpay webhook: user upgraded to pro")
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *RazorpayHandler) verifySignature(body []byte, signature string) bool {
	if h.webhookSecret == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(h.webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(signature))
}
