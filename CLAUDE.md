# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🧭 Project Overview
Vitalog is an AI-powered personal health intelligence platform for urban Indian professionals. Users upload medical documents (lab reports, prescriptions), the AI extracts structured health data and explains it in plain language, and the app builds a longitudinal health timeline across multiple uploads.

**CRITICAL STARTING POINT:** Always read `context/CLAUDE_CODE_CONTEXT.md` first. It is the single source of truth: schema, prompts, normalisation map, design tokens, and non-negotiable rules.

---

## 🏛️ Architecture & Data Flow (The Big Picture)
The system follows a strict Three-Layer Core pattern:

1.  **Extraction:** Vision AI call using the tested prompt in `CLAUDE_CODE_CONTEXT.md`. Returns structured JSON. Canonical names are normalised via `CANONICAL_MAP`. **Never** use OCR/Tesseract.
2.  **Explanation:** Separate AI call taking *extracted JSON* (not raw document) as input. Output is cached in `documents.explanation_text`. **Never** call on page load.
3.  **Timeline:** Recharts trend charts queried from `health_values`, grouped by `canonical_name`. Delta >15% between consecutive reports must be flagged.

### 💾 Database Structure
Core tables: `profiles` → `family_members` → `documents` → `health_values`.
Notification tables: `notification_preferences` (one row per profile), `notifications` (inbox items).
All tables **MUST** enforce Row-Level Security (RLS). Schema files:
- Phase 1: `backend/supabase/migrations/20260402_000001_vitalog_phase1_schema.sql`
- Phase 2: `backend/supabase/migrations/20260421_000002_notification_preferences_and_inbox.sql`
- Go backend auto-migration: `backend/internal/migrate/sql/schema.sql` (applied on every server start)

Key schema notes:
- `documents.extraction_status`: `text`, values `pending | processing | complete | failed` (4 states)
- `documents.explanation_text`: cached plain-language explanation (never regenerate on page load)
- `documents.deleted_at`: soft delete — RLS `SELECT` policy filters `deleted_at is null`
- Storage bucket name: `documents`; object paths inside bucket: `{owner_id}/{uuid}.{ext}`
- `documents.storage_path` stores the full prefixed path `documents/{owner_id}/{uuid}.{ext}`
- A `handle_new_user()` trigger auto-creates a `profiles` row on `auth.users` INSERT

### 📂 File Upload Workflow (State Machine)
This is the required data flow sequence:
1. Client validates (type + size <20MB).
2. $\to$ Upload to Supabase Storage: `documents/{owner_id}/{uuid}.{ext}`.
3. $\to$ Insert document row (status: 'pending') in `documents`.
4. $\to$ Trigger Edge Function:
    *   Vision extraction $\to$ normalise $\to$ insert `health_values`.
    *   Generate explanation $\to$ cache in `explanation_text`.
    *   Update `extraction_status`: `pending → processing → complete | failed`.
5. $\to$ Client polls or uses Supabase Realtime.

---

## ⚙️ Development Workflow & Commands

### 🎯 Recommended: Orchestrated Dev Runner
Run everything from `backend/`:
```bash
cd backend
./dev.sh           # auto-detects remote vs local from .env
./dev.sh local     # force local Supabase stack (requires Docker)
./dev.sh deploy    # push schema + deploy edge function to remote
./dev.sh stop      # stop all managed services
./dev.sh kill      # force-kill ports 8080, 3000, 5173
./dev.sh status    # show running services
./dev.sh analyser  # start only the analyser server
```
Remote mode (default when `SUPABASE_URL` is non-localhost): starts analyser + Go backend only — no Docker needed. Local mode: starts the full Supabase Docker stack, patches `.env` and `frontend/.env.local`, then starts analyser + Go backend.

The **analyser** is a separate HTTP service (default `http://localhost:3000`, set via `ANALYSER_DIR` env var pointing to its directory). It exposes `POST /api/pipeline-file-stream` and returns a Server-Sent Events stream. The Go backend calls it during document extraction. **The analyser is an external repository** (not inside this monorepo). By default `dev.sh` looks for it at `~/Desktop/analyser`. It requires its own `ANTHROPIC_API_KEY` in its `.env` or environment.

### 🚀 Frontend Commands (from project root)
*   **Local Development:** `npm run frontend:dev`
*   **Production Build / Type Check:** `npm run frontend:build` (runs `tsc -b` then `vite build`)
*   **Linting:** `npm run frontend:lint`
*   **Tests:** `cd frontend && npx vitest` (Vitest + Testing Library; no `test` script in root package.json)
*   **Single test file:** `cd frontend && npx vitest src/components/RequireAuth.test.tsx`

