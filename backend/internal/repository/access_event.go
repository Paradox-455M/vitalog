package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/model"
)

const accessEventsMaxList = 100

type AccessEventRepository struct {
	pool *pgxpool.Pool
}

func NewAccessEventRepository(pool *pgxpool.Pool) *AccessEventRepository {
	return &AccessEventRepository{pool: pool}
}

func (r *AccessEventRepository) Insert(ctx context.Context, userID uuid.UUID, ipAddress, userAgent *string, eventType string) error {
	if eventType == "" {
		eventType = "sign_in"
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO access_events (user_id, ip_address, user_agent, event_type)
		VALUES ($1, $2, $3, $4)
	`, userID, ipAddress, userAgent, eventType)
	return err
}

func (r *AccessEventRepository) ListRecent(ctx context.Context, userID uuid.UUID, limit int) ([]model.AccessEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > accessEventsMaxList {
		limit = accessEventsMaxList
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, created_at, ip_address, user_agent, event_type
		FROM access_events
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("list access events: %w", err)
	}
	defer rows.Close()

	var out []model.AccessEvent
	for rows.Next() {
		var e model.AccessEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.CreatedAt, &e.IPAddress, &e.UserAgent, &e.EventType); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
