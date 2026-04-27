#!/usr/bin/env bash
# =============================================================================
# dev.sh — Vitalog dev runner
#
# Usage:
#   ./dev.sh              # auto-detects remote vs local from .env
#   ./dev.sh local        # force local Supabase stack (needs Docker)
#   ./dev.sh deploy       # push schema + deploy edge function to remote project
#   ./dev.sh stop         # stop services started by this script
#   ./dev.sh status       # show status of all services
#   ./dev.sh analyser     # start only the analyser server
#
# Remote mode (default when .env has a non-localhost SUPABASE_URL):
#   - Skips local Supabase / Docker entirely
#   - Go backend runs migrations on startup automatically
#   - Just starts analyser + Go backend
#
# Local mode (./dev.sh local, or when SUPABASE_URL is localhost):
#   - Starts local Supabase stack via Docker
#   - Patches .env + frontend/.env.local with local Supabase credentials
#   - Then starts analyser + Go backend
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANALYSER_DIR="${ANALYSER_DIR:-$HOME/Desktop/analyser}"
ANALYSER_LOG="$SCRIPT_DIR/analyser.log"
ANALYSER_PID_FILE="$SCRIPT_DIR/analyser.pid"

GO_SERVER_BIN="$SCRIPT_DIR/.tmp/server"
GO_SERVER_LOG="$SCRIPT_DIR/go-server.log"
GO_SERVER_PID_FILE="$SCRIPT_DIR/go-server.pid"

# ── Colours ──────────────────────────────────────────────────────────────────
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[vitalog]${NC} $*"; }
ok()      { echo -e "${GREEN}  ✓${NC} $*"; }
warn()    { echo -e "${YELLOW}  !${NC} $*"; }
err()     { echo -e "${RED}  ✗${NC} $*"; }
section() { echo -e "\n${BLUE}── $* ──────────────────────────────────────${NC}"; }

# ── Mode detection ────────────────────────────────────────────────────────────

detect_mode() {
  local url
  url=$(grep '^SUPABASE_URL=' "$SCRIPT_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
  if [[ "$url" == *"127.0.0.1"* ]] || [[ "$url" == *"localhost"* ]]; then
    echo "local"
  else
    echo "remote"
  fi
}

# ── Env helpers (local mode only) ─────────────────────────────────────────────

# patch_env FILE KEY VALUE — updates in-place or appends
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

env_patch_local() {
  section "Patching env files with local Supabase credentials"
  cd "$SCRIPT_DIR"

  local status_env
  status_env=$(supabase status --output env 2>/dev/null)

  local api_url anon_key jwt_secret service_role_key db_url
  api_url=$(echo "$status_env"          | grep '^API_URL='          | cut -d'"' -f2)
  anon_key=$(echo "$status_env"         | grep '^ANON_KEY='         | cut -d'"' -f2)
  jwt_secret=$(echo "$status_env"       | grep '^JWT_SECRET='       | cut -d'"' -f2)
  service_role_key=$(echo "$status_env" | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)
  db_url=$(echo "$status_env"           | grep '^DB_URL='           | cut -d'"' -f2)

  if [ -z "$api_url" ] || [ -z "$jwt_secret" ]; then
    err "Could not parse 'supabase status --output env'. Is Supabase running?"
    return 1
  fi

  patch_env "$SCRIPT_DIR/.env"                   "SUPABASE_URL"              "$api_url"
  patch_env "$SCRIPT_DIR/.env"                   "SUPABASE_SERVICE_ROLE_KEY" "$service_role_key"
  patch_env "$SCRIPT_DIR/.env"                   "SUPABASE_JWT_SECRET"       "$jwt_secret"
  patch_env "$SCRIPT_DIR/.env"                   "DATABASE_URL"              "$db_url"
  patch_env "$SCRIPT_DIR/.env"                   "ANALYSER_URL"              "http://localhost:3000"

  local frontend_env="$SCRIPT_DIR/../frontend/.env.local"
  patch_env "$frontend_env" "VITE_SUPABASE_URL"      "$api_url"
  patch_env "$frontend_env" "VITE_SUPABASE_ANON_KEY" "$anon_key"

  ok "backend/.env patched with local Supabase credentials"
  ok "frontend/.env.local patched with local Supabase credentials"
}

# ── Prereq checks ─────────────────────────────────────────────────────────────

check_supabase_cli() {
  if ! command -v supabase &>/dev/null; then
    err "supabase CLI not found."
    echo "     Install: brew install supabase/tap/supabase"
    return 1
  fi
  ok "supabase CLI $(supabase --version 2>/dev/null | head -1)"
}

check_docker() {
  if ! command -v docker &>/dev/null; then
    err "Docker not found. Install Docker Desktop: https://docs.docker.com/get-docker/"
    return 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    err "Docker is not running. Start Docker Desktop and retry."
    return 1
  fi
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
}

check_node() {
  if ! command -v node &>/dev/null; then
    warn "node not found — analyser server will not start"
    return 1
  fi
  ok "Node $(node --version)"
  return 0
}

check_prereqs_local() {
  section "Checking prerequisites (local mode)"
  local failed=false
  check_supabase_cli || failed=true
  check_docker       || failed=true
  if [ "$failed" = "true" ]; then
    echo ""; err "Fix the issues above and retry."; exit 1
  fi
}

check_prereqs_remote() {
  section "Checking prerequisites (remote mode)"
  if ! command -v go &>/dev/null; then
    err "go not found. Install from https://go.dev/dl/"
    exit 1
  fi
  ok "Go $(go version | awk '{print $3}')"
  check_node || true
}

# ── Supabase local stack ───────────────────────────────────────────────────────

supabase_start() {
  section "Supabase local stack"
  cd "$SCRIPT_DIR"

  if lsof -i :54321 -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Already running — skipping start"
  else
    info "Starting Supabase (this may take a minute on first run)..."
    supabase start
  fi

  ok "Supabase stack is up"
}

supabase_stop() {
  info "Stopping Supabase local stack..."
  cd "$SCRIPT_DIR"
  if supabase stop 2>/dev/null; then
    ok "Supabase stopped"
  else
    warn "Supabase was not running"
  fi
}

# ── Analyser server ───────────────────────────────────────────────────────────

analyser_start() {
  section "Analyser server"

  if ! check_node; then return; fi

  if [ ! -d "$ANALYSER_DIR" ]; then
    warn "Analyser not found at: $ANALYSER_DIR"
    warn "Set ANALYSER_DIR env var to its path and retry."
    return
  fi

  if lsof -i :3000 -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Port 3000 already occupied — analyser may already be running"
    return
  fi

  cd "$ANALYSER_DIR"

  if [ ! -d node_modules ]; then
    info "Installing analyser dependencies..."
    npm install --silent
  fi

  if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ ! -f .env ]; then
    warn "ANTHROPIC_API_KEY is not set and no .env found in $ANALYSER_DIR"
    warn "The analyser will start but AI calls will fail without an API key."
  fi

  info "Starting analyser server..."
  nohup node server.js >"$ANALYSER_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$ANALYSER_PID_FILE"

  sleep 2

  if kill -0 "$pid" 2>/dev/null; then
    ok "Analyser running  →  http://localhost:3000  (pid $pid)"
    info "  Logs: $ANALYSER_LOG"
  else
    err "Analyser failed to start. Check: $ANALYSER_LOG"
    rm -f "$ANALYSER_PID_FILE"
  fi

  cd "$SCRIPT_DIR"
}

