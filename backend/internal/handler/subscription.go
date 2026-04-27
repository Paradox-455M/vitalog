package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
)

type SubscriptionHandler struct {
	paymentRepo       *repository.PaymentEventRepository
	profileRepo       *repository.ProfileRepository
	razorpayKeyID     string
	razorpayKeySecret string
}

func NewSubscriptionHandler(
	paymentRepo *repository.PaymentEventRepository,
	profileRepo *repository.ProfileRepository,
	razorpayKeyID, razorpayKeySecret string,
) *SubscriptionHandler {
	return &SubscriptionHandler{
		paymentRepo:       paymentRepo,
		profileRepo:       profileRepo,
		razorpayKeyID:     razorpayKeyID,
		razorpayKeySecret: razorpayKeySecret,
	}
}

func (h *SubscriptionHandler) ListPayments(w http.ResponseWriter, r *http.Request) {
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

	rows, err := h.paymentRepo.ListByUser(r.Context(), uid, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list payments")
		return
	}
	if rows == nil {
		rows = []model.PaymentEvent{}
	}
	respondJSON(w, http.StatusOK, rows)
}

// CreateOrder creates a Razorpay order (or mock order when no key is configured)
// and returns checkout details for the frontend.
func (h *SubscriptionHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
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

	// Check if already pro
	profile, err := h.profileRepo.GetByID(r.Context(), uid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch profile")
		return
	}
	if profile.Plan == "pro" {
		respondCodedError(w, http.StatusBadRequest, "already_pro", "Already on Pro plan")
		return
	}

	type orderResponse struct {
		OrderID  string `json:"order_id"`
		Amount   int    `json:"amount"`
		Currency string `json:"currency"`
		KeyID    string `json:"key_id"`
		Mock     bool   `json:"mock"`
	}

	// Mock mode: no Razorpay keys configured
	if h.razorpayKeyID == "" {
		mockOrderID := "order_mock_" + uuid.New().String()[:8]

		// Upgrade user to pro immediately in mock mode
		if err := h.profileRepo.UpdatePlan(r.Context(), uid, "pro"); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to upgrade plan")
			return
		}

		// Record mock payment event
		if err := h.paymentRepo.InsertIfNew(r.Context(), uid, mockOrderID, 29900, "INR", "captured"); err != nil {
			slog.Warn("failed to record mock payment event", "error", err)
		}

		respondJSON(w, http.StatusOK, orderResponse{
			OrderID:  mockOrderID,
			Amount:   29900,
			Currency: "INR",
			KeyID:    "rzp_test_mock",
			Mock:     true,
		})
		return
	}

	// Real mode: call Razorpay Orders API
	reqBody, _ := json.Marshal(map[string]interface{}{
		"amount":   29900,
		"currency": "INR",
		"notes": map[string]string{
			"user_id": uid.String(),
		},
	})

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://api.razorpay.com/v1/orders", bytes.NewReader(reqBody))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create order request")
		return
	}
	req.SetBasicAuth(h.razorpayKeyID, h.razorpayKeySecret)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		respondError(w, http.StatusBadGateway, "failed to reach Razorpay")
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		slog.Error("razorpay order creation failed", "status", resp.StatusCode)
		respondError(w, http.StatusBadGateway, fmt.Sprintf("Razorpay error: %d", resp.StatusCode))
		return
	}

	var rzpOrder struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &rzpOrder); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to parse Razorpay response")
		return
	}

	respondJSON(w, http.StatusOK, orderResponse{
		OrderID:  rzpOrder.ID,
		Amount:   29900,
		Currency: "INR",
		KeyID:    h.razorpayKeyID,
		Mock:     false,
	})
}
