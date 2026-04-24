# Local Dev Stack Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `backend/dev.sh` so a single `./dev.sh` command starts local Supabase, auto-patches env files with local credentials, starts the analyser, and starts the Go backend — with full stop/status support.

**Architecture:** `supabase status --output env` produces clean `KEY="value"` pairs; `patch_env()` rewrites specific keys in-place using `sed` + a temp file (macOS/Linux portable). The Go backend binary is compiled into `backend/.tmp/server`, launched as a background process with a PID file, and health-checked on `/health` before the script exits.

**Tech Stack:** bash, Go 1.22+, Supabase CLI, curl

---

## File Map

| File | Change |
|---|---|
| `backend/dev.sh` | Add `patch_env()`, `env_patch()`, `go_backend_start()`, `go_backend_stop()`; fix supabase running check; update `dev`, `stop`, `status` entry points |
| `backend/.gitignore` | Create — ignore `.tmp/`, `*.log`, `*.pid` |

---

### Task 1: Create `backend/.gitignore`

**Files:**
- Create: `backend/.gitignore`

- [ ] **Step 1: Create the file**

```
.tmp/
*.log
*.pid
.env
```

- [ ] **Step 2: Verify it was created**

```bash
cat backend/.gitignore
```

Expected output:
```
.tmp/
*.log
*.pid
.env
```

- [ ] **Step 3: Commit**

```bash
git add backend/.gitignore
git commit -m "chore: add backend .gitignore for build artifacts and secrets"
```

---

### Task 2: Add `patch_env()` helper and `env_patch()` function

**Files:**
- Modify: `backend/dev.sh`

These two functions go directly after the `ANALYSER_PID_FILE` variable declaration (after line 23) and before the colour/helper functions block.

- [ ] **Step 1: Add the three new variable declarations after the existing `ANALYSER_PID_FILE` line**

Find this exact block in `backend/dev.sh`:
```bash
ANALYSER_LOG="$SCRIPT_DIR/analyser.log"
ANALYSER_PID_FILE="$SCRIPT_DIR/analyser.pid"
```

Replace it with:
```bash
ANALYSER_LOG="$SCRIPT_DIR/analyser.log"
ANALYSER_PID_FILE="$SCRIPT_DIR/analyser.pid"

GO_SERVER_BIN="$SCRIPT_DIR/.tmp/server"
GO_SERVER_LOG="$SCRIPT_DIR/go-server.log"
GO_SERVER_PID_FILE="$SCRIPT_DIR/go-server.pid"
```

- [ ] **Step 2: Add `patch_env()` and `env_patch()` after the colour/helper block**

Find the line:
```bash
section() { echo -e "\n${BLUE}── $* ──────────────────────────────────────${NC}"; }
```

Add the following two functions immediately after it:

