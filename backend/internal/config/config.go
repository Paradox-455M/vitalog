package config

import (
	"errors"
	"os"
	"strconv"
)

type Config struct {
	Port                   string
	Env                    string
	DatabaseURL            string
	SupabaseURL            string
	SupabaseServiceRoleKey string
	SupabaseJWTSecret      string
	AnthropicAPIKey        string
	AnalyserURL            string
	RazorpayWebhookSecret  string
	RazorpayKeyID          string
	RazorpayKeySecret      string
	VaultSecretName        string
	// Plan limits (overridable without redeploy)
	FamilyLimitFree int
	FamilyLimitPro  int
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:                   getEnv("PORT", "8080"),
		Env:                    getEnv("ENV", "development"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWTSecret:      os.Getenv("SUPABASE_JWT_SECRET"),
		AnthropicAPIKey:        os.Getenv("ANTHROPIC_API_KEY"),
		AnalyserURL:            os.Getenv("ANALYSER_URL"),
		RazorpayWebhookSecret:  os.Getenv("RAZORPAY_WEBHOOK_SECRET"),
		RazorpayKeyID:          os.Getenv("RAZORPAY_KEY_ID"),
		RazorpayKeySecret:      os.Getenv("RAZORPAY_KEY_SECRET"),
		VaultSecretName:        getEnv("VAULT_SECRET_NAME", "vitalog-kek"),
		FamilyLimitFree:        getEnvInt("FAMILY_LIMIT_FREE", 1),
		FamilyLimitPro:         getEnvInt("FAMILY_LIMIT_PRO", 5),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	if c.SupabaseURL == "" {
		return errors.New("SUPABASE_URL is required")
	}
	if c.SupabaseServiceRoleKey == "" {
		return errors.New("SUPABASE_SERVICE_ROLE_KEY is required")
	}
	if c.SupabaseJWTSecret == "" {
		return errors.New("SUPABASE_JWT_SECRET is required")
	}
	if c.AnalyserURL == "" {
		return errors.New("ANALYSER_URL is required")
	}
	// L2: fail fast in production when payment webhook secret is absent
	if c.IsProduction() && c.RazorpayWebhookSecret == "" {
		return errors.New("RAZORPAY_WEBHOOK_SECRET is required in production")
	}
	if c.IsProduction() && c.RazorpayKeyID == "" {
		return errors.New("RAZORPAY_KEY_ID is required in production")
	}
	if c.IsProduction() && c.RazorpayKeySecret == "" {
		return errors.New("RAZORPAY_KEY_SECRET is required in production")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func (c *Config) IsProduction() bool {
	return c.Env == "production"
}
