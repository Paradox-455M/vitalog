# Vitalog Go Backend

A Go backend for the Vitalog health intelligence platform: document upload, extraction via the local **analyser** service, Supabase Storage and PostgreSQL, and optional Razorpay webhooks.

## Architecture

The Go backend connects to:

- **Supabase PostgreSQL** — Database (service role + explicit `owner_id` checks in repositories)
- **Supabase Auth** — JWT validation for API requests (anon JWT from the frontend)
- **Supabase Storage** — Document files (`documents` bucket)
- **Analyser HTTP service** — Multipart pipeline at `{ANALYSER_URL}/api/pipeline-file-stream` (default local extraction path)
- **Claude / Anthropic** — Optional for future switchback; not required when using the analyser
- **Razorpay** — Payment webhooks (optional)

## Project Structure

```
backend/
├── cmd/server/main.go      # Entry point
├── internal/
│   ├── config/             # Environment configuration
│   ├── middleware/         # Auth & CORS middleware
│   ├── handler/            # HTTP handlers
│   ├── service/            # Analyser client, extraction
│   ├── repository/         # Database queries
│   ├── storage/            # Supabase Storage client
│   └── model/              # Shared types
├── Dockerfile
├── go.mod
└── .env.example
```

## Development

### Prerequisites

- Go **1.25.6+** (see `go.mod`)
- Supabase project with schema applied and Storage bucket `documents`
- Analyser running locally (e.g. port **3000**) when testing extraction

### Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

2. Fill in `.env` with your Supabase URL, **service role** key, **JWT secret** (from Supabase project settings), and **direct Postgres** `DATABASE_URL`.

3. Point the backend at your analyser:

   - Native Go: `ANALYSER_URL=http://localhost:3000`
   - Docker on **macOS/Windows**: `ANALYSER_URL=http://host.docker.internal:3000` so the container can reach an analyser on the host
   - Docker on **Linux**: use `http://172.17.0.1:3000` or `--add-host=host.docker.internal:host-gateway` and `http://host.docker.internal:3000`

4. Run the server:

   ```bash
   go run ./cmd/server
   ```

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Health check (DB ping) | None |
| POST | `/api/documents/upload` | Upload document | JWT |
| POST | `/api/documents/:id/extract` | Run extraction (analyser → DB) | JWT |
| GET | `/api/documents` | List documents | JWT |
| GET | `/api/documents/:id` | Get document + health values | JWT |
| GET | `/api/documents/:id/signed-url` | Short-lived URL to view file in Storage | JWT |
| DELETE | `/api/documents/:id` | Soft delete document | JWT |
| GET | `/api/health-values` | List health values | JWT |
| GET | `/api/timeline/:canonical_name` | Get biomarker trend | JWT |
| GET | `/api/family` | List family members | JWT |
| POST | `/api/family` | Add family member | JWT |
| PUT | `/api/family/:id` | Update family member | JWT |
| DELETE | `/api/family/:id` | Delete family member | JWT |
| GET | `/api/profile` | Get profile | JWT |
| PUT | `/api/profile` | Update profile | JWT |
| GET | `/api/notification-preferences` | Notification settings (JSON) | JWT |
| PUT | `/api/notification-preferences` | Save notification settings | JWT |
| GET | `/api/notifications` | In-app notification list | JWT |
| POST | `/api/notifications/mark-all-read` | Mark all notifications read | JWT |
| PATCH | `/api/notifications/:id` | Mark one read (`{"read":true}`) | JWT |
| POST | `/api/webhooks/razorpay` | Razorpay webhook | HMAC |

### Troubleshooting `404` on `/api/...`

If you see **404 page not found** (plain text) or a JSON `not found` from this API:

1. Confirm the **Vitalog** process is listening (not another app on the same port):

   ```bash
   curl -s -i http://127.0.0.1:8080/health
   ```

   Expect **200** and a JSON body. If this fails or returns something else, something other than `go run ./cmd/server` may be bound to `8080`, or `PORT` in `.env` is different.

2. Call a protected route **without** a token — you should get **401**, not 404:

   ```bash
   curl -s -i http://127.0.0.1:8080/api/notification-preferences
   ```

   If you get **401** with `missing authorization header`, the route exists. Use a valid `Authorization: Bearer <supabase_jwt>` from the logged-in app.

3. **Rebuild** after pulling changes: `go run ./cmd/server` or rebuild your Docker image so routes like `/api/notification-preferences` are included.

## Deployment

### Railway

1. Connect your GitHub repository
2. Set environment variables in the Railway dashboard
3. Railway auto-detects Dockerfile and deploys

### Docker

Build and run (from this directory):

```bash
docker build -t vitalog-backend .
docker run -p 8080:8080 --env-file .env vitalog-backend
```

Use `ANALYSER_URL` so the container can reach the analyser (see host notes above).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `8080`) |
| `ENV` | No | `development` or `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (Storage + DB bypass RLS in app code) |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret for validating user tokens |
| `ANALYSER_URL` | Yes* | Base URL of the analyser (default in code: `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | No | Optional; reserved for non-analyser extraction paths |
| `RAZORPAY_WEBHOOK_SECRET` | No | Razorpay webhook verification |

\* Must be non-empty; set explicitly in production.

## Security Notes

- The backend uses the Supabase service role key, which bypasses RLS; repository methods enforce `owner_id` for data isolation.
- Health data must not be logged in production.
- JWT validation uses the Supabase JWT secret for signature verification.
