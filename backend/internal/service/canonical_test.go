package service

import (
	"testing"
)

func ptr(f float64) *float64 { return &f }

func TestNormalizeCanonicalName(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		// Exact map hits
		{"hb", "haemoglobin"},
		{"haemoglobin (hb)", "haemoglobin"},
		{"sgpt", "alt"},
		{"alt", "alt"},
		{"tsh", "tsh"},
		{"total cholesterol", "cholesterol_total"},
		{"ldl cholesterol", "cholesterol_ldl"},
		{"serum ferritin", "ferritin"},
		// Case-insensitive hits (trimmed lowercase key lookup)
		{"HB", "haemoglobin"},
		{"SGPT", "alt"},
		{"  SGPT ", "alt"},
		{"Hb ", "haemoglobin"},
		{"TSH", "tsh"},
		// Unknown strings → toSnakeCase fallback
		{"Random Test", "random_test"},
		{"C-Reactive Protein", "c_reactive_protein"},
		{"Uric Acid", "uric_acid"},
		// Edge cases
		{"", ""},
		{"   ", ""},
	}

	for _, tc := range cases {
		got := NormalizeCanonicalName(tc.input)
		if got != tc.want {
			t.Errorf("NormalizeCanonicalName(%q) = %q; want %q", tc.input, got, tc.want)
		}
	}
}

func TestCanonicalToDisplayName(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"haemoglobin", "Haemoglobin"},
		{"fasting_blood_sugar", "Fasting Blood Sugar"},
		{"cholesterol_ldl", "Cholesterol Ldl"},
		{"hba1c", "Hba1c"},
		{"tsh", "Tsh"},
		// Unknown canonical passthrough (just capitalised)
		{"my_custom_marker", "My Custom Marker"},
		{"unknown", "Unknown"},
	}

	for _, tc := range cases {
		got := CanonicalToDisplayName(tc.input)
		if got != tc.want {
			t.Errorf("CanonicalToDisplayName(%q) = %q; want %q", tc.input, got, tc.want)
		}
	}
}

func TestComputeIsFlagged(t *testing.T) {
	cases := []struct {
		name      string
		value     float64
		low       *float64
		high      *float64
		wantFlag  bool
	}{
		{"in range", 7.5, ptr(5.0), ptr(10.0), false},
		{"at lower bound (inclusive)", 5.0, ptr(5.0), ptr(10.0), false},
		{"at upper bound (inclusive)", 10.0, ptr(5.0), ptr(10.0), false},
		{"below low", 4.9, ptr(5.0), ptr(10.0), true},
		{"above high", 10.1, ptr(5.0), ptr(10.0), true},
		{"nil bounds", 999.0, nil, nil, false},
		{"nil low only, in range", 8.0, nil, ptr(10.0), false},
		{"nil low only, above high", 11.0, nil, ptr(10.0), true},
		{"nil high only, in range", 6.0, ptr(5.0), nil, false},
		{"nil high only, below low", 4.0, ptr(5.0), nil, true},
	}

	for _, tc := range cases {
		got := ComputeIsFlagged(tc.value, tc.low, tc.high)
		if got != tc.wantFlag {
			t.Errorf("%s: ComputeIsFlagged(%v, %v, %v) = %v; want %v",
				tc.name, tc.value, tc.low, tc.high, got, tc.wantFlag)
		}
	}
}
