package handler

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/vitalog/backend/internal/middleware"
	"github.com/vitalog/backend/internal/model"
	"github.com/vitalog/backend/internal/repository"
)

type SubscriptionHandler struct {
	paymentRepo *repository.PaymentEventRepository
}

func NewSubscriptionHandler(paymentRepo *repository.PaymentEventRepository) *SubscriptionHandler {
	return &SubscriptionHandler{paymentRepo: paymentRepo}
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
