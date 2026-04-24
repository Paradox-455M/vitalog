package migrate

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed sql/schema.sql
var schema string

// Run applies the embedded schema SQL against the database.
// All statements are idempotent — safe to call on every startup.
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, schema); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}
	return nil
}
