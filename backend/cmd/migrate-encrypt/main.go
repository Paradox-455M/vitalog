// migrate-encrypt is a one-time tool that re-encrypts existing plaintext data
// after the BYTEA column migration. Run it with the server offline:
//
//	cd backend && go run ./cmd/migrate-encrypt
//
// The tool is idempotent: rows already encrypted (ciphertext length > 28 bytes
// and not valid UTF-8 floats / dates) are skipped automatically.
// Delete this binary from production after a successful run.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/vitalog/backend/internal/crypto"
	"github.com/vitalog/backend/internal/repository"
)

func main() {
	_ = godotenv.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx := context.Background()

	pool, err := repository.NewPool(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		slog.Error("db connect", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	vaultName := os.Getenv("VAULT_SECRET_NAME")
	if vaultName == "" {
		vaultName = "vitalog-kek"
	}
	kek, err := crypto.LoadKEK(ctx, pool, vaultName)
	if err != nil {
		slog.Error("load kek", "error", err)
		os.Exit(1)
	}
	cryptoSvc := crypto.NewService(pool, kek)

	if err := migrateHealthValues(ctx, pool, cryptoSvc); err != nil {
		slog.Error("migrate health_values", "error", err)
		os.Exit(1)
	}
	if err := migrateDocuments(ctx, pool, cryptoSvc); err != nil {
		slog.Error("migrate documents", "error", err)
		os.Exit(1)
	}
	if err := migrateFamilyMembers(ctx, pool, cryptoSvc); err != nil {
		slog.Error("migrate family_members", "error", err)
		os.Exit(1)
	}

	slog.Info("migration complete")
}

func migrateHealthValues(ctx context.Context, pool *pgxpool.Pool, svc *crypto.Service) error {
	rows, err := pool.Query(ctx, `
		SELECT hv.id, d.owner_id, hv.value, hv.reference_low, hv.reference_high
		FROM health_values hv
		JOIN documents d ON d.id = hv.document_id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	updated := 0
	for rows.Next() {
		var id, ownerID uuid.UUID
		var valBytes, refLowBytes, refHighBytes []byte
		if err := rows.Scan(&id, &ownerID, &valBytes, &refLowBytes, &refHighBytes); err != nil {
			return err
		}

		valEnc, changed, err := reencryptFloat(ctx, svc, ownerID, valBytes)
		if err != nil {
			return fmt.Errorf("value row %s: %w", id, err)
		}
		refLowEnc, _, err := reencryptOptFloat(ctx, svc, ownerID, refLowBytes)
		if err != nil {
			return fmt.Errorf("ref_low row %s: %w", id, err)
		}
		refHighEnc, _, err := reencryptOptFloat(ctx, svc, ownerID, refHighBytes)
		if err != nil {
			return fmt.Errorf("ref_high row %s: %w", id, err)
		}

		if !changed {
			continue
		}

		_, err = pool.Exec(ctx, `
			UPDATE health_values SET value = $1, reference_low = $2, reference_high = $3 WHERE id = $4
		`, valEnc, refLowEnc, refHighEnc, id)
		if err != nil {
			return fmt.Errorf("update row %s: %w", id, err)
		}
		updated++
	}
	slog.Info("health_values migrated", "updated", updated)
	return rows.Err()
}

func migrateDocuments(ctx context.Context, pool *pgxpool.Pool, svc *crypto.Service) error {
	rows, err := pool.Query(ctx, `SELECT id, owner_id, explanation_text FROM documents WHERE explanation_text IS NOT NULL`)
	if err != nil {
		return err
	}
	defer rows.Close()

	updated := 0
	for rows.Next() {
		var id, ownerID uuid.UUID
		var data []byte
		if err := rows.Scan(&id, &ownerID, &data); err != nil {
			return err
		}
		if isAlreadyEncrypted(data) {
			continue
		}
		enc, err := svc.EncryptString(ctx, ownerID, string(data))
		if err != nil {
			return fmt.Errorf("encrypt doc %s: %w", id, err)
		}
		if _, err := pool.Exec(ctx, `UPDATE documents SET explanation_text = $1 WHERE id = $2`, enc, id); err != nil {
			return fmt.Errorf("update doc %s: %w", id, err)
		}
		updated++
	}
	slog.Info("documents migrated", "updated", updated)
	return rows.Err()
}

func migrateFamilyMembers(ctx context.Context, pool *pgxpool.Pool, svc *crypto.Service) error {
	rows, err := pool.Query(ctx, `SELECT id, owner_id, name, date_of_birth FROM family_members`)
	if err != nil {
		return err
	}
	defer rows.Close()

	updated := 0
	for rows.Next() {
		var id, ownerID uuid.UUID
		var nameBytes, dobBytes []byte
		if err := rows.Scan(&id, &ownerID, &nameBytes, &dobBytes); err != nil {
			return err
		}

		nameChanged := false
		var nameEnc []byte
		if !isAlreadyEncrypted(nameBytes) {
			nameEnc, err = svc.EncryptString(ctx, ownerID, string(nameBytes))
			if err != nil {
				return fmt.Errorf("encrypt name %s: %w", id, err)
			}
			nameChanged = true
		} else {
			nameEnc = nameBytes
		}

		var dobEnc []byte
		if len(dobBytes) > 0 && !isAlreadyEncrypted(dobBytes) {
			dobStr := string(dobBytes)
			// Normalise date string — may be "2000-01-02" or RFC3339
			t, parseErr := time.Parse("2006-01-02", dobStr)
			if parseErr != nil {
				t, parseErr = time.Parse(time.RFC3339, dobStr)
			}
			if parseErr != nil {
				slog.Warn("skip dob — cannot parse", "member_id", id, "raw", dobStr)
				dobEnc = dobBytes
			} else {
				dobEnc, err = svc.EncryptString(ctx, ownerID, t.Format(time.RFC3339))
				if err != nil {
					return fmt.Errorf("encrypt dob %s: %w", id, err)
				}
			}
		} else {
			dobEnc = dobBytes
		}

		if !nameChanged {
			continue
		}

		_, err = pool.Exec(ctx, `UPDATE family_members SET name = $1, date_of_birth = $2 WHERE id = $3`,
			nameEnc, dobOrNil(dobEnc), id)
		if err != nil {
			return fmt.Errorf("update family member %s: %w", id, err)
		}
		updated++
	}
	slog.Info("family_members migrated", "updated", updated)
	return rows.Err()
}

// isAlreadyEncrypted returns true when data looks like AES-GCM ciphertext rather than plaintext.
// AES-GCM output is at least 28 bytes (12 nonce + 0 plaintext + 16 tag) and is not valid UTF-8.
func isAlreadyEncrypted(data []byte) bool {
	if len(data) < 28 {
		return false
	}
	return !utf8.Valid(data)
}

func reencryptFloat(ctx context.Context, svc *crypto.Service, userID uuid.UUID, data []byte) ([]byte, bool, error) {
	if isAlreadyEncrypted(data) {
		return data, false, nil
	}
	_, err := strconv.ParseFloat(string(data), 64)
	if err != nil {
		return data, false, nil // not a float — skip
	}
	enc, err := svc.Encrypt(ctx, userID, data)
	return enc, true, err
}

func reencryptOptFloat(ctx context.Context, svc *crypto.Service, userID uuid.UUID, data []byte) ([]byte, bool, error) {
	if len(data) == 0 {
		return nil, false, nil
	}
	return reencryptFloat(ctx, svc, userID, data)
}

func dobOrNil(b []byte) interface{} {
	if len(b) == 0 {
		return nil
	}
	return b
}
