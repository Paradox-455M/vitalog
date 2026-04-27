package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func computeHMAC(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func newRazorpayHandler(secret string) *RazorpayHandler {
	return &RazorpayHandler{webhookSecret: secret}
}

func TestVerifySignature(t *testing.T) {
	secret := "test_webhook_secret_key"
	body := []byte(`{"event":"payment.captured"}`)
	correctSig := computeHMAC(body, secret)

	t.Run("correct HMAC of body with matching secret", func(t *testing.T) {
		h := newRazorpayHandler(secret)
		if !h.verifySignature(body, correctSig) {
			t.Error("expected true for correct signature, got false")
		}
	})

	t.Run("valid body but wrong secret", func(t *testing.T) {
		h := newRazorpayHandler("different_secret")
		if h.verifySignature(body, correctSig) {
			t.Error("expected false for wrong secret, got true")
		}
	})

	t.Run("correct HMAC but body tampered", func(t *testing.T) {
		h := newRazorpayHandler(secret)
		tampered := []byte(`{"event":"payment.captured","extra":"injected"}`)
		if h.verifySignature(tampered, correctSig) {
			t.Error("expected false for tampered body, got true")
		}
	})

	t.Run("empty body with correct HMAC of empty", func(t *testing.T) {
		h := newRazorpayHandler(secret)
		emptySig := computeHMAC([]byte{}, secret)
		if !h.verifySignature([]byte{}, emptySig) {
			t.Error("expected true for correct HMAC of empty body, got false")
		}
	})

	t.Run("empty webhook secret always returns false", func(t *testing.T) {
		h := newRazorpayHandler("")
		if h.verifySignature(body, correctSig) {
			t.Error("expected false when webhookSecret is empty, got true")
		}
	})
}
