package model

import (
	"time"

	"github.com/google/uuid"
)

const (
	ExtractionStatusPending    = "pending"
	ExtractionStatusProcessing = "processing"
	ExtractionStatusComplete   = "complete"
	ExtractionStatusFailed     = "failed"
)

type Profile struct {
	ID        uuid.UUID  `json:"id"`
	CreatedAt time.Time  `json:"created_at"`
	Email     string     `json:"email"`
	FullName  string     `json:"full_name"`
	AvatarURL *string    `json:"avatar_url"`
	Plan      string     `json:"plan"`
}

type FamilyMember struct {
	ID           uuid.UUID  `json:"id"`
	OwnerID      uuid.UUID  `json:"owner_id"`
	Name         string     `json:"name"`
	Relationship *string    `json:"relationship"`
	DateOfBirth  *time.Time `json:"date_of_birth"`
	CreatedAt    time.Time  `json:"created_at"`
}

type Document struct {
	ID               uuid.UUID  `json:"id"`
	OwnerID          uuid.UUID  `json:"owner_id"`
	FamilyMemberID   *uuid.UUID `json:"family_member_id"`
	StoragePath      string     `json:"storage_path"`
	FileName         string     `json:"file_name"`
	FileType         *string    `json:"file_type"`
	DocumentType     *string    `json:"document_type"`
	ReportDate       *time.Time `json:"report_date"`
	LabName          *string    `json:"lab_name"`
	ExtractionStatus string     `json:"extraction_status"`
	ExplanationText  *string    `json:"explanation_text"`
	CreatedAt        time.Time  `json:"created_at"`
	DeletedAt        *time.Time `json:"deleted_at"`
}

type HealthValue struct {
	ID             uuid.UUID  `json:"id"`
	DocumentID     uuid.UUID  `json:"document_id"`
	FamilyMemberID *uuid.UUID `json:"family_member_id"`
	CanonicalName  string     `json:"canonical_name"`
	DisplayName    string     `json:"display_name"`
	Value          float64    `json:"value"`
	Unit           *string    `json:"unit"`
	ReferenceLow   *float64   `json:"reference_low"`
	ReferenceHigh  *float64   `json:"reference_high"`
	IsFlagged      bool       `json:"is_flagged"`
	ReportDate     time.Time  `json:"report_date"`
	CreatedAt      time.Time  `json:"created_at"`
}

type DocumentWithHealthValues struct {
	Document
	HealthValues []HealthValue `json:"health_values"`
}

type TimelinePoint struct {
	ReportDate time.Time `json:"report_date"`
	Value      float64   `json:"value"`
	DocumentID uuid.UUID `json:"document_id"`
}

type TimelineData struct {
	CanonicalName string          `json:"canonical_name"`
	DisplayName   string          `json:"display_name"`
	Unit          *string         `json:"unit"`
	ReferenceLow  *float64        `json:"reference_low"`
	ReferenceHigh *float64        `json:"reference_high"`
	Points        []TimelinePoint `json:"points"`
}

type CreateDocumentRequest struct {
	FamilyMemberID *uuid.UUID `json:"family_member_id"`
	FileName       string     `json:"file_name"`
	FileType       string     `json:"file_type"`
}

type CreateFamilyMemberRequest struct {
	Name         string  `json:"name"`
	Relationship *string `json:"relationship"`
	DateOfBirth  *string `json:"date_of_birth"`
}

type UpdateFamilyMemberRequest struct {
	Name         *string `json:"name"`
	Relationship *string `json:"relationship"`
	DateOfBirth  *string `json:"date_of_birth"`
}

type UpdateProfileRequest struct {
	FullName  *string `json:"full_name"`
	AvatarURL *string `json:"avatar_url"`
}

type HealthValuesFilter struct {
	FamilyMemberID *uuid.UUID `json:"family_member_id"`
	CanonicalName  *string    `json:"canonical_name"`
	FromDate       *time.Time `json:"from_date"`
	ToDate         *time.Time `json:"to_date"`
	Limit          int        `json:"limit"`
}

type DocumentsFilter struct {
	FamilyMemberID *uuid.UUID `json:"family_member_id"`
	DocumentType   *string    `json:"document_type"`
	Status         *string    `json:"status"`
	FromDate       *time.Time `json:"from_date"`
	ToDate         *time.Time `json:"to_date"`
	Search         *string    `json:"search"`    // ILIKE on file_name OR lab_name
	LabName        *string    `json:"lab_name"`  // exact lab_name match
	Limit          int        `json:"limit"`     // default 20, max 100
	Offset         int        `json:"offset"`    // default 0
}

// FlaggedValueSummary is the slim per-biomarker payload embedded in list responses.
type FlaggedValueSummary struct {
	CanonicalName string   `json:"canonical_name"`
	DisplayName   string   `json:"display_name"`
	Value         float64  `json:"value"`
	Unit          *string  `json:"unit"`
	IsFlagged     bool     `json:"is_flagged"`
}

// DocumentListItem is a Document with a pre-computed flagged-value summary for list views.
type DocumentListItem struct {
	Document
	FlaggedCount  int                   `json:"flagged_count"`
	FlaggedValues []FlaggedValueSummary `json:"flagged_values"`
}

// PaginatedDocuments is the envelope returned by GET /api/documents.
type PaginatedDocuments struct {
	Items  []DocumentListItem `json:"items"`
	Total  int                `json:"total"`
	Limit  int                `json:"limit"`
	Offset int                `json:"offset"`
}

// DashboardStats is the payload returned by GET /api/dashboard/stats.
type DashboardStats struct {
	ReportCount   int        `json:"report_count"`
	ValuesTracked int        `json:"values_tracked"`
	FlaggedCount  int        `json:"flagged_count"`
	LastUploadAt  *time.Time `json:"last_upload_at"`
}

// AccessEvent is a privacy audit row (sign-in / session registration).
type AccessEvent struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	CreatedAt   time.Time `json:"created_at"`
	IPAddress   *string   `json:"ip_address"`
	UserAgent   *string   `json:"user_agent"`
	EventType   string    `json:"event_type"`
}

// PaymentEvent is a recorded Razorpay payment (e.g. payment.captured).
type PaymentEvent struct {
	ID                 uuid.UUID `json:"id"`
	UserID             uuid.UUID `json:"user_id"`
	RazorpayPaymentID  string    `json:"razorpay_payment_id"`
	AmountPaise        int       `json:"amount_paise"`
	Currency           string    `json:"currency"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
}
