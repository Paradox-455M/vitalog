package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/model"
)

type ProfileRepository struct {
	pool *pgxpool.Pool
}

func NewProfileRepository(pool *pgxpool.Pool) *ProfileRepository {
	return &ProfileRepository{pool: pool}
}

// EnsureExists creates a profile row if one doesn't exist yet.
// Called before any write that requires owner_id to be present in profiles.
func (r *ProfileRepository) EnsureExists(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO public.profiles (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
		userID,
	)
	return err
}

func (r *ProfileRepository) GetByID(ctx context.Context, userID uuid.UUID) (*model.Profile, error) {
	query := `
		SELECT id, created_at, email, full_name, avatar_url, plan
		FROM profiles
		WHERE id = $1
	`
	var profile model.Profile
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&profile.ID,
		&profile.CreatedAt,
		&profile.Email,
		&profile.FullName,
		&profile.AvatarURL,
		&profile.Plan,
	)
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *ProfileRepository) Update(ctx context.Context, userID uuid.UUID, fullName, avatarURL *string) error {
	query := `
		UPDATE profiles
		SET full_name = COALESCE($1, full_name),
		    avatar_url = COALESCE($2, avatar_url)
		WHERE id = $3
	`
	result, err := r.pool.Exec(ctx, query, fullName, avatarURL, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("profile not found")
	}
	return nil
}

func (r *ProfileRepository) UpdatePlan(ctx context.Context, userID uuid.UUID, plan string) error {
	query := `
		UPDATE profiles
		SET plan = $1
		WHERE id = $2
	`
	result, err := r.pool.Exec(ctx, query, plan, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("profile not found")
	}
	return nil
}

func (r *ProfileRepository) GetDocumentCount(ctx context.Context, userID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM documents WHERE owner_id = $1 AND deleted_at IS NULL`
	var count int
	err := r.pool.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}

// GetNotificationPreferencesJSON returns raw JSONB for notification_preferences.
func (r *ProfileRepository) GetNotificationPreferencesJSON(ctx context.Context, userID uuid.UUID) (json.RawMessage, error) {
	var raw []byte
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(notification_preferences, '{}'::jsonb)
		FROM profiles
		WHERE id = $1
	`, userID).Scan(&raw)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

// SetNotificationPreferences replaces notification_preferences.
func (r *ProfileRepository) SetNotificationPreferences(ctx context.Context, userID uuid.UUID, prefs model.NotificationPreferences) error {
	b, err := json.Marshal(prefs)
	if err != nil {
		return err
	}
	result, err := r.pool.Exec(ctx, `
		UPDATE profiles
		SET notification_preferences = $1::jsonb
		WHERE id = $2
	`, b, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("profile not found")
	}
	return nil
}