```bash
# ── Env helpers ───────────────────────────────────────────────────────────────

# patch_env FILE KEY VALUE
# Sets KEY=VALUE in FILE. Updates in-place if key exists; appends if missing.
patch_env() {
  local file="$1" key="$2" value="$3"
  if [ ! -f "$file" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$file"
    return
  fi
  if grep -q "^${key}=" "$file"; then
    local tmpfile
    tmpfile=$(mktemp)
    sed "s|^${key}=.*|${key}=${value}|" "$file" > "$tmpfile" && mv "$tmpfile" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

env_patch() {
  section "Patching env files with local Supabase credentials"
  cd "$SCRIPT_DIR"

  local status_env
  status_env=$(supabase status --output env 2>/dev/null)

  local api_url anon_key jwt_secret service_role_key db_url studio_url
  api_url=$(echo "$status_env"         | grep '^API_URL='          | cut -d'"' -f2)
  anon_key=$(echo "$status_env"        | grep '^ANON_KEY='         | cut -d'"' -f2)
  jwt_secret=$(echo "$status_env"      | grep '^JWT_SECRET='       | cut -d'"' -f2)
  service_role_key=$(echo "$status_env"| grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)
  db_url=$(echo "$status_env"          | grep '^DB_URL='           | cut -d'"' -f2)
  studio_url=$(echo "$status_env"      | grep '^STUDIO_URL='       | cut -d'"' -f2)

  if [ -z "$api_url" ] || [ -z "$jwt_secret" ]; then
    err "Could not parse 'supabase status --output env'. Is Supabase running?"
    return 1
  fi

  # backend/.env
  patch_env "$SCRIPT_DIR/.env"           "SUPABASE_URL"            "$api_url"
  patch_env "$SCRIPT_DIR/.env"           "SUPABASE_SERVICE_ROLE_KEY" "$service_role_key"
  patch_env "$SCRIPT_DIR/.env"           "SUPABASE_JWT_SECRET"     "$jwt_secret"
  patch_env "$SCRIPT_DIR/.env"           "DATABASE_URL"            "$db_url"
  patch_env "$SCRIPT_DIR/.env"           "ANALYSER_URL"            "http://localhost:3000"

  # frontend/.env.local
  local frontend_env="$SCRIPT_DIR/../frontend/.env.local"
  patch_env "$frontend_env" "VITE_SUPABASE_URL"      "$api_url"
  patch_env "$frontend_env" "VITE_SUPABASE_ANON_KEY" "$anon_key"

  ok "backend/.env  →  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, DATABASE_URL, ANALYSER_URL"
  ok "frontend/.env.local  →  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
}
```

- [ ] **Step 3: Manually verify parsing is correct (Supabase must already be running)**

```bash
cd backend
supabase status --output env | grep -E '^(API_URL|ANON_KEY|JWT_SECRET|SERVICE_ROLE_KEY|DB_URL)='
```

Expected: five non-empty `KEY="value"` lines.

- [ ] **Step 4: Commit**

```bash
git add backend/dev.sh
git commit -m "feat(dev): add patch_env and env_patch functions"
```

---

### Task 3: Fix the Supabase running detection for new CLI format

**Files:**
- Modify: `backend/dev.sh`

The existing check `supabase status 2>/dev/null | grep -q "API URL"` matches the old CLI output format. The new CLI uses a box table, not `key: value` lines — so this grep never matches, and Supabase tries to start even when it's already running.

- [ ] **Step 1: Fix the running check in `supabase_start()`**

Find:
```bash
  if supabase status 2>/dev/null | grep -q "API URL"; then
    warn "Already running — skipping start"
  else
```

Replace with:
```bash
  if lsof -i :54321 -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Already running — skipping start"
  else
```

- [ ] **Step 2: Fix the same stale check in `show_status()`**

Find:
```bash
  if supabase status 2>/dev/null | grep -q "API URL"; then
    supabase status 2>/dev/null | grep -E "API URL|DB URL|Studio URL|Anon key" | sed 's/^/     /'
```

Replace with:
```bash
  if lsof -i :54321 -sTCP:LISTEN &>/dev/null 2>&1; then
    echo "     API URL  :  http://127.0.0.1:54321"
    echo "     Studio   :  http://127.0.0.1:54323"
    echo "     DB URL   :  postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

- [ ] **Step 3: Verify the function works**

With Supabase running:
```bash
cd backend && bash -c 'source dev.sh; show_status' 2>/dev/null || ./dev.sh status
```

Expected: Supabase section shows "Running" with the three URLs. Without Supabase running it should show "Not running".

- [ ] **Step 4: Commit**

```bash
git add backend/dev.sh
git commit -m "fix(dev): update supabase running check for new CLI table format"
```

---

### Task 4: Add `go_backend_start()` and `go_backend_stop()` functions

**Files:**
- Modify: `backend/dev.sh`

Add these two functions after the `analyser_stop()` function and before the `deploy_remote()` function.

- [ ] **Step 1: Find the insertion point**

Locate the end of `analyser_stop()`:
```bash
  elif lsof -i :3000 -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Something on port 3000 was not started by this script — skipping"
  fi
}
```

The next line after this closing `}` is the start of `deploy_remote()`. Insert the new functions between them.

- [ ] **Step 2: Add the functions**

```bash
# ── Go backend ────────────────────────────────────────────────────────────────

