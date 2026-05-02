package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"path/filepath"
	"strings"
	"time"
)

type PipelineFinding struct {
	CanonicalName    string   `json:"canonical_name"`
	DisplayName      string   `json:"display_name"`
	Status           string   `json:"status"`
	FlagDirection    *string  `json:"flag_direction"`
	Value            *float64 `json:"value"`
	Unit             string   `json:"unit"`
	ReferenceRange   *string  `json:"reference_range"`
	PlainExplanation string   `json:"plain_explanation"`
	PlainResult      string   `json:"plain_result"`
	Severity         string   `json:"severity"`
}

type PipelinePatientInfo struct {
	Name       *string `json:"name"`
	Age        *int    `json:"age"`
	Gender     *string `json:"gender"`
	LabName    *string `json:"labName"`
	ReportDate *string `json:"reportDate"`
}

type PipelineLayer1 struct {
	PatientInfo PipelinePatientInfo `json:"patientInfo"`
}

type PipelineLayer2 struct {
	Summary            string            `json:"summary"`
	OverallStatus      string            `json:"overall_status"`
	Findings           []PipelineFinding `json:"findings"`
	AllClearSummary    string            `json:"all_clear_summary"`
	WhatToDoNext       string            `json:"what_to_do_next"`
	PossibleRootCauses []string          `json:"possible_root_causes"`
	HasPendingTests    bool              `json:"has_pending_tests"`
	PendingNote        *string           `json:"pending_note"`
}

type PipelineResult struct {
	Layer1 PipelineLayer1 `json:"layer1"`
	Layer2 PipelineLayer2 `json:"layer2"`
}

type AnalyserService struct {
	baseURL string
	client  *http.Client
}

func NewAnalyserService(baseURL string) *AnalyserService {
	return &AnalyserService{
		baseURL: strings.TrimSuffix(baseURL, "/"),
		client: &http.Client{
			Timeout: 18 * time.Minute,
		},
	}
}

func mimeTypeFromFilename(fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	default:
		if t := mime.TypeByExtension(ext); t != "" {
			return t
		}
		return "application/octet-stream"
	}
}

// buildMultipartBody constructs the multipart form body for the analyser.
// extraFields is a map of additional text fields to add to the form.
func buildMultipartBody(fileName string, fileBytes []byte, extraFields map[string]string) (bodyBytes []byte, contentType string, err error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	mimeType := mimeTypeFromFilename(fileName)
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="reportFile"; filename="%s"`, fileName))
	h.Set("Content-Type", mimeType)
	part, err := writer.CreatePart(h)
	if err != nil {
		return nil, "", fmt.Errorf("create form file: %w", err)
	}
	if _, err := part.Write(fileBytes); err != nil {
		return nil, "", fmt.Errorf("write file bytes: %w", err)
	}

	for k, v := range extraFields {
		if err := writer.WriteField(k, v); err != nil {
			return nil, "", fmt.Errorf("write field %s: %w", k, err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, "", fmt.Errorf("close multipart writer: %w", err)
	}

	return body.Bytes(), writer.FormDataContentType(), nil
}

func (s *AnalyserService) AnalyzeFile(ctx context.Context, fileName string, fileBytes []byte) (*PipelineResult, error) {
	bodyBytes, contentType, err := buildMultipartBody(fileName, fileBytes, nil)
	if err != nil {
		return nil, err
	}

	const maxAttempts = 3
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(2 * time.Second):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/api/pipeline-file", bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, fmt.Errorf("create analyser request: %w", err)
		}
		req.Header.Set("Content-Type", contentType)

		result, err := s.doRequest(req)
		if err == nil {
			return result, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

// AnalyzeFileAsync submits the file to the analyser's async endpoint, which returns 202
// immediately and will POST the result to callbackURL when processing is complete.
func (s *AnalyserService) AnalyzeFileAsync(ctx context.Context, fileName string, fileBytes []byte, callbackURL string) error {
	bodyBytes, contentType, err := buildMultipartBody(fileName, fileBytes, map[string]string{
		"callbackUrl": callbackURL,
	})
	if err != nil {
		return err
	}

	// Short deadline — we only need the 202 accept, not the full LLM response.
	callCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(callCtx, http.MethodPost, s.baseURL+"/api/pipeline-file-async", bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("create async analyser request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("call analyser async: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("analyser async returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return nil
}

func (s *AnalyserService) doRequest(req *http.Request) (*PipelineResult, error) {
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call analyser: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		message := strings.TrimSpace(string(body))
		if message == "" {
			return nil, fmt.Errorf("analyser returned status %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("analyser returned status %d: %s", resp.StatusCode, message)
	}

	var result PipelineResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("parse analyser result: %w", err)
	}

	return &result, nil
}