analyser_stop() {
  if [ -f "$ANALYSER_PID_FILE" ]; then
    local pid
    pid=$(cat "$ANALYSER_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      ok "Analyser stopped (pid $pid)"
    fi
    rm -f "$ANALYSER_PID_FILE"
  elif lsof -i :3000 -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Something on port 3000 was not started by this script — skipping"
  fi
}

# ── Encryption key ────────────────────────────────────────────────────────────

ensure_encryption_key() {
  local env_file="$SCRIPT_DIR/.env"
  local existing
  existing=$(grep '^ENCRYPTION_KEY=' "$env_file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)

  if [ -n "$existing" ]; then
    ok "ENCRYPTION_KEY already set in .env"
    return
  fi

  if ! command -v openssl &>/dev/null; then
    err "openssl not found — cannot auto-generate ENCRYPTION_KEY"
    echo "     Set it manually: ENCRYPTION_KEY=\$(openssl rand -hex 32)"
    exit 1
  fi

  local key
  key=$(openssl rand -hex 32)
  patch_env "$env_file" "ENCRYPTION_KEY" "$key"
  ok "Generated and saved ENCRYPTION_KEY to .env"
}

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

  info "Starting Go backend (running migrations on first connect)..."
  nohup "$SCRIPT_DIR/.tmp/server" >"$GO_SERVER_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$GO_SERVER_PID_FILE"

  local attempts=0
  while [ $attempts -lt 15 ]; do
    if curl -sf http://localhost:8080/health &>/dev/null; then
      ok "Go backend running  →  http://localhost:8080  (pid $pid)"
      info "  Logs: $GO_SERVER_LOG"
      return 0
    fi
    sleep 1
    attempts=$((attempts + 1))
  done

  err "Go backend did not respond to health check. Check: $GO_SERVER_LOG"
  cat "$GO_SERVER_LOG" | tail -20
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

# ── Remote deploy ─────────────────────────────────────────────────────────────

deploy_remote() {
  section "Remote deploy"
  cd "$SCRIPT_DIR"

  if ! supabase projects list &>/dev/null 2>&1; then
    err "Not logged in to Supabase CLI."
    echo "     Run: supabase login"
    exit 1
  fi

  info "Pushing schema migrations to remote..."
  supabase db push --linked
  ok "Schema pushed"

  info "Deploying edge function: extraction..."
  supabase functions deploy extraction --no-verify-jwt
  ok "Edge function deployed"

  local secrets_set=false
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
    ok "ANTHROPIC_API_KEY secret set"
    secrets_set=true
  fi

  if ! $secrets_set; then
    warn "ANTHROPIC_API_KEY not set — edge function will fail without it."
    echo "     Run: supabase secrets set ANTHROPIC_API_KEY=<your-key>"
  fi

  section "Deploy complete"
  ok "Schema and edge function are live on remote Supabase"
}

# ── Stop all ──────────────────────────────────────────────────────────────────

stop_all() {
  section "Stopping services"
  go_backend_stop
  analyser_stop

  local mode
  mode=$(detect_mode)
  if [ "$mode" = "local" ]; then
    supabase_stop
  fi
}

kill_ports() {
  section "Force-killing all vitalog ports"
  local ports=(8080 3000 5173)
  for port in "${ports[@]}"; do
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
      ok "Killed port $port (pid $pids)"
    else
      warn "Nothing on port $port"
    fi
  done
  rm -f "$GO_SERVER_PID_FILE" "$ANALYSER_PID_FILE"
  ok "Done"
}

# ── Status ────────────────────────────────────────────────────────────────────

show_status() {
  section "Service status"

  local mode
  mode=$(detect_mode)

  echo ""
  if [ "$mode" = "remote" ]; then
    local url
    url=$(grep '^SUPABASE_URL=' "$SCRIPT_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
    info "Supabase: remote  →  $url"
    ok "No local stack needed"
  else
    info "Supabase local stack:"
    if lsof -i :54321 -sTCP:LISTEN &>/dev/null 2>&1; then
      ok "Running  →  http://127.0.0.1:54321"
      echo "     Studio  :  http://127.0.0.1:54323"
      echo "     DB URL  :  postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    else
      warn "Not running"
    fi
  fi

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

  echo ""
  info "Analyser server (port 3000):"
  if lsof -i :3000 -sTCP:LISTEN &>/dev/null 2>&1; then
    ok "Running  →  http://localhost:3000"
    if [ -f "$ANALYSER_PID_FILE" ]; then
      echo "     pid $(cat "$ANALYSER_PID_FILE")  |  logs: $ANALYSER_LOG"
    fi
  else
    warn "Not running"
  fi

  echo ""
  info "Frontend dev server (port 5173):"
  if lsof -i :5173 -sTCP:LISTEN &>/dev/null 2>&1; then
    ok "Running  →  http://localhost:5173"
  else
    warn "Not running  →  run: npm run frontend:dev"
  fi
  echo ""
}

show_logs() {
  section "Live logs"
  info "Tailing:"
  echo "     $GO_SERVER_LOG"
  echo "     $ANALYSER_LOG"
  echo ""
  touch "$GO_SERVER_LOG" "$ANALYSER_LOG"
  tail -F "$GO_SERVER_LOG" "$ANALYSER_LOG"
}

# ── Help ──────────────────────────────────────────────────────────────────────

show_help() {
  echo ""
  echo "  Vitalog dev runner"
  echo ""
  echo "  Usage: $0 [command]"
  echo ""
  echo "  Commands:"
  echo "    (none) / dev    Auto-detect mode from .env, start services"
  echo "    local           Force local Supabase stack (needs Docker)"
  echo "    deploy          Push schema + deploy edge function to remote Supabase"
  echo "    stop            Stop services gracefully (uses PID files)"
  echo "    kill            Force-kill ports 8080, 3000, 5173 immediately"
  echo "    status          Show status of all services"
  echo "    logs            Tail backend and analyser logs live"
  echo "    analyser        Start only the analyser server"
  echo "    help            Show this help"
  echo ""
  echo "  Mode is auto-detected from backend/.env:"
  echo "    SUPABASE_URL=http://127.0.0.1:... → local mode (starts Docker stack)"
  echo "    SUPABASE_URL=https://...           → remote mode (skips Docker)"
  echo ""
  echo "  Environment:"
  echo "    ANALYSER_DIR      Path to analyser project (default: ~/Desktop/analyser)"
  echo "    ANTHROPIC_API_KEY Required for deploy mode"
  echo ""
}

# ── Entry point ───────────────────────────────────────────────────────────────

CMD="${1:-dev}"

case "$CMD" in
  dev|start)
    MODE=$(detect_mode)
    if [ "$MODE" = "local" ]; then
      info "Mode: local (SUPABASE_URL is localhost)"
      check_prereqs_local
      supabase_start
      env_patch_local
    else
      info "Mode: remote (SUPABASE_URL is online Supabase)"
      check_prereqs_remote
    fi
    section "Encryption"
    ensure_encryption_key
    analyser_start
    go_backend_start
    show_status
    ;;
  local)
    info "Mode: local (forced)"
    check_prereqs_local
    supabase_start
    env_patch_local
    section "Encryption"
    ensure_encryption_key
    analyser_start
    go_backend_start
    show_status
    ;;
  deploy)
    check_prereqs_local
    deploy_remote
    ;;
  stop)
    stop_all
    ;;
  kill)
    kill_ports
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  analyser)
    analyser_start
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    err "Unknown command: $CMD"
    show_help
    exit 1
    ;;
esac
