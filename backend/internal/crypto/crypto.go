package crypto

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"strconv"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	dekTTL  = 5 * time.Minute
	nonceLen = 12
)

// ErrNoDEK is returned when no encryption key exists for the user.
var ErrNoDEK = errors.New("no encryption key found for user")

type cacheEntry struct {
	dek     []byte
	expires time.Time
}

// Service provides envelope encryption using a per-user DEK wrapped by a master KEK.
// All sensitive field and file encryption/decryption goes through this service.
type Service struct {
	pool  *pgxpool.Pool
	kek   []byte
	cache sync.Map
}

func NewService(pool *pgxpool.Pool, kek []byte) *Service {
	return &Service{pool: pool, kek: kek}
}

// Encrypt encrypts plaintext for the given user using AES-256-GCM.
// Output format: [ 12-byte nonce | ciphertext | 16-byte GCM tag ]
func (s *Service) Encrypt(ctx context.Context, userID uuid.UUID, plaintext []byte) ([]byte, error) {
	dek, err := s.getOrCreateDEK(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("encrypt: get dek: %w", err)
	}
	return aesgcmEncrypt(dek, plaintext)
}

// Decrypt decrypts ciphertext for the given user.
// Uses getOrCreateDEK so that reads for users without a DEK yet always succeed.
func (s *Service) Decrypt(ctx context.Context, userID uuid.UUID, ciphertext []byte) ([]byte, error) {
	dek, err := s.getOrCreateDEK(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("decrypt: get dek: %w", err)
	}
	return aesgcmDecrypt(dek, ciphertext)
}

// EncryptString is a convenience wrapper for string fields.
func (s *Service) EncryptString(ctx context.Context, userID uuid.UUID, v string) ([]byte, error) {
	return s.Encrypt(ctx, userID, []byte(v))
}

// DecryptToString decrypts and returns a string. Returns "" if data is nil.
// Falls back to treating data as a raw UTF-8 string for rows written before
// encryption was added (plaintext BYTEA from the schema migration).
func (s *Service) DecryptToString(ctx context.Context, userID uuid.UUID, data []byte) (string, error) {
	if len(data) == 0 {
		return "", nil
	}
	// Data shorter than the minimum ciphertext size cannot be AES-GCM output.
	if len(data) < nonceLen+16 {
		if utf8.Valid(data) {
			return string(data), nil
		}
		return "", fmt.Errorf("data too short to decrypt and not valid UTF-8 (%d bytes)", len(data))
	}
	plain, err := s.Decrypt(ctx, userID, data)
	if err != nil {
		// GCM auth failure on legacy plaintext BYTEA — return as-is if valid UTF-8.
		if utf8.Valid(data) {
			return string(data), nil
		}
		return "", err
	}
	return string(plain), nil
}

// EncryptFloat64 formats a float64 as a string and encrypts it.
func (s *Service) EncryptFloat64(ctx context.Context, userID uuid.UUID, v float64) ([]byte, error) {
	return s.Encrypt(ctx, userID, []byte(strconv.FormatFloat(v, 'f', -1, 64)))
}

// DecryptToFloat64 decrypts and parses a float64.
// Falls back to parsing the raw bytes as a float for rows written before
// encryption was added (plaintext BYTEA from the schema migration).
func (s *Service) DecryptToFloat64(ctx context.Context, userID uuid.UUID, data []byte) (float64, error) {
	// Short plaintext BYTEA can't be ciphertext — try direct parse first.
	if len(data) < nonceLen+16 {
		if v, err := strconv.ParseFloat(string(data), 64); err == nil {
			return v, nil
		}
	}
	plain, err := s.Decrypt(ctx, userID, data)
	if err != nil {
		// GCM auth failure on legacy plaintext BYTEA — try parsing raw bytes.
		if v, parseErr := strconv.ParseFloat(string(data), 64); parseErr == nil {
			return v, nil
		}
		return 0, err
	}
	v, err := strconv.ParseFloat(string(plain), 64)
	if err != nil {
		return 0, fmt.Errorf("decrypt float64: parse %q: %w", string(plain), err)
	}
	return v, nil
}

// EncryptOptFloat64 encrypts a *float64, returning nil if the pointer is nil.
func (s *Service) EncryptOptFloat64(ctx context.Context, userID uuid.UUID, v *float64) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	return s.EncryptFloat64(ctx, userID, *v)
}

