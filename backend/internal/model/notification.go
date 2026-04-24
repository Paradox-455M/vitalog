package model

import (
	"bytes"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// NotificationPreferences is stored in profiles.notification_preferences (JSONB).
// JSON keys are snake_case to match the API.
type NotificationPreferences struct {
	NewReport     bool   `json:"new_report"`
	TrendDetected bool   `json:"trend_detected"`
	FamilyUpdates bool   `json:"family_updates"`
	HealthTips    bool   `json:"health_tips"`
	Email         bool   `json:"email"`
	Push          bool   `json:"push"`
	Whatsapp      bool   `json:"whatsapp"`
	Tone          string `json:"tone"`
}

// DefaultNotificationPreferences matches the frontend initial state.
func DefaultNotificationPreferences() NotificationPreferences {
	return NotificationPreferences{
		NewReport:     true,
		TrendDetected: true,
		FamilyUpdates: false,
		HealthTips:    true,
		Email:         true,
		Push:          true,
		Whatsapp:      false,
		Tone:          "soft",
	}
}

// ParseNotificationPreferences merges JSON from DB (possibly partial) with defaults.
func ParseNotificationPreferences(raw []byte) (NotificationPreferences, error) {
	d := DefaultNotificationPreferences()
	if len(bytes.TrimSpace(raw)) == 0 {
		return d, nil
	}
	var overlay map[string]json.RawMessage
	if err := json.Unmarshal(raw, &overlay); err != nil {
		return d, err
	}
	apply := func(key string, dest interface{}) {
		if b, ok := overlay[key]; ok {
			_ = json.Unmarshal(b, dest)
		}
	}
	apply("new_report", &d.NewReport)
	apply("trend_detected", &d.TrendDetected)
	apply("family_updates", &d.FamilyUpdates)
	apply("health_tips", &d.HealthTips)
	apply("email", &d.Email)
	apply("push", &d.Push)
	apply("whatsapp", &d.Whatsapp)
	apply("tone", &d.Tone)
	return normalizeNotificationPreferences(d), nil
}

func normalizeNotificationPreferences(p NotificationPreferences) NotificationPreferences {
	def := DefaultNotificationPreferences()
	if p.Tone != "direct" && p.Tone != "soft" {
		if p.Tone == "" {
			p.Tone = def.Tone
		} else {
			p.Tone = def.Tone
		}
	}
	return p
}

// NormalizeNotificationPreferencesStruct validates tone and defaults after a full client PUT.
func NormalizeNotificationPreferencesStruct(p NotificationPreferences) NotificationPreferences {
	return normalizeNotificationPreferences(p)
}

// InAppNotification is a row in in_app_notifications.
type InAppNotification struct {
	ID                uuid.UUID       `json:"id"`
	OwnerID           uuid.UUID       `json:"owner_id"`
	Kind              string          `json:"kind"`
	Title             string          `json:"title"`
	Body              string          `json:"body"`
	ReadAt            *time.Time      `json:"read_at"`
	SourceDocumentID  *uuid.UUID      `json:"source_document_id,omitempty"`
	Metadata          json.RawMessage `json:"metadata,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
}
