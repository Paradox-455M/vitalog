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

type FamilyRepository struct {
	pool   *pgxpool.Pool
	crypto *crypto.Service
}

func NewFamilyRepository(pool *pgxpool.Pool, cryptoSvc *crypto.Service) *FamilyRepository {
	return &FamilyRepository{pool: pool, crypto: cryptoSvc}
}

func (r *FamilyRepository) Create(ctx context.Context, member *model.FamilyMember) error {
	member.ID = uuid.New()

	nameEnc, err := r.crypto.EncryptString(ctx, member.OwnerID, member.Name)
	if err != nil {
		return fmt.Errorf("encrypt name: %w", err)
	}
	var dobEnc []byte
	if member.DateOfBirth != nil {
		dobEnc, err = r.crypto.EncryptString(ctx, member.OwnerID, member.DateOfBirth.Format(time.RFC3339))
		if err != nil {
			return fmt.Errorf("encrypt date_of_birth: %w", err)
		}
	}

	return r.pool.QueryRow(ctx, `
		INSERT INTO family_members (id, owner_id, name, relationship, date_of_birth)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at
	`,
		member.ID,
		member.OwnerID,
		nameEnc,
		member.Relationship,
		dobEnc,
	).Scan(&member.CreatedAt)
}

func (r *FamilyRepository) GetByID(ctx context.Context, userID, memberID uuid.UUID) (*model.FamilyMember, error) {
	var member model.FamilyMember
	var nameEnc, dobEnc []byte
	err := r.pool.QueryRow(ctx, `
		SELECT id, owner_id, name, relationship, date_of_birth, created_at
		FROM family_members
		WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
	`, memberID, userID).Scan(
		&member.ID,
		&member.OwnerID,
		&nameEnc,
		&member.Relationship,
		&dobEnc,
		&member.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := r.decryptMember(ctx, userID, nameEnc, dobEnc, &member); err != nil {
		return nil, err
	}
	return &member, nil
}

func (r *FamilyRepository) List(ctx context.Context, userID uuid.UUID) ([]model.FamilyMember, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, owner_id, name, relationship, date_of_birth, created_at
		FROM family_members
		WHERE owner_id = $1 AND deleted_at IS NULL
		ORDER BY created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []model.FamilyMember
	for rows.Next() {
		var member model.FamilyMember
		var nameEnc, dobEnc []byte
		err := rows.Scan(
			&member.ID,
			&member.OwnerID,
			&nameEnc,
			&member.Relationship,
			&dobEnc,
			&member.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if err := r.decryptMember(ctx, userID, nameEnc, dobEnc, &member); err != nil {
			return nil, err
		}
		members = append(members, member)
	}

	return members, rows.Err()
}

func (r *FamilyRepository) Update(ctx context.Context, userID, memberID uuid.UUID, name *string, relationship *string, dob *time.Time) error {
	var nameEnc, dobEnc []byte
	var err error

	if name != nil {
		nameEnc, err = r.crypto.EncryptString(ctx, userID, *name)
		if err != nil {
			return fmt.Errorf("encrypt name: %w", err)
		}
	}
	if dob != nil {
		dobEnc, err = r.crypto.EncryptString(ctx, userID, dob.Format(time.RFC3339))
		if err != nil {
			return fmt.Errorf("encrypt date_of_birth: %w", err)
		}
	}

	result, err := r.pool.Exec(ctx, `
		UPDATE family_members
		SET name = COALESCE($1, name),
		    relationship = COALESCE($2, relationship),
		    date_of_birth = COALESCE($3, date_of_birth)
		WHERE id = $4 AND owner_id = $5 AND deleted_at IS NULL
	`, byteOrNil(nameEnc), relationship, byteOrNil(dobEnc), memberID, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("family member not found")
	}
	return nil
}

func (r *FamilyRepository) Delete(ctx context.Context, userID, memberID uuid.UUID) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE family_members
		SET deleted_at = now()
		WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
	`, memberID, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("family member not found")
	}
	return nil
}

func (r *FamilyRepository) Count(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM family_members WHERE owner_id = $1 AND deleted_at IS NULL`, userID).Scan(&count)
	return count, err
}

func (r *FamilyRepository) decryptMember(ctx context.Context, userID uuid.UUID, nameEnc, dobEnc []byte, member *model.FamilyMember) error {
	name, err := r.crypto.DecryptToString(ctx, userID, nameEnc)
	if err != nil {
		return fmt.Errorf("decrypt name: %w", err)
	}
	member.Name = name

	if len(dobEnc) > 0 {
		dobStr, err := r.crypto.DecryptToString(ctx, userID, dobEnc)
		if err != nil {
			return fmt.Errorf("decrypt date_of_birth: %w", err)
		}
		// Try RFC3339 (new encrypted format), then plain date (legacy migration data).
		t, err := time.Parse(time.RFC3339, dobStr)
		if err != nil {
			t, err = time.Parse("2006-01-02", dobStr)
		}
		if err != nil {
			return fmt.Errorf("parse date_of_birth %q: %w", dobStr, err)
		}
		member.DateOfBirth = &t
	}
	return nil
}

// byteOrNil returns nil if the slice is empty, allowing COALESCE($1, col) to keep existing value.
func byteOrNil(b []byte) interface{} {
	if len(b) == 0 {
		return nil
	}
	return b
}
