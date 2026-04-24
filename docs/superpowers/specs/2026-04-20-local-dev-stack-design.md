# Local Dev Stack Integration Design

**Date:** 2026-04-20  
**Goal:** Get the full Vitalog local dev stack running end-to-end — local Supabase (Docker), Go backend, analyser, and frontend — with a single `./dev.sh` command that auto-patches env credentials.

---

## Problem

Three separate env files must agree on credentials, and local Supabase generates new values each run:

| File | Currently points to |
|---|---|
| `frontend/.env.local` | Remote Supabase (`oxdjqlouplzjdpvusnzg.supabase.co`) |
| `backend/.env` | Remote Supabase + `ANALYSER_URL=http://host.docker.internal:3000` |

When local Supabase starts, it issues its own JWT secret, service role key, anon key, and API URL. Without patching the env files, the Go backend rejects all JWTs (wrong secret), storage calls fail (wrong service key), and the analyser is unreachable (Docker-only hostname).

---

## Architecture

```
browser
  └── Vite dev server :5173 (separate terminal)
        └── api.ts → Go backend :8080
              ├── Supabase PostgreSQL :54322  (local Docker)
              ├── Supabase Storage API :54321 (local Docker)
              └── Analyser :3000 (host, ~/Desktop/analyser)
```

Auth flow: frontend authenticates against local Supabase Auth (:54321). The resulting JWT is sent as `Authorization: Bearer` to the Go backend, which validates it using `SUPABASE_JWT_SECRET` from the local stack.

---

## Solution: Extend `backend/dev.sh`

### Startup order

1. **Supabase** — `supabase start` (inside `backend/`)
2. **Env-patch** — read `supabase status`, write local credentials to both env files
3. **Analyser** — existing logic, starts `node server.js` at `~/Desktop/analyser`
4. **Go backend** — `go build` then launch binary, poll `/health` for up to 10s

The frontend (`npm run frontend:dev`) is not started by `dev.sh` — it stays in a separate terminal so Vite's HMR output is visible and interactive.

### Env-patching

After `supabase start`, parse `supabase status` and write:

| Field from `supabase status` | Destination |
|---|---|
| `API URL` | `backend/.env` → `SUPABASE_URL` |
| `API URL` | `frontend/.env.local` → `VITE_SUPABASE_URL` |
| `anon key` | `frontend/.env.local` → `VITE_SUPABASE_ANON_KEY` |
| `service_role key` | `backend/.env` → `SUPABASE_SERVICE_ROLE_KEY` |
| `JWT secret` | `backend/.env` → `SUPABASE_JWT_SECRET` |
| `DB URL` | `backend/.env` → `DATABASE_URL` |
| hardcoded `http://localhost:3000` | `backend/.env` → `ANALYSER_URL` |

Patching strategy: `sed -i` replaces existing keys in-place; appends if missing. Safe to re-run. The remote values are preserved in `backend/.env.example`.

### Go backend process management

- Build: `go build -o .tmp/server ./cmd/server` (inside `backend/`)
- Launch: `.tmp/server` with env loaded from `backend/.env`, stdout/stderr to `backend/go-server.log`
- PID: saved to `backend/go-server.pid` (same pattern as analyser)
- Health check: poll `GET http://localhost:8080/health` every 1s for up to 10s before declaring ready

### Status output (after all services start)

```
── Ready ──────────────────────────────────────
  ✓ Supabase Studio  →  http://localhost:54323
  ✓ Supabase API     →  http://localhost:54321
  ✓ Go backend       →  http://localhost:8080
  ✓ Analyser         →  http://localhost:3000
  ! Frontend         →  run: npm run frontend:dev
```

### Teardown (`./dev.sh stop`)

Reverse startup order:
1. Kill Go backend via `go-server.pid`
2. Kill analyser via `analyser.pid`
3. `supabase stop`

### Commands unchanged

- `./dev.sh deploy` — remote Supabase path, untouched
- `./dev.sh status` — gains Go backend check (port 8080 + PID file)
- `./dev.sh analyser` — analyser-only, untouched

---

## Files Modified

| File | Change |
|---|---|
| `backend/dev.sh` | Add `env_patch()`, `go_backend_start()`, `go_backend_stop()` functions; update `dev` and `stop` entry points; update `show_status` |
| `backend/.env` | Patched at runtime by `dev.sh` (not committed) |
| `frontend/.env.local` | Patched at runtime by `dev.sh` (not committed) |

No frontend code changes. No Go code changes.

---

## End-to-End Verification

After `./dev.sh` completes and `npm run frontend:dev` is running:

1. Open `http://localhost:5173`, sign up with a new account
2. Upload a PDF lab report via the Upload modal
3. Confirm extraction status transitions: `pending → processing → complete`
4. Open the report detail page — AI explanation and biomarker table should render
5. Dashboard stats should show updated counts

If extraction fails, check `backend/go-server.log` for the error and `~/Desktop/analyser` logs for the AI pipeline response.

---

## Out of Scope

- Docker Compose for the Go backend (host-native is sufficient for local dev)
- Supabase local → remote credential sync automation
- Frontend dev server management inside `dev.sh`
