package crypto

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// LoadKEK loads the master KEK using a two-step strategy:
//  1. ENCRYPTION_KEY env var — a 64-char hex string (32 bytes). Used in development.
//  2. Supabase Vault — reads from vault.decrypted_secrets by name. Used in production.
//
// Production setup (run once in Supabase SQL editor):
//
//	SELECT vault.create_secret('$(openssl rand -hex 32)', 'vitalog-kek');
func LoadKEK(ctx context.Context, pool *pgxpool.Pool, secretName string) ([]byte, error) {
	if raw := os.Getenv("ENCRYPTION_KEY"); raw != "" {
		kek, err := decodeHexKEK(raw)
		if err != nil {
			return nil, fmt.Errorf("ENCRYPTION_KEY: %w", err)
		}
		return kek, nil
	}
	return loadFromVault(ctx, pool, secretName)
}

func loadFromVault(ctx context.Context, pool *pgxpool.Pool, secretName string) ([]byte, error) {
	var hexKEK string
	err := pool.QueryRow(ctx,
		`SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1`,
		secretName,
	).Scan(&hexKEK)
	if err != nil {
		return nil, fmt.Errorf("vault: fetch secret %q: %w (hint: run vault.create_secret or set ENCRYPTION_KEY)", secretName, err)
	}
	kek, err := decodeHexKEK(hexKEK)
	if err != nil {
		return nil, fmt.Errorf("vault secret %q: %w", secretName, err)
	}
	return kek, nil
}

func decodeHexKEK(raw string) ([]byte, error) {
	if len(raw) != 64 {
		return nil, errors.New("must be exactly 64 hex characters (32 bytes)")
	}
	kek, err := hex.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid hex: %w", err)
	}
	return kek, nil
}
