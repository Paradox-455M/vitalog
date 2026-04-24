package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

// NewKeyfunc builds a jwt.Keyfunc with no silent algorithm fallback.
//
// Local Supabase (localhost/127.0.0.1 URL): uses HS256 HMAC directly.
// Remote Supabase: fetches JWKS on startup and uses ES256 exclusively.
// Fails hard if JWKS cannot be fetched for a remote project — fail closed,
// never fall back to HMAC in production.
func NewKeyfunc(supabaseURL, jwtSecret string) jwt.Keyfunc {
	isLocal := strings.Contains(supabaseURL, "localhost") || strings.Contains(supabaseURL, "127.0.0.1")

	if isLocal {
		return func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		}
	}

	// Remote: fetch JWKS once at startup. Panic if unreachable — the server
	// cannot safely authenticate users without the public key.
	ecKey, err := fetchECPublicKey(supabaseURL)
	if err != nil {
		panic(fmt.Sprintf("failed to fetch JWKS from remote Supabase (%s): %v — set SUPABASE_URL to a reachable project or use localhost for local dev", supabaseURL, err))
	}

	return func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return ecKey, nil
	}
}

func fetchECPublicKey(supabaseURL string) (*ecdsa.PublicKey, error) {
	resp, err := http.Get(supabaseURL + "/auth/v1/.well-known/jwks.json")
	if err != nil {
		return nil, fmt.Errorf("fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS endpoint returned %d", resp.StatusCode)
	}

	var keys jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&keys); err != nil {
		return nil, fmt.Errorf("decode JWKS: %w", err)
	}

	for _, k := range keys.Keys {
		if k.Kty == "EC" && (k.Alg == "ES256" || k.Crv == "P-256") {
			xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
			if err != nil {
				return nil, fmt.Errorf("decode JWKS x: %w", err)
			}
			yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
			if err != nil {
				return nil, fmt.Errorf("decode JWKS y: %w", err)
			}
			return &ecdsa.PublicKey{
				Curve: elliptic.P256(),
				X:     new(big.Int).SetBytes(xBytes),
				Y:     new(big.Int).SetBytes(yBytes),
			}, nil
		}
	}

	return nil, fmt.Errorf("no EC P-256 key found in JWKS")
}
