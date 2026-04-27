package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/crypto"
	"github.com/vitalog/backend/internal/model"
)

type DocumentRepository struct {
	pool   *pgxpool.Pool
	crypto *crypto.Service
}

func NewDocumentRepository(pool *pgxpool.Pool, cryptoSvc *crypto.Service) *DocumentRepository {
	return &DocumentRepository{pool: pool, crypto: cryptoSvc}
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
	var explanationEnc []byte
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
		&explanationEnc,
		&doc.CreatedAt,
		&doc.DeletedAt,
	)
	if err != nil {
		return nil, err
	}
	doc.ExplanationText, err = r.crypto.DecryptToOptString(ctx, userID, explanationEnc)
	if err != nil {
		return nil, fmt.Errorf("decrypt explanation_text: %w", err)
	}
	return &doc, nil
}

// List returns a paginated list of documents. FlaggedValues are populated via a
// separate batch query so that encrypted health values can be decrypted in Go.
func (r *DocumentRepository) List(ctx context.Context, userID uuid.UUID, filter *model.DocumentsFilter, hvRepo *HealthValueRepository) ([]model.DocumentListItem, int, error) {
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

	query := `
		SELECT
			d.id, d.owner_id, d.family_member_id, d.storage_path, d.file_name,
			d.file_type, d.document_type, d.report_date, d.lab_name,
			d.extraction_status, d.explanation_text, d.created_at, d.deleted_at,
			(SELECT COUNT(*)::int FROM health_values WHERE document_id = d.id AND is_flagged = true) AS flagged_count,
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
	var docIDs []uuid.UUID
	total := 0

	for rows.Next() {
		var item model.DocumentListItem
		var explanationEnc []byte
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
			&explanationEnc,
			&item.CreatedAt,
			&item.DeletedAt,
			&item.FlaggedCount,
			&rowTotal,
		); err != nil {
			return nil, 0, err
		}
		total = rowTotal
		item.ExplanationText, err = r.crypto.DecryptToOptString(ctx, userID, explanationEnc)
		if err != nil {
			return nil, 0, fmt.Errorf("decrypt explanation_text: %w", err)
		}
		item.FlaggedValues = []model.FlaggedValueSummary{}
		items = append(items, item)
		if item.FlaggedCount > 0 {
			docIDs = append(docIDs, item.ID)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = []model.DocumentListItem{}
	}

	// Populate flagged values via a separate batch query so values can be decrypted in Go.
	if len(docIDs) > 0 && hvRepo != nil {
		flaggedMap, err := hvRepo.GetFlaggedBatch(ctx, userID, docIDs)
		if err != nil {
			return nil, 0, fmt.Errorf("fetch flagged values: %w", err)
		}
		for i := range items {
			if fv, ok := flaggedMap[items[i].ID]; ok {
				items[i].FlaggedValues = fv
			}
		}
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

func (r *DocumentRepository) UpdateStatus(ctx context.Context, ownerID, docID uuid.UUID, status string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE documents
		SET extraction_status = $1
		WHERE id = $2 AND owner_id = $3
	`, status, docID, ownerID)
	return err
}

// UpdateExtraction encrypts explanation_text before persisting.
func (r *DocumentRepository) UpdateExtraction(ctx context.Context, ownerID, docID uuid.UUID, docType, labName *string, reportDate *time.Time, explanationText string) error {
	var explanationEnc []byte
	if explanationText != "" {
		var err error
		explanationEnc, err = r.crypto.EncryptString(ctx, ownerID, explanationText)
		if err != nil {
			return fmt.Errorf("encrypt explanation_text: %w", err)
		}
	}

	_, err := r.pool.Exec(ctx, `
		UPDATE documents
		SET extraction_status = $1,
		    document_type = COALESCE($2, document_type),
		    lab_name = COALESCE($3, lab_name),
		    report_date = COALESCE($4, report_date),
		    explanation_text = $5
		WHERE id = $6 AND owner_id = $7
	`, model.ExtractionStatusComplete, docType, labName, reportDate, explanationEnc, docID, ownerID)
	return err
}

// GetDashboardStats returns aggregated metrics for the user's dashboard in one query.
// If familyMemberID is non-nil, results are scoped to that family member's documents.
func (r *DocumentRepository) GetDashboardStats(ctx context.Context, userID uuid.UUID, familyMemberID *uuid.UUID) (*model.DashboardStats, error) {
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
	args := []interface{}{userID}
	if familyMemberID != nil {
		query += " AND d.family_member_id = $2"
		args = append(args, *familyMemberID)
	}
	var s model.DashboardStats
	err := r.pool.QueryRow(ctx, query, args...).Scan(
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
