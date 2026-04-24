package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/model"
)

// ErrNotificationNotFound is returned when a notification id does not exist for the owner.
var ErrNotificationNotFound = errors.New("notification not found")

type NotificationRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{pool: pool}
}

// Create inserts a notification; duplicates (same owner, document, kind) are ignored via ON CONFLICT.
func (r *NotificationRepository) Create(
	ctx context.Context,
	ownerID uuid.UUID,
	kind, title, body string,
	sourceDocumentID *uuid.UUID,
	metadata map[string]any,
) error {
	var metaBytes []byte
	if len(metadata) > 0 {
		b, err := json.Marshal(metadata)
		if err != nil {
			return err
		}
		metaBytes = b
	}

	if sourceDocumentID != nil {
		var returnedID uuid.UUID
		err := r.pool.QueryRow(ctx, `
			INSERT INTO in_app_notifications (owner_id, kind, title, body, source_document_id, metadata)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb)
			ON CONFLICT (owner_id, source_document_id, kind)
			WHERE source_document_id IS NOT NULL
			DO NOTHING
			RETURNING id
		`, ownerID, kind, title, body, *sourceDocumentID, metaBytes).Scan(&returnedID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil
			}
			return err
		}
		return nil
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO in_app_notifications (owner_id, kind, title, body, source_document_id, metadata)
		VALUES ($1, $2, $3, $4, NULL, $5::jsonb)
	`, ownerID, kind, title, body, metaBytes)
	return err
}

// ListCursor is (created_at DESC, id DESC) keyset pagination.
type ListCursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
}

// List returns up to `limit` notifications for the owner, newest first, and a cursor for the next page if any.
func (r *NotificationRepository) List(ctx context.Context, ownerID uuid.UUID, limit int, after *ListCursor) ([]model.InAppNotification, *ListCursor, error) {
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	fetch := limit + 1
	var (
		rows pgx.Rows
		err  error
	)
	if after == nil {
		rows, err = r.pool.Query(ctx, `
			SELECT id, owner_id, kind, title, body, read_at, source_document_id, metadata, created_at
			FROM in_app_notifications
			WHERE owner_id = $1
			ORDER BY created_at DESC, id DESC
			LIMIT $2
		`, ownerID, fetch)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT id, owner_id, kind, title, body, read_at, source_document_id, metadata, created_at
			FROM in_app_notifications
			WHERE owner_id = $1
			  AND (created_at, id) < ($2, $3)
			ORDER BY created_at DESC, id DESC
			LIMIT $4
		`, ownerID, after.CreatedAt, after.ID, fetch)
	}
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var out []model.InAppNotification
	for rows.Next() {
		var n model.InAppNotification
		var meta []byte
		err := rows.Scan(
			&n.ID, &n.OwnerID, &n.Kind, &n.Title, &n.Body, &n.ReadAt,
			&n.SourceDocumentID, &meta, &n.CreatedAt,
		)
		if err != nil {
			return nil, nil, err
		}
		if len(meta) > 0 {
			n.Metadata = meta
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	var next *ListCursor
	if len(out) > limit {
		// more pages: return only `limit` items; next cursor = last returned row
		last := out[limit-1]
		out = out[:limit]
		next = &ListCursor{CreatedAt: last.CreatedAt, ID: last.ID}
	}

	return out, next, nil
}

// MarkRead sets read_at if null for the given id and owner.
func (r *NotificationRepository) MarkRead(ctx context.Context, ownerID, notifID uuid.UUID) error {
	cmd, err := r.pool.Exec(ctx, `
		UPDATE in_app_notifications
		SET read_at = COALESCE(read_at, now())
		WHERE id = $1 AND owner_id = $2
	`, notifID, ownerID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("%w", ErrNotificationNotFound)
	}
	return nil
}

// MarkAllRead marks every unread row for the owner.
func (r *NotificationRepository) MarkAllRead(ctx context.Context, ownerID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE in_app_notifications
		SET read_at = now()
		WHERE owner_id = $1 AND read_at IS NULL
	`, ownerID)
	return err
}

// UnreadCount returns notifications with read_at IS NULL.
func (r *NotificationRepository) UnreadCount(ctx context.Context, ownerID uuid.UUID) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM in_app_notifications
		WHERE owner_id = $1 AND read_at IS NULL
	`, ownerID).Scan(&n)
	return n, err
}