go_backend_start() {
  section "Go backend"

  if ! command -v go &>/dev/null; then
    err "go not found. Install from https://go.dev/dl/ and retry."
    return 1
  fi

  if lsof -i :8080 -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Port 8080 already occupied — Go backend may already be running"
    return
  fi

  mkdir -p "$SCRIPT_DIR/.tmp"

  info "Building Go backend..."
  if ! (cd "$SCRIPT_DIR" && go build -o ".tmp/server" ./cmd/server 2>&1); then
    err "Go build failed — check output above"
    return 1
  fi
  ok "Build complete"

  info "Starting Go backend..."
  (cd "$SCRIPT_DIR" && .tmp/server) >"$GO_SERVER_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$GO_SERVER_PID_FILE"

  local attempts=0
  while [ $attempts -lt 10 ]; do
    if curl -sf http://localhost:8080/health &>/dev/null; then
      ok "Go backend running  →  http://localhost:8080  (pid $pid)"
      info "  Logs: $GO_SERVER_LOG"
      return 0
    fi
    sleep 1
    attempts=$((attempts + 1))
  done

  err "Go backend did not respond to health check. Check: $GO_SERVER_LOG"
  rm -f "$GO_SERVER_PID_FILE"
  return 1
}

go_backend_stop() {
  if [ -f "$GO_SERVER_PID_FILE" ]; then
    local pid
    pid=$(cat "$GO_SERVER_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      ok "Go backend stopped (pid $pid)"
    fi
    rm -f "$GO_SERVER_PID_FILE"
  elif lsof -i :8080 -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Something on port 8080 was not started by this script — skipping"
  fi
}
```

- [ ] **Step 3: Verify the functions are syntactically valid**

```bash
bash -n backend/dev.sh
```

Expected: no output (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add backend/dev.sh
git commit -m "feat(dev): add go_backend_start and go_backend_stop functions"
```

---

### Task 5: Wire new functions into `dev`, `stop`, and `status` commands

**Files:**
- Modify: `backend/dev.sh`

- [ ] **Step 1: Update the `dev|start` case**

Find:
```bash
  dev|start)
    check_all_prereqs
    supabase_start
    analyser_start
    show_status
    ;;
```

Replace with:
```bash
  dev|start)
    check_all_prereqs
    supabase_start
    env_patch
    analyser_start
    go_backend_start
    show_status
    ;;
```

- [ ] **Step 2: Update the `stop` case**

Find:
```bash
  stop)
    stop_all
    ;;
```

`stop_all()` currently stops analyser then Supabase. Add Go backend stop to `stop_all()`.

Find:
```bash
stop_all() {
  section "Stopping services"
  cd "$SCRIPT_DIR"

  analyser_stop
```

Replace with:
```bash
stop_all() {
  section "Stopping services"
  cd "$SCRIPT_DIR"

  go_backend_stop
  analyser_stop
```

- [ ] **Step 3: Update `show_status()` to include Go backend**

Find the analyser status block in `show_status()`:
```bash
  # Analyser
  echo ""
  info "Analyser server (port 3000):"
```

Add the Go backend block immediately before the analyser block:
```bash
  # Go backend
  echo ""
  info "Go backend (port 8080):"
  if lsof -i :8080 -sTCP:LISTEN &>/dev/null 2>&1; then
    ok "Running  →  http://localhost:8080/health"
    if [ -f "$GO_SERVER_PID_FILE" ]; then
      echo "     pid $(cat "$GO_SERVER_PID_FILE")  |  logs: $GO_SERVER_LOG"
    fi
  else
    warn "Not running"
  fi

  # Analyser
  echo ""
  info "Analyser server (port 3000):"
```

- [ ] **Step 4: Update the final status summary printed after `show_status` is called from the `dev` entry point**

Find the section that currently shows the final ready message inside `show_status()`. At the end of `show_status()`, add the frontend reminder:

Find the last block inside `show_status()` — the frontend status section:
```bash
  # Frontend
  echo ""
  info "Frontend dev server (port 5173):"
  if lsof -i :5173 -sTCP:LISTEN &>/dev/null 2>&1; then
    ok "Running  →  http://localhost:5173"
  else
    warn "Not running  (start: npm --prefix frontend run dev)"
  fi
  echo ""
```

Replace with:
```bash
  # Frontend
  echo ""
  info "Frontend dev server (port 5173):"
  if lsof -i :5173 -sTCP:LISTEN &>/dev/null 2>&1; then
    ok "Running  →  http://localhost:5173"
  else
    warn "Not running"
    echo "     Start in a separate terminal: npm run frontend:dev"
  fi
  echo ""
```

- [ ] **Step 5: Verify syntax**

```bash
bash -n backend/dev.sh
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/dev.sh
git commit -m "feat(dev): wire env_patch and go_backend into dev/stop/status commands"
```

---

### Task 6: End-to-end smoke test

**Files:** none — verification only.

- [ ] **Step 1: Ensure Docker is running, then start the full stack**

```bash
cd backend
./dev.sh
```

Expected output includes, in order:
```
── Checking prerequisites ──
  ✓ supabase CLI ...
  ✓ Docker ...
── Supabase local stack ──
  ! Already running — skipping start     ← or "Starting Supabase..."
── Patching env files with local Supabase credentials ──
  ✓ backend/.env  →  SUPABASE_URL, ...
  ✓ frontend/.env.local  →  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
── Analyser server ──
  ✓ Analyser running  →  http://localhost:3000  (pid ...)
── Go backend ──
  ✓ Build complete
  ✓ Go backend running  →  http://localhost:8080  (pid ...)
── Service status ──
  ✓ Supabase ...
  ✓ Go backend ...
  ✓ Analyser ...
  ! Frontend  →  Start in a separate terminal: npm run frontend:dev
```

- [ ] **Step 2: Verify Go backend health endpoint**

```bash
curl -s http://localhost:8080/health | python3 -m json.tool
```

Expected: JSON response like `{"status": "ok"}` (exact shape depends on `handler/health.go`).

- [ ] **Step 3: Start the frontend**

In a separate terminal:
```bash
npm run frontend:dev
```

Expected: Vite dev server starts on `http://localhost:5173`.

- [ ] **Step 4: Sign up and upload a report**

1. Open `http://localhost:5173`
2. Go to `/signup`, create a new account
3. After onboarding, click "Upload report"
4. Upload any PDF (a lab report or any multi-page PDF)
5. Watch the modal: `idle → uploading → extracting → complete`
6. If extraction completes: click "View report" — biomarker table should render
7. If extraction fails: check `backend/go-server.log` for the Go backend error, and `~/Desktop/analyser` logs for the AI pipeline error

- [ ] **Step 5: Verify the database received data**

Open Supabase Studio at `http://127.0.0.1:54323`, navigate to Table Editor → `documents`. Confirm a row exists with `extraction_status = 'complete'` and `explanation_text` is non-null.

- [ ] **Step 6: Verify stop command**

```bash
cd backend && ./dev.sh stop
```

Expected:
```
── Stopping services ──
  ✓ Go backend stopped (pid ...)
  ✓ Analyser stopped (pid ...)
  ✓ Supabase stopped
```

Then verify:
```bash
curl http://localhost:8080/health 2>&1 | grep -q "refused" && echo "Go backend stopped OK"
```
