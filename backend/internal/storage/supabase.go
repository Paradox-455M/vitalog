package storage

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type SupabaseStorage struct {
	baseURL        string
	serviceRoleKey string
	client         *http.Client
}

func NewSupabaseStorage(supabaseURL, serviceRoleKey string) *SupabaseStorage {
	return &SupabaseStorage{
		baseURL:        strings.TrimSuffix(supabaseURL, "/") + "/storage/v1",
		serviceRoleKey: serviceRoleKey,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

type SignedURLResponse struct {
	SignedURL string `json:"signedURL"`
}

type UploadResponse struct {
	Key string `json:"Key"`
}

func (s *SupabaseStorage) Upload(bucket, path string, data []byte, contentType string) error {
	url := fmt.Sprintf("%s/object/%s/%s", s.baseURL, bucket, path)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create upload request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (s *SupabaseStorage) Download(bucket, path string) ([]byte, error) {
	url := fmt.Sprintf("%s/object/%s/%s", s.baseURL, bucket, path)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create download request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("download failed with status %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func (s *SupabaseStorage) CreateSignedURL(bucket, path string, expiresIn int) (string, error) {
	url := fmt.Sprintf("%s/object/sign/%s/%s", s.baseURL, bucket, path)

	body := map[string]int{"expiresIn": expiresIn}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create signed URL request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to create signed URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("signed URL creation failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SignedURLResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode signed URL response: %w", err)
	}

	baseURL := strings.Replace(s.baseURL, "/storage/v1", "", 1)
	return baseURL + "/storage/v1" + result.SignedURL, nil
}

func (s *SupabaseStorage) Delete(bucket, path string) error {
	url := fmt.Sprintf("%s/object/%s/%s", s.baseURL, bucket, path)

	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