**Frontend → Go API URLs:** The browser calls the Go API using a **base URL** from `VITE_API_URL` when set, otherwise **same-origin** relative paths (`/api/...`). For local dev, leave `VITE_API_URL` unset and configure **`DEV_API_PROXY_TARGET`** in `frontend/.env.development` (committed default) so Vite can proxy `/api` to the Go process. For production, leave `VITE_API_URL` unset if the SPA and API share a host (reverse proxy); if they are on different hosts, set `VITE_API_URL` at build time to your API origin. **Tests** use `frontend/.env.test` (`VITE_API_URL` for a stable test default). **Backend CORS:** set `ALLOWED_ORIGINS` to comma-separated browser origins; when `ENV=production`, `ALLOWED_ORIGINS` is required (no localhost defaults).

### 🐹 Go Backend
```bash
cd backend
go run ./cmd/server          # start the server (reads .env automatically)
go build ./...               # compile check
go test ./...                # run all tests
curl http://127.0.0.1:8080/health   # verify: 200 JSON
curl -i http://127.0.0.1:8080/api/notification-preferences  # verify: 401 (not 404)
```
The backend auto-runs database migrations on startup (`internal/migrate/sql/schema.sql` + any newer SQL files). No manual migration step is required when running locally.

Go module path: `github.com/vitalog/backend`. Key deps: `go-chi/chi/v5` (router), `jackc/pgx/v5` (Postgres pool), `golang-jwt/jwt/v5`.

