package handler

import (
	"testing"
)

func ptrStr(s string) *string { return &s }

func TestValidateMagicBytes(t *testing.T) {
	cases := []struct {
		name    string
		data    []byte
		wantErr bool
	}{
		// Valid types
		{
			name:    "valid PDF header",
			data:    []byte("%PDF-1.4 rest of file..."),
			wantErr: false,
		},
		{
			name:    "valid JPEG header",
			data:    []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10},
			wantErr: false,
		},
		{
			name:    "valid PNG header",
			data:    []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x00},
			wantErr: false,
		},
		{
			name:    "valid WebP header",
			data:    append([]byte("RIFF\x00\x00\x00\x00WEBP"), make([]byte, 20)...),
			wantErr: false,
		},
		// Invalid types
		{
			name:    "random bytes",
			data:    []byte{0x00, 0x01, 0x02, 0x03, 0x04, 0x05},
			wantErr: true,
		},
		{
			name:    "ELF executable header",
			data:    []byte{0x7F, 'E', 'L', 'F', 0x02},
			wantErr: true,
		},
		{
			name:    "ZIP file header (not accepted)",
			data:    []byte{0x50, 0x4B, 0x03, 0x04, 0x00},
			wantErr: true,
		},
		// Edge cases
		{
			name:    "fewer than 4 bytes",
			data:    []byte{0xFF, 0xD8},
			wantErr: true,
		},
		{
			name:    "exactly 3 bytes",
			data:    []byte{0x89, 0x50, 0x4E},
			wantErr: true,
		},
		{
			name:    "empty data",
			data:    []byte{},
			wantErr: true,
		},
		{
			name:    "RIFF header without WEBP marker",
			data:    append([]byte("RIFF\x00\x00\x00\x00AVI "), make([]byte, 20)...),
			wantErr: true,
		},
	}

	for _, tc := range cases {
		err := validateMagicBytes(tc.data)
		if (err != nil) != tc.wantErr {
			t.Errorf("%s: validateMagicBytes() error = %v, wantErr %v", tc.name, err, tc.wantErr)
		}
	}
}

func TestParseRangeBounds(t *testing.T) {
	cases := []struct {
		name     string
		input    *string
		wantLow  *float64
		wantHigh *float64
	}{
		{
			name:     "nil input",
			input:    nil,
			wantLow:  nil,
			wantHigh: nil,
		},
		{
			name:     "standard range 5.0-10.5",
			input:    ptrStr("5.0-10.5"),
			wantLow:  floatPtr(5.0),
			wantHigh: floatPtr(10.5),
		},
		{
			name:     "integer range 70-100",
			input:    ptrStr("70-100"),
			wantLow:  floatPtr(70.0),
			wantHigh: floatPtr(100.0),
		},
		{
			name:     "less than prefix <100",
			input:    ptrStr("<100"),
			wantLow:  nil,
			wantHigh: floatPtr(100.0),
		},
		{
			name:     "less than prefix <5.5",
			input:    ptrStr("<5.5"),
			wantLow:  nil,
			wantHigh: floatPtr(5.5),
		},
		{
			name:     "greater than prefix >80",
			input:    ptrStr(">80"),
			wantLow:  floatPtr(80.0),
			wantHigh: nil,
		},
		{
			name:     "malformed string abc",
			input:    ptrStr("abc"),
			wantLow:  nil,
			wantHigh: nil,
		},
		{
			name:     "empty string",
			input:    ptrStr(""),
			wantLow:  nil,
			wantHigh: nil,
		},
		{
			name:     "whitespace only",
			input:    ptrStr("   "),
			wantLow:  nil,
			wantHigh: nil,
		},
		{
			name:     "en-dash range (Unicode em-dash substitute)",
			input:    ptrStr("5.0\u20135.5"), // en-dash U+2013
			wantLow:  floatPtr(5.0),
			wantHigh: floatPtr(5.5),
		},
	}

	for _, tc := range cases {
		gotLow, gotHigh := parseRangeBounds(tc.input)
		if !floatPtrEqual(gotLow, tc.wantLow) {
			t.Errorf("%s: low = %v; want %v", tc.name, derefFloat(gotLow), derefFloat(tc.wantLow))
		}
		if !floatPtrEqual(gotHigh, tc.wantHigh) {
			t.Errorf("%s: high = %v; want %v", tc.name, derefFloat(gotHigh), derefFloat(tc.wantHigh))
		}
	}
}

// helpers

func floatPtr(f float64) *float64 { return &f }

func floatPtrEqual(a, b *float64) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func derefFloat(f *float64) interface{} {
	if f == nil {
		return nil
	}
	return *f
}
