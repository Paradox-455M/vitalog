package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/model"
)

type DocumentRepository struct {
	pool *pgxpool.Pool
}

func NewDocumentRepository(pool *pgxpool.Pool) *DocumentRepository {
	return &DocumentRepository{pool: pool}
}

func (r *DocumentRepository) Create(ctx context.Context, doc *model.Document) error {
	query := `
		INSERT INTO documents (id, owner_id, family_member_id, storage_path, file_name, file_type, extraction_status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at
	`
	doc.ID = uuid.New()
	doc.ExtractionStatus = model.ExtractionStatusPending

	return r.pool.QueryRow(ctx, query,
		doc.ID,
		doc.OwnerID,
		doc.FamilyMemberID,
		doc.StoragePath,
		doc.FileName,
		doc.FileType,
		doc.ExtractionStatus,
	).Scan(&doc.CreatedAt)
}

func (r *DocumentRepository) GetByID(ctx context.Context, userID, docID uuid.UUID) (*model.Document, error) {
	query := `
		SELECT id, owner_id, family_member_id, storage_path, file_name, file_type,
		       document_type, report_date, lab_name, extraction_status, explanation_text,
		       created_at, deleted_at
		FROM documents
		WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
	`
	var doc model.Document
	err := r.pool.QueryRow(ctx, query, docID, userID).Scan(
		&doc.ID,
		&doc.OwnerID,
		&doc.FamilyMemberID,
		&doc.StoragePath,
		&doc.FileName,
		&doc.FileType,
		&doc.DocumentType,
		&doc.ReportDate,
		&doc.LabName,
		&doc.ExtractionStatus,
		&doc.ExplanationText,
		&doc.CreatedAt,
		&doc.DeletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

// List returns a paginated list of documents with pre-computed flagged-value summaries.
// The second return value is the total matching row count (ignoring LIMIT/OFFSET).
func (r *DocumentRepository) List(ctx context.Context, userID uuid.UUID, filter *model.DocumentsFilter) ([]model.DocumentListItem, int, error) {
	limit := 20
	offset := 0
	if filter != nil {
		if filter.Limit > 0 {
			limit = filter.Limit
			if limit > 100 {
				limit = 100
			}
		}
		if filter.Offset > 0 {
			offset = filter.Offset
		}
	}

	// Correlated subqueries compute the flagged summary per document in one pass.
	// COUNT(*) OVER() captures the total before LIMIT/OFFSET is applied.
	query := `
		SELECT
			d.id, d.owner_id, d.family_member_id, d.storage_path, d.file_name,
			d.file_type, d.document_type, d.report_date, d.lab_name,
			d.extraction_status, d.explanation_text, d.created_at, d.deleted_at,
			(SELECT COUNT(*)::int
			 FROM health_values
			 WHERE document_id = d.id AND is_flagged = true)
				AS flagged_count,
			(SELECT COALESCE(jsonb_agg(v ORDER BY v->>'canonical_name'), '[]'::jsonb)
			 FROM (
			   SELECT jsonb_build_object(
			       'canonical_name', hv2.canonical_name,
			       'display_name',   hv2.display_name,
			       'value',          hv2.value,
			       'unit',           hv2.unit,
			       'is_flagged',     hv2.is_flagged
			   ) AS v
			   FROM health_values hv2
			   WHERE hv2.document_id = d.id AND hv2.is_flagged = true
			   ORDER BY hv2.canonical_name
			   LIMIT 3
			 ) top3)
				AS flagged_values,
			COUNT(*) OVER() AS total_count
		FROM documents d
		WHERE d.owner_id = $1 AND d.deleted_at IS NULL
	`

	args := []interface{}{userID}
	argNum := 2

	if filter != nil {
		if filter.FamilyMemberID != nil {
			query += fmt.Sprintf(" AND d.family_member_id = $%d", argNum)
			args = append(args, *filter.FamilyMemberID)
			argNum++
		}
		if filter.DocumentType != nil {
			query += fmt.Sprintf(" AND d.document_type = $%d", argNum)
			args = append(args, *filter.DocumentType)
			argNum++
		}
		if filter.Status != nil {
			query += fmt.Sprintf(" AND d.extraction_status = $%d", argNum)
			args = append(args, *filter.Status)
			argNum++
		}
		if filter.FromDate != nil {
			query += fmt.Sprintf(" AND d.report_date >= $%d", argNum)
			args = append(args, *filter.FromDate)
			argNum++
		}
		if filter.ToDate != nil {
			query += fmt.Sprintf(" AND d.report_date <= $%d", argNum)
			args = append(args, *filter.ToDate)
			argNum++
		}
		if filter.Search != nil {
			// Same parameter referenced in both branches — valid in PostgreSQL.
			query += fmt.Sprintf(" AND (d.file_name ILIKE $%d OR d.lab_name ILIKE $%d)", argNum, argNum)
			args = append(args, "%"+*filter.Search+"%")
			argNum++
		}
		if filter.LabName != nil {
			query += fmt.Sprintf(" AND d.lab_name = $%d", argNum)
			args = append(args, *filter.LabName)
			argNum++
		}
	}

	query += fmt.Sprintf(" ORDER BY COALESCE(d.report_date, d.created_at) DESC LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []model.DocumentListItem
	total := 0
	for rows.Next() {
		var item model.DocumentListItem
		var flaggedJSON []byte
		var rowTotal int
		if err := rows.Scan(
			&item.ID,
			&item.OwnerID,
			&item.FamilyMemberID,
			&item.StoragePath,
			&item.FileName,
			&item.FileType,
			&item.DocumentType,
			&item.ReportDate,
			&item.LabName,
			&item.ExtractionStatus,
			&item.ExplanationText,
			&item.CreatedAt,
			&item.DeletedAt,
			&item.FlaggedCount,
			&flaggedJSON,
			&rowTotal,
		); err != nil {
			return nil, 0, err
		}
		total = rowTotal
		if len(flaggedJSON) > 0 {
			_ = json.Unmarshal(flaggedJSON, &item.FlaggedValues)
		}
		if item.FlaggedValues == nil {
			item.FlaggedValues = []model.FlaggedValueSummary{}
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = []model.DocumentListItem{}
	}
	return items, total, nil
}

func (r *DocumentRepository) SoftDelete(ctx context.Context, userID, docID uuid.UUID) error {
	query := `
		UPDATE documents
		SET deleted_at = $1
		WHERE id = $2 AND owner_id = $3 AND deleted_at IS NULL
	`
	result, err := r.pool.Exec(ctx, query, time.Now(), docID, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("document not found")
	}
	return nil
}

// UpdateStatus updates extraction_status scoped to ownerID to prevent cross-user writes.
func (r *DocumentRepository) UpdateStatus(ctx context.Context, ownerID, docID uuid.UUID, status string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE documents
		SET extraction_status = $1
		WHERE id = $2 AND owner_id = $3
	`, status, docID, ownerID)
	return err
}

// UpdateExtraction scopes the write to ownerID to prevent cross-user document mutation.
func (r *DocumentRepository) UpdateExtraction(ctx context.Context, ownerID, docID uuid.UUID, docType, labName *string, reportDate *time.Time, explanationText string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE documents
		SET extraction_status = $1,
		    document_type = COALESCE($2, document_type),
		    lab_name = COALESCE($3, lab_name),
		    report_date = COALESCE($4, report_date),
		    explanation_text = $5
		WHERE id = $6 AND owner_id = $7
	`, model.ExtractionStatusComplete, docType, labName, reportDate, explanationText, docID, ownerID)
	return err
}

// GetDashboardStats returns aggregated metrics for the user's dashboard in one query.
func (r *DocumentRepository) GetDashboardStats(ctx context.Context, userID uuid.UUID) (*model.DashboardStats, error) {
	query := `
		SELECT
			COUNT(DISTINCT d.id)::int                                   AS report_count,
			COUNT(hv.id)::int                                           AS values_tracked,
			COUNT(hv.id) FILTER (WHERE hv.is_flagged)::int              AS flagged_count,
			MAX(d.created_at)                                           AS last_upload_at
		FROM documents d
		LEFT JOIN health_values hv ON hv.document_id = d.id
		WHERE d.owner_id = $1 AND d.deleted_at IS NULL
	`
	var s model.DashboardStats
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&s.ReportCount,
		&s.ValuesTracked,
		&s.FlaggedCount,
		&s.LastUploadAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetLabNames returns distinct, non-empty lab names from the user's documents.
func (r *DocumentRepository) GetLabNames(ctx context.Context, userID uuid.UUID) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT lab_name
		FROM documents
		WHERE owner_id = $1 AND deleted_at IS NULL AND lab_name IS NOT NULL AND lab_name <> ''
		ORDER BY lab_name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	if names == nil {
		names = []string{}
	}
	return names, rows.Err()
}
