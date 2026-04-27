package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/model"
)

type HealthValueRepository struct {
	pool *pgxpool.Pool
}

func NewHealthValueRepository(pool *pgxpool.Pool) *HealthValueRepository {
	return &HealthValueRepository{pool: pool}
}

func (r *HealthValueRepository) CreateBatch(ctx context.Context, values []model.HealthValue) error {
	if len(values) == 0 {
		return nil
	}

	query := `
		INSERT INTO health_values (id, document_id, family_member_id, canonical_name, display_name,
		                           value, unit, reference_low, reference_high, is_flagged, report_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	batch := &pgx.Batch{}
	for _, v := range values {
		v.ID = uuid.New()
		batch.Queue(query,
			v.ID,
			v.DocumentID,
			v.FamilyMemberID,
			v.CanonicalName,
			v.DisplayName,
			v.Value,
			v.Unit,
			v.ReferenceLow,
			v.ReferenceHigh,
			v.IsFlagged,
			v.ReportDate,
		)
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for range values {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch insert health value: %w", err)
		}
	}
	return nil
}

// GetPreviousValue returns the most recent value for a given canonical_name before beforeDate.
// Returns (value, true, nil) when found; (0, false, nil) when no prior value exists.
func (r *HealthValueRepository) GetPreviousValue(ctx context.Context, ownerID uuid.UUID, canonicalName string, familyMemberID *uuid.UUID, beforeDate time.Time) (float64, bool, error) {
	query := `
		SELECT hv.value
		FROM health_values hv
		JOIN documents d ON d.id = hv.document_id
		WHERE d.owner_id = $1 AND d.deleted_at IS NULL
		  AND hv.canonical_name = $2
		  AND hv.report_date < $3
	`
	args := []interface{}{ownerID, canonicalName, beforeDate}
	argNum := 4

	if familyMemberID != nil {
		query += fmt.Sprintf(" AND hv.family_member_id = $%d", argNum)
		args = append(args, *familyMemberID)
	} else {
		query += " AND hv.family_member_id IS NULL"
	}

	query += " ORDER BY hv.report_date DESC LIMIT 1"

	var value float64
	err := r.pool.QueryRow(ctx, query, args...).Scan(&value)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return value, true, nil
}

// GetByDocumentID returns health values only for non-deleted documents (H4).
func (r *HealthValueRepository) GetByDocumentID(ctx context.Context, docID uuid.UUID) ([]model.HealthValue, error) {
	query := `
		SELECT hv.id, hv.document_id, hv.family_member_id, hv.canonical_name, hv.display_name,
		       hv.value, hv.unit, hv.reference_low, hv.reference_high, hv.is_flagged, hv.report_date, hv.created_at
		FROM health_values hv
		JOIN documents d ON d.id = hv.document_id
		WHERE hv.document_id = $1 AND d.deleted_at IS NULL
		ORDER BY hv.canonical_name
	`

	rows, err := r.pool.Query(ctx, query, docID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var values []model.HealthValue
	for rows.Next() {
		var v model.HealthValue
		err := rows.Scan(
			&v.ID,
			&v.DocumentID,
			&v.FamilyMemberID,
			&v.CanonicalName,
			&v.DisplayName,
			&v.Value,
			&v.Unit,
			&v.ReferenceLow,
			&v.ReferenceHigh,
			&v.IsFlagged,
			&v.ReportDate,
			&v.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		values = append(values, v)
	}

	return values, rows.Err()
}

func (r *HealthValueRepository) ListByUser(ctx context.Context, userID uuid.UUID, filter *model.HealthValuesFilter) ([]model.HealthValue, error) {
	query := `
		SELECT hv.id, hv.document_id, hv.family_member_id, hv.canonical_name, hv.display_name,
		       hv.value, hv.unit, hv.reference_low, hv.reference_high, hv.is_flagged, hv.report_date, hv.created_at
		FROM health_values hv
		JOIN documents d ON d.id = hv.document_id
		WHERE d.owner_id = $1 AND d.deleted_at IS NULL
	`
	args := []interface{}{userID}
	argNum := 2

	if filter != nil {
		if filter.FamilyMemberID != nil {
			query += fmt.Sprintf(" AND hv.family_member_id = $%d", argNum)
			args = append(args, *filter.FamilyMemberID)
			argNum++
		}
		if filter.CanonicalName != nil {
			query += fmt.Sprintf(" AND hv.canonical_name = $%d", argNum)
			args = append(args, *filter.CanonicalName)
			argNum++
		}
		if filter.FromDate != nil {
			query += fmt.Sprintf(" AND hv.report_date >= $%d", argNum)
			args = append(args, *filter.FromDate)
			argNum++
		}
		if filter.ToDate != nil {
			query += fmt.Sprintf(" AND hv.report_date <= $%d", argNum)
			args = append(args, *filter.ToDate)
			argNum++
		}
	}

	query += " ORDER BY hv.report_date DESC, hv.canonical_name"

	if filter != nil && filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argNum)
		args = append(args, filter.Limit)
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var values []model.HealthValue
	for rows.Next() {
		var v model.HealthValue
		err := rows.Scan(
			&v.ID,
			&v.DocumentID,
			&v.FamilyMemberID,
			&v.CanonicalName,
			&v.DisplayName,
			&v.Value,
			&v.Unit,
			&v.ReferenceLow,
			&v.ReferenceHigh,
			&v.IsFlagged,
			&v.ReportDate,
			&v.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		values = append(values, v)
	}

	return values, rows.Err()
}

func (r *HealthValueRepository) GetTimeline(ctx context.Context, userID uuid.UUID, canonicalName string, familyMemberID *uuid.UUID) (*model.TimelineData, error) {
	query := `
		SELECT hv.canonical_name, hv.display_name, hv.unit, hv.reference_low, hv.reference_high,
		       hv.report_date, hv.value, hv.document_id
		FROM health_values hv
		JOIN documents d ON d.id = hv.document_id
		WHERE d.owner_id = $1 AND d.deleted_at IS NULL AND hv.canonical_name = $2
	`
	args := []interface{}{userID, canonicalName}
	argNum := 3

	if familyMemberID != nil {
		query += fmt.Sprintf(" AND hv.family_member_id = $%d", argNum)
		args = append(args, *familyMemberID)
	}

	query += " ORDER BY hv.report_date ASC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	timeline := &model.TimelineData{
		CanonicalName: canonicalName,
		Points:        []model.TimelinePoint{},
	}

	for rows.Next() {
		var point model.TimelinePoint
		var displayName string
		var unit *string
		var refLow, refHigh *float64

		err := rows.Scan(
			&timeline.CanonicalName,
			&displayName,
			&unit,
			&refLow,
			&refHigh,
			&point.ReportDate,
			&point.Value,
			&point.DocumentID,
		)
		if err != nil {
			return nil, err
		}

		if timeline.DisplayName == "" {
			timeline.DisplayName = displayName
			timeline.Unit = unit
			timeline.ReferenceLow = refLow
			timeline.ReferenceHigh = refHigh
		}

		timeline.Points = append(timeline.Points, point)
	}

	return timeline, rows.Err()
}
