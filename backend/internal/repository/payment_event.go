package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/model"
)

const paymentEventsMaxList = 50

type PaymentEventRepository struct {
	pool *pgxpool.Pool
}

func NewPaymentEventRepository(pool *pgxpool.Pool) *PaymentEventRepository {
	return &PaymentEventRepository{pool: pool}
}

// InsertIfNew stores a payment row; duplicate razorpay_payment_id is ignored (webhook retries).
func (r *PaymentEventRepository) InsertIfNew(ctx context.Context, userID uuid.UUID, razorpayPaymentID string, amountPaise int, currency, status string) error {
	if currency == "" {
		currency = "INR"
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO payment_events (user_id, razorpay_payment_id, amount_paise, currency, status)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (razorpay_payment_id) DO NOTHING
	`, userID, razorpayPaymentID, amountPaise, currency, status)
	if err != nil {
		return fmt.Errorf("insert payment event: %w", err)
	}
	return nil
}

func (r *PaymentEventRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]model.PaymentEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > paymentEventsMaxList {
		limit = paymentEventsMaxList
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, razorpay_payment_id, amount_paise, currency, status, created_at
		FROM payment_events
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.PaymentEvent
	for rows.Next() {
		var e model.PaymentEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.RazorpayPaymentID, &e.AmountPaise, &e.Currency, &e.Status, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