Required `backend/.env` vars: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ANALYSER_URL`. Copy from `backend/.env.example`. Optional: `ANTHROPIC_API_KEY` (only needed if calling AI directly; the analyser handles it instead), `RAZORPAY_WEBHOOK_SECRET`. In production, also set `ALLOWED_ORIGINS` for browser CORS.

### 🐘 Supabase Backend (CLI)
Run Supabase CLI commands from `backend/` (where `supabase/` lives):
```bash
supabase db push                          # Apply pending migrations
supabase functions deploy extraction      # Deploy the extraction Edge Function
supabase functions serve extraction       # Local test the Edge Function
```

The Edge Function entry point is `backend/supabase/functions/extraction/index.ts`.
Shared helpers live in `backend/supabase/functions/_shared/` (`canonicalMap.ts`, `prompts.ts`).
Required Edge Function secrets: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

### 🏗️ Go Backend Internal Architecture
The backend follows a strict layered pattern — new features must respect this:

| Layer | Package | Responsibility |
|---|---|---|
| Entry point | `cmd/server/` | Wire router, middleware, DI |
| Handlers | `internal/handler/` | HTTP request parsing + response; one file per domain |
| Services | `internal/service/` | Business logic; called by handlers |
| Repositories | `internal/repository/` | All DB queries; **owner_id checked here** (service role bypasses RLS) |
| Models | `internal/model/` | Shared structs (no logic) |
| Middleware | `internal/middleware/` | JWT auth (`auth.go`), CORS, rate limiting, security headers |
| Storage | `internal/storage/` | Supabase Storage operations |
| Config | `internal/config/` | Env var loading |

Handler files: `documents.go`, `extraction.go`, `family.go`, `profile.go`, `notification.go`, `dashboard.go`, `privacy.go`, `subscription.go`, `razorpay.go` (payment webhook).

**Auth middleware scope:** All `/api/*` routes require a valid JWT except `/api/webhooks/razorpay` (registered outside the auth group — verified by HMAC signature instead). `GET /health` is also public.

**Handler helpers** (`internal/handler/response.go`): use `respondJSON`, `respondError`, `respondCodedError` — never write raw `json.Encode` in handlers. Coded errors (e.g. upload limit) return `{ "error": "...", "code": "..." }` so the frontend can branch on a stable string.

### 🔌 Go Backend REST API
The frontend calls the Go backend via `frontend/src/lib/api.ts`. All REST calls go through `apiClient()`, which attaches the Supabase JWT as `Authorization: Bearer <token>`. The `api` object exposes typed namespaces: `api.documents`, `api.healthValues`, `api.family`, `api.profile`, `api.notificationPreferences`, `api.notifications`. Do not call Supabase directly from pages — use the `api` client or hooks instead.

The backend uses Supabase **service role key** (bypasses RLS), so all repository methods enforce `owner_id` checks explicitly in SQL to ensure data isolation.

---

## 🚨 Non-Negotiable Rules (MUST FOLLOW)
1.  **RLS is mandatory:** No table, no exception. Test cross-user isolation before shipping any feature.
2.  **Data Privacy:** Never log raw health data. No `console.log` of extracted values or explanation text in production.
3.  **Data Integrity:** Always preserve the original file. Extraction output is separate from the raw document.
4.  **AI Framing:** Observation only ("your ferritin dropped"), never diagnosis ("you have iron deficiency anaemia").
5.  **Deletion:** Use soft deletes (`deleted_at`); never hard delete. 30-day recovery window.
6.  **Failure Visibility:** Extraction failures must result in a visible 'failed' status for the user.
7.  **Caching:** Generate explanations once, store in `explanation_text`. Zero AI calls on page reload.

---

## 🎨 Design System Tokens
CSS variables are defined in `frontend/src/index.css`. Pixel-accurate screen references live in `vitalog_design/` — each screen has its own subdirectory containing `code.html` (open in browser) and `screen.png`. The `vitalog_design/DESIGN.md` index lists all screens. When implementing or checking a specific screen, open the matching `code.html` directly.

**Colour palette (Tailwind theme extensions — do not introduce new values):**
*   `primary: #3e6327`, `forest: #2D5016`, `surface: #fbf9f2`
*   `on-surface: #1b1c18`, `amber: #D4845A`, `secondary-container: #b6ecc9`

**Fonts — two separate pairs by context:**
*   **App screens** (dashboard, reports, settings, etc.): `font-serif` → Noto Serif (headings), `font-sans` → Manrope (body/UI)
*   **Landing page only** (`/`): Lora (display) + DM Sans (body) — do not import on app screens

*Rule:* Do not introduce new colour values or fonts outside this system.

---

## 🖥️ Frontend Source Structure
The React app lives in `frontend/src/`. Current layout:

```
frontend/src/
  auth/           # AuthContext + AuthProvider (Supabase session management)
  components/     # RequireAuth guard, SideNav, TopBar, ReportCard, UploadModal,
                  #   AuthSplitPanel, BiomarkerDetailDrawer, AddFamilyMemberModal
  hooks/          # Custom data hooks: useDocuments, useDocument, useUpload, useExtraction,
                  #   useFamilyMembers, useHealthValues, useProfile — all call api.*
                  #   Powered by TanStack React Query v5 (useQuery / useMutation)
  layout/         # AppShell (SideNav + collapsible panel), SettingsLayout (sub-nav sidebar)
                  #   AppLayout.tsx — legacy skeleton, NOT used in current routing; ignore it
  lib/            # supabaseClient.ts — single Supabase client instance
                  # api.ts — Go backend REST client (typed namespaces + interfaces)
                  # poll.ts — polling helper used to watch extraction_status after upload
                  # healthValues.ts, insightsFromHealthValues.ts — data-transform utilities
  types/          # Shared TypeScript types: biomarkers.ts, insights.ts
  pages/          # All app screens (see routing below)
  data/           # Typed static data fixtures (retained for pages not yet wired to backend)
```

**Auth pattern:** `AuthProvider` wraps the whole tree. `useAuth()` returns `{ session, user, loading, signOut }`. `RequireAuth` redirects unauthenticated users to `/login`. Do not call `supabase.auth` directly outside `AuthProvider`.

**Auth guards are enabled** — `AppShell` is wrapped in `<RequireAuth>` so all app routes require a valid session.

**Routing (React Router v7):**
- Public: `/` (HomePage), `/login`, `/signup`
- App shell (all use `AppShell` layout): `/dashboard`, `/reports`, `/reports/:id`, `/timeline`, `/family`, `/biomarkers`, `/insights`
- Settings (use `SettingsLayout` inside `AppShell`): `/settings`, `/settings/notifications`, `/settings/privacy`, `/settings/subscription`

**Layout components:**
- `AppShell` — flex container with collapsible `SideNav` (auto-collapses on `/settings/*`) + `<Outlet />`
- `SettingsLayout` — sticky header, left sub-nav sidebar, full-width content area; wraps each settings page's children

**Styling:** Tailwind CSS v4. All design tokens are defined as `@theme` CSS variables in `frontend/src/index.css`. Use `bg-surface`, `text-on-surface`, `text-primary`, etc. — never hardcode hex values. Icons use `material-symbols-outlined` font class (e.g. `<span className="material-symbols-outlined">home</span>`).

---

## 🧠 AI Prompts
Use the extraction and explanation prompts verbatim from `context/CLAUDE_CODE_CONTEXT.md`. They have been tested against real Indian lab reports. Changes to these prompts require re-validation against the accuracy baseline.

The `CANONICAL_MAP` in that file seeds the normalisation layer — expand it as edge cases appear, do not restructure it.

---

## 📈 Project Lifecycle & Scope
*   **Backend build order:** Follow phases in `docs/Vitalog_Build_Plan.md` (Phase 0 → 8). Phase 2 (extraction quality validation against 50 real Indian lab reports, 80%+ accuracy) must pass before wiring the main UI to real data.
*   **Frontend build order:** Follow phases in `docs/frontend-build-plan.md`. Six phases: Foundation → Auth → Core experience → Profile & Discovery → Settings → Backend integration. All screens are built UI-first with mock data; Supabase wiring is Phase 5.
*   **Monetisation Gates:**
    *   **Free:** 3 lifetime uploads
    *   **Pro (₹299/month):** Unlimited uploads, timeline, 5 family profiles, export
    *   *Trigger:* Conversion happens when the user hits 3-upload limit and sees a teaser of the trend chart.

---

## ❌ Out of Scope (v1)
No ABHA integration, no medication reminders, no manual health data entry, no wearable integration, no vernacular language support.
