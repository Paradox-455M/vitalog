package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAnalyserServiceAnalyzeFileUsesDirectJSONEndpoint(t *testing.T) {
	var gotPath string
	var gotFileName string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		if gotPath != "/api/pipeline-file" {
			http.NotFound(w, r)
			return
		}
		if err := r.ParseMultipartForm(2 << 20); err != nil {
			t.Fatalf("parse multipart form: %v", err)
		}
		file, header, err := r.FormFile("reportFile")
		if err != nil {
			t.Fatalf("read reportFile part: %v", err)
		}
		_ = file.Close()
		gotFileName = header.Filename

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{
			"layer1": map[string]any{
				"patientInfo": map[string]any{
					"labName": "Lal PathLabs Ltd",
				},
			},
			"layer2": map[string]any{
				"summary":        "Summary",
				"overall_status": "attention_needed",
				"findings": []map[string]any{
					{
						"canonical_name":    "haemoglobin",
						"display_name":      "Hemoglobin",
						"status":            "flagged",
						"value":             11.8,
						"unit":              "g/dL",
						"reference_range":   "12.00 - 15.00 g/dL",
						"plain_explanation": "Hemoglobin carries oxygen.",
						"plain_result":      "Low.",
						"severity":          "attention",
					},
				},
			},
		}); err != nil {
			t.Fatalf("encode response: %v", err)
		}
	}))
	defer server.Close()

	svc := NewAnalyserService(server.URL)
	result, err := svc.AnalyzeFile(context.Background(), "report.pdf", []byte("%PDF-1.4"))
	if err != nil {
		t.Fatalf("AnalyzeFile returned error: %v", err)
	}
	if gotPath != "/api/pipeline-file" {
		t.Fatalf("path = %q, want /api/pipeline-file", gotPath)
	}
	if gotFileName != "report.pdf" {
		t.Fatalf("filename = %q, want report.pdf", gotFileName)
	}
	if result.Layer1.PatientInfo.LabName == nil || *result.Layer1.PatientInfo.LabName != "Lal PathLabs Ltd" {
		t.Fatalf("lab name = %v, want Lal PathLabs Ltd", result.Layer1.PatientInfo.LabName)
	}
	if len(result.Layer2.Findings) != 1 {
		t.Fatalf("findings len = %d, want 1", len(result.Layer2.Findings))
	}
	if result.Layer2.Findings[0].ReferenceRange == nil || *result.Layer2.Findings[0].ReferenceRange != "12.00 - 15.00 g/dL" {
		t.Fatalf("reference range = %v, want 12.00 - 15.00 g/dL", result.Layer2.Findings[0].ReferenceRange)
	}
}

func TestAnalyserServiceAnalyzeFileReportsNon2xxBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "analyser unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	svc := NewAnalyserService(server.URL)
	_, err := svc.AnalyzeFile(context.Background(), "report.pdf", []byte("%PDF-1.4"))
	if err == nil {
		t.Fatal("AnalyzeFile returned nil error, want non-2xx error")
	}
	if !strings.Contains(err.Error(), "503") || !strings.Contains(err.Error(), "analyser unavailable") {
		t.Fatalf("error = %q, want status and response body", err.Error())
	}
}