// DecryptToOptFloat64 decrypts optional BYTEA into *float64. Returns nil if data is nil.
func (s *Service) DecryptToOptFloat64(ctx context.Context, userID uuid.UUID, data []byte) (*float64, error) {
	if len(data) == 0 {
		return nil, nil
	}
	v, err := s.DecryptToFloat64(ctx, userID, data)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// EncryptOptString encrypts a *string, returning nil if the pointer is nil.
func (s *Service) EncryptOptString(ctx context.Context, userID uuid.UUID, v *string) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	return s.EncryptString(ctx, userID, *v)
}

// DecryptToOptString decrypts optional BYTEA into *string. Returns nil if data is nil.
func (s *Service) DecryptToOptString(ctx context.Context, userID uuid.UUID, data []byte) (*string, error) {
	if len(data) == 0 {
		return nil, nil
	}
	v, err := s.DecryptToString(ctx, userID, data)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// EnsureDEK creates a DEK for the user if one does not exist.
func (s *Service) EnsureDEK(ctx context.Context, userID uuid.UUID) error {
	_, err := s.getOrCreateDEK(ctx, userID)
	return err
}

func (s *Service) getOrCreateDEK(ctx context.Context, userID uuid.UUID) ([]byte, error) {
	if entry, ok := s.cache.Load(userID); ok {
		e := entry.(cacheEntry)
		if time.Now().Before(e.expires) {
			return e.dek, nil
		}
		s.cache.Delete(userID)
	}

	dek, err := s.fetchDEK(ctx, userID)
	if err == nil {
		s.storeCached(userID, dek)
		return dek, nil
	}
	if !errors.Is(err, ErrNoDEK) {
		return nil, err
	}

	// No DEK yet — generate and persist.
	dek = make([]byte, 32)
	if _, err := rand.Read(dek); err != nil {
		return nil, fmt.Errorf("generate dek: %w", err)
	}
	encDEK, err := aesgcmEncrypt(s.kek, dek)
	if err != nil {
		return nil, fmt.Errorf("wrap dek: %w", err)
	}
	_, err = s.pool.Exec(ctx,
		`INSERT INTO user_keys (user_id, encrypted_dek) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
		userID, encDEK)
	if err != nil {
		return nil, fmt.Errorf("persist dek: %w", err)
	}
	s.storeCached(userID, dek)
	return dek, nil
}

func (s *Service) getDEK(ctx context.Context, userID uuid.UUID) ([]byte, error) {
	if entry, ok := s.cache.Load(userID); ok {
		e := entry.(cacheEntry)
		if time.Now().Before(e.expires) {
			return e.dek, nil
		}
		s.cache.Delete(userID)
	}
	dek, err := s.fetchDEK(ctx, userID)
	if err != nil {
		return nil, err
	}
	s.storeCached(userID, dek)
	return dek, nil
}

func (s *Service) fetchDEK(ctx context.Context, userID uuid.UUID) ([]byte, error) {
	var encDEK []byte
	err := s.pool.QueryRow(ctx,
		`SELECT encrypted_dek FROM user_keys WHERE user_id = $1`, userID).Scan(&encDEK)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, ErrNoDEK
		}
		return nil, fmt.Errorf("fetch dek: %w", err)
	}
	dek, err := aesgcmDecrypt(s.kek, encDEK)
	if err != nil {
		return nil, fmt.Errorf("unwrap dek: %w", err)
	}
	return dek, nil
}

func (s *Service) storeCached(userID uuid.UUID, dek []byte) {
	s.cache.Store(userID, cacheEntry{dek: dek, expires: time.Now().Add(dekTTL)})
}

// aesgcmEncrypt encrypts plaintext with AES-256-GCM using a random nonce.
// Output: [nonce(12) | ciphertext | tag(16)]
func aesgcmEncrypt(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, nonceLen)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	ct := gcm.Seal(nonce, nonce, plaintext, nil)
	return ct, nil
}

// aesgcmDecrypt decrypts ciphertext produced by aesgcmEncrypt.
func aesgcmDecrypt(key, data []byte) ([]byte, error) {
	if len(data) < nonceLen+16 {
		return nil, fmt.Errorf("ciphertext too short: %d bytes", len(data))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce, ct := data[:nonceLen], data[nonceLen:]
	return gcm.Open(nil, nonce, ct, nil)
}
