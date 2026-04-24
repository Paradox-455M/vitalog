package supabaseauth

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AdminClient calls Supabase Auth admin endpoints with the service role key.
type AdminClient struct {
	baseURL        string
	serviceRoleKey string
	httpClient     *http.Client
}

func NewAdminClient(supabaseURL, serviceRoleKey string) *AdminClient {
	return &AdminClient{
		baseURL:        strings.TrimSuffix(supabaseURL, "/"),
		serviceRoleKey: serviceRoleKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// DeleteUser removes the auth user (cascades app data per FKs). Call only after storage cleanup.
func (c *AdminClient) DeleteUser(userID string) error {
	url := fmt.Sprintf("%s/auth/v1/admin/users/%s", c.baseURL, userID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", c.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase admin delete user: %s: %s", resp.Status, string(body))
	}
	return nil
}
