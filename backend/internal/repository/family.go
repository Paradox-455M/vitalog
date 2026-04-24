package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vitalog/backend/internal/model"
)

type FamilyRepository struct {
	pool *pgxpool.Pool
}

func NewFamilyRepository(pool *pgxpool.Pool) *FamilyRepository {
	return &FamilyRepository{pool: pool}
}

func (r *FamilyRepository) Create(ctx context.Context, member *model.FamilyMember) error {
	query := `
		INSERT INTO family_members (id, owner_id, name, relationship, date_of_birth)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at
	`
	member.ID = uuid.New()

	return r.pool.QueryRow(ctx, query,
		member.ID,
		member.OwnerID,
		member.Name,
		member.Relationship,
		member.DateOfBirth,
	).Scan(&member.CreatedAt)
}

func (r *FamilyRepository) GetByID(ctx context.Context, userID, memberID uuid.UUID) (*model.FamilyMember, error) {
	query := `
		SELECT id, owner_id, name, relationship, date_of_birth, created_at
		FROM family_members
		WHERE id = $1 AND owner_id = $2
	`
	var member model.FamilyMember
	err := r.pool.QueryRow(ctx, query, memberID, userID).Scan(
		&member.ID,
		&member.OwnerID,
		&member.Name,
		&member.Relationship,
		&member.DateOfBirth,
		&member.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func (r *FamilyRepository) List(ctx context.Context, userID uuid.UUID) ([]model.FamilyMember, error) {
	query := `
		SELECT id, owner_id, name, relationship, date_of_birth, created_at
		FROM family_members
		WHERE owner_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []model.FamilyMember
	for rows.Next() {
		var member model.FamilyMember
		err := rows.Scan(
			&member.ID,
			&member.OwnerID,
			&member.Name,
			&member.Relationship,
			&member.DateOfBirth,
			&member.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		members = append(members, member)
	}

	return members, rows.Err()
}

func (r *FamilyRepository) Update(ctx context.Context, userID, memberID uuid.UUID, name *string, relationship *string, dob *time.Time) error {
	query := `
		UPDATE family_members
		SET name = COALESCE($1, name),
		    relationship = COALESCE($2, relationship),
		    date_of_birth = COALESCE($3, date_of_birth)
		WHERE id = $4 AND owner_id = $5
	`
	result, err := r.pool.Exec(ctx, query, name, relationship, dob, memberID, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("family member not found")
	}
	return nil
}

func (r *FamilyRepository) Delete(ctx context.Context, userID, memberID uuid.UUID) error {
	query := `
		DELETE FROM family_members
		WHERE id = $1 AND owner_id = $2
	`
	result, err := r.pool.Exec(ctx, query, memberID, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("family member not found")
	}
	return nil
}

func (r *FamilyRepository) Count(ctx context.Context, userID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM family_members WHERE owner_id = $1`
	var count int
	err := r.pool.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}
