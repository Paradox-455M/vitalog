package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

type PipelineResult struct {
	Layer1 struct {
		PatientInfo struct {
			Name       *string `json:"name"`
			Age        *int    `json:"age"`
			Gender     *string `json:"gender"`
			LabName    *string `json:"labName"`
			ReportDate *string `json:"reportDate"`
		} `json:"patientInfo"`
	} `json:"layer1"`
	Layer2 struct {
		Summary            string            `json:"summary"`
		OverallStatus      string            `json:"overall_status"`
		Findings           []PipelineFinding `json:"findings"`
		AllClearSummary    string            `json:"all_clear_summary"`
		WhatToDoNext       string            `json:"what_to_do_next"`
		PossibleRootCauses []string          `json:"possible_root_causes"`
		HasPendingTests    bool              `json:"has_pending_tests"`
		PendingNote        *string           `json:"pending_note"`
	} `json:"layer2"`
}

type analyserEvent struct {
	Type    string          `json:"type"`
	Message string          `json:"message"`
	Raw     json.RawMessage `json:"-"`
}

type AnalyserService struct {
	baseURL string
	client  *http.Client
}

func NewAnalyserService(baseURL string) *AnalyserService {
	return &AnalyserService{
		baseURL: strings.TrimSuffix(baseURL, "/"),
		client: &http.Client{
			Timeout: 5 * time.Minute,
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

func (s *AnalyserService) AnalyzeFile(ctx context.Context, fileName string, fileBytes []byte) (*PipelineResult, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	mimeType := mimeTypeFromFilename(fileName)
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="reportFile"; filename="%s"`, fileName))
	h.Set("Content-Type", mimeType)
	part, err := writer.CreatePart(h)
	if err != nil {
		return nil, fmt.Errorf("create form file: %w", err)
	}
	if _, err := part.Write(fileBytes); err != nil {
		return nil, fmt.Errorf("write file bytes: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart writer: %w", err)
	}

	// Snapshot body bytes so we can re-create the reader on each retry attempt.
	bodyBytes := body.Bytes()
	contentType := writer.FormDataContentType()

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

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/api/pipeline-file-stream", bytes.NewReader(bodyBytes))
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

func (s *AnalyserService) doRequest(req *http.Request) (*PipelineResult, error) {
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call analyser: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("analyser returned status %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)

	var result *PipelineResult
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "" {
			continue
		}

		var generic map[string]json.RawMessage
		if err := json.Unmarshal([]byte(payload), &generic); err != nil {
			continue
		}

		var eventType string
		if rawType, ok := generic["type"]; ok {
			_ = json.Unmarshal(rawType, &eventType)
		}

		if eventType == "error" {
			var message string
			if rawMsg, ok := generic["message"]; ok {
				_ = json.Unmarshal(rawMsg, &message)
			}
			if message == "" {
				message = "analyser pipeline error"
			}
			return nil, fmt.Errorf("%s", message)
		}

		if eventType == "result" {
			var parsed PipelineResult
			if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
				return nil, fmt.Errorf("parse analyser result: %w", err)
			}
			result = &parsed
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read analyser stream: %w", err)
	}
	if result == nil {
		return nil, fmt.Errorf("no analyser result received")
	}

	return result, nil
}
