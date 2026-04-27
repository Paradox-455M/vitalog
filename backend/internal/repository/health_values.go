package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/crypto"
	"github.com/vitalog/backend/internal/model"
)

type HealthValueRepository struct {
	pool   *pgxpool.Pool
	crypto *crypto.Service
}

func NewHealthValueRepository(pool *pgxpool.Pool, cryptoSvc *crypto.Service) *HealthValueRepository {
	return &HealthValueRepository{pool: pool, crypto: cryptoSvc}
}

func (r *HealthValueRepository) CreateBatch(ctx context.Context, ownerID uuid.UUID, values []model.HealthValue) error {
	if len(values) == 0 {
		return nil
	}

	query := `
		INSERT INTO health_values (id, document_id, family_member_id, canonical_name, display_name,
		                           value, unit, reference_low, reference_high, is_flagged, report_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	for _, v := range values {
		v.ID = uuid.New()

		valEnc, err := r.crypto.EncryptFloat64(ctx, ownerID, v.Value)
		if err != nil {
			return fmt.Errorf("encrypt value: %w", err)
		}
		refLowEnc, err := r.crypto.EncryptOptFloat64(ctx, ownerID, v.ReferenceLow)
		if err != nil {
			return fmt.Errorf("encrypt reference_low: %w", err)
		}
		refHighEnc, err := r.crypto.EncryptOptFloat64(ctx, ownerID, v.ReferenceHigh)
		if err != nil {
			return fmt.Errorf("encrypt reference_high: %w", err)
		}

		_, err = r.pool.Exec(ctx, query,
			v.ID,
			v.DocumentID,
			v.FamilyMemberID,
			v.CanonicalName,
			v.DisplayName,
			valEnc,
			v.Unit,
			refLowEnc,
			refHighEnc,
			v.IsFlagged,
			v.ReportDate,
		)
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

	var encVal []byte
	err := r.pool.QueryRow(ctx, query, args...).Scan(&encVal)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	value, err := r.crypto.DecryptToFloat64(ctx, ownerID, encVal)
	if err != nil {
		return 0, false, err
	}
	return value, true, nil
}

// GetByDocumentID returns health values only for non-deleted documents owned by ownerID.
func (r *HealthValueRepository) GetByDocumentID(ctx context.Context, ownerID, docID uuid.UUID) ([]model.HealthValue, error) {
	query := `
		SELECT hv.id, hv.document_id, hv.family_member_id, hv.canonical_name, hv.display_name,
		       hv.value, hv.unit, hv.reference_low, hv.reference_high, hv.is_flagged, hv.report_date, hv.created_at
		FROM health_values hv
		JOIN documents d ON d.id = hv.document_id
		WHERE hv.document_id = $1 AND d.owner_id = $2 AND d.deleted_at IS NULL
		ORDER BY hv.canonical_name
	`

	rows, err := r.pool.Query(ctx, query, docID, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var values []model.HealthValue
	for rows.Next() {
		var v model.HealthValue
		var valEnc, refLowEnc, refHighEnc []byte
		err := rows.Scan(
			&v.ID,
			&v.DocumentID,
			&v.FamilyMemberID,
			&v.CanonicalName,
			&v.DisplayName,
			&valEnc,
			&v.Unit,
			&refLowEnc,
			&refHighEnc,
			&v.IsFlagged,
			&v.ReportDate,
			&v.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if err := r.decryptHealthValue(ctx, ownerID, valEnc, refLowEnc, refHighEnc, &v); err != nil {
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
		var valEnc, refLowEnc, refHighEnc []byte
		err := rows.Scan(
			&v.ID,
			&v.DocumentID,
			&v.FamilyMemberID,
			&v.CanonicalName,
			&v.DisplayName,
			&valEnc,
			&v.Unit,
			&refLowEnc,
			&refHighEnc,
			&v.IsFlagged,
			&v.ReportDate,
			&v.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if err := r.decryptHealthValue(ctx, userID, valEnc, refLowEnc, refHighEnc, &v); err != nil {
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
		var refLowEnc, refHighEnc, valEnc []byte

		err := rows.Scan(
			&timeline.CanonicalName,
			&displayName,
			&unit,
			&refLowEnc,
			&refHighEnc,
			&point.ReportDate,
			&valEnc,
			&point.DocumentID,
		)
		if err != nil {
			return nil, err
		}

		val, err := r.crypto.DecryptToFloat64(ctx, userID, valEnc)
		if err != nil {
			return nil, fmt.Errorf("decrypt timeline value: %w", err)
		}
		point.Value = val

		if timeline.DisplayName == "" {
			timeline.DisplayName = displayName
			timeline.Unit = unit
			refLow, err := r.crypto.DecryptToOptFloat64(ctx, userID, refLowEnc)
			if err != nil {
				return nil, fmt.Errorf("decrypt reference_low: %w", err)
			}
			refHigh, err := r.crypto.DecryptToOptFloat64(ctx, userID, refHighEnc)
			if err != nil {
				return nil, fmt.Errorf("decrypt reference_high: %w", err)
			}
			timeline.ReferenceLow = refLow
			timeline.ReferenceHigh = refHigh
		}

		timeline.Points = append(timeline.Points, point)
	}

	return timeline, rows.Err()
}

// GetFlaggedBatch returns the top-3 flagged health values per document for the given document IDs.
// Used by DocumentRepository.List to populate the FlaggedValues preview without SQL-side decryption.
func (r *HealthValueRepository) GetFlaggedBatch(ctx context.Context, userID uuid.UUID, docIDs []uuid.UUID) (map[uuid.UUID][]model.FlaggedValueSummary, error) {
	if len(docIDs) == 0 {
		return nil, nil
	}

	query := `
		SELECT document_id, canonical_name, display_name, value, unit, is_flagged
		FROM (
			SELECT document_id, canonical_name, display_name, value, unit, is_flagged,
			       ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY canonical_name) AS rn
			FROM health_values
			WHERE document_id = ANY($1) AND is_flagged = true
		) t
		WHERE rn <= 3
	`

	rows, err := r.pool.Query(ctx, query, docIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID][]model.FlaggedValueSummary)
	for rows.Next() {
		var docID uuid.UUID
		var summary model.FlaggedValueSummary
		var valEnc []byte
		if err := rows.Scan(&docID, &summary.CanonicalName, &summary.DisplayName, &valEnc, &summary.Unit, &summary.IsFlagged); err != nil {
			return nil, err
		}
		val, err := r.crypto.DecryptToFloat64(ctx, userID, valEnc)
		if err != nil {
			return nil, fmt.Errorf("decrypt flagged value: %w", err)
		}
		summary.Value = val
		result[docID] = append(result[docID], summary)
	}
	return result, rows.Err()
}

func (r *HealthValueRepository) decryptHealthValue(ctx context.Context, userID uuid.UUID, valEnc, refLowEnc, refHighEnc []byte, v *model.HealthValue) error {
	val, err := r.crypto.DecryptToFloat64(ctx, userID, valEnc)
	if err != nil {
		return fmt.Errorf("decrypt value: %w", err)
	}
	v.Value = val

	refLow, err := r.crypto.DecryptToOptFloat64(ctx, userID, refLowEnc)
	if err != nil {
		return fmt.Errorf("decrypt reference_low: %w", err)
	}
	v.ReferenceLow = refLow

	refHigh, err := r.crypto.DecryptToOptFloat64(ctx, userID, refHighEnc)
	if err != nil {
		return fmt.Errorf("decrypt reference_high: %w", err)
	}
	v.ReferenceHigh = refHigh
	return nil
}
