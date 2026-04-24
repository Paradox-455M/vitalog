# Vitalog

**Your health, understood.** Vitalog is an AI-assisted personal health app for uploading lab reports (PDF/images), extracting structured biomarker data, and tracking trends over time with an insights view, timeline, and family profiles.

- **Frontend:** React 19, Vite, TypeScript, Tailwind, React Router, TanStack Query, Recharts, Supabase Auth  
- **Backend:** Go (Chi), PostgreSQL via Supabase, object storage for documents, optional Razorpay for subscriptions  
- **AI pipeline:** Separate analyser service (document analysis); Go API orchestrates upload, extraction, and health value persistence  

Repository layout:

| Path | Purpose |
|------|---------|
| [`frontend/`](frontend/) | Web client |
| [`backend/`](backend/) | Go API server, SQL migrations, Supabase project files |
| [`context/`](context/) | Product/engineering context (schema, prompts, rules) |
| [`docs/`](docs/) | PRD and shared docs |
| [`design/`](design/) | Design references |
| [`CLAUDE.md`](CLAUDE.md) | Contributor / AI agent orientation |

---

## Prerequisites

- **Node.js** 20+ (for the frontend and root npm scripts)  
- **Go** 1.22+ (for the API)  
- **Supabase** project (hosted or [local CLI](https://supabase.com/docs/guides/cli))  
- **Analyser** service reachable from the backend (see [`backend/.env.example`](backend/.env.example) `ANALYSER_URL`)  

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/Paradox-455M/vitalog.git
cd vitalog
npm run frontend:install
```

### 2. Configure environment

**Backend** – copy the example and fill in real values (never commit secrets):

```bash
cp backend/.env.example backend/.env
```

Required pieces typically include: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, and `ANALYSER_URL`. See comments in [`backend/.env.example`](backend/.env.example).

**Frontend** – for local dev, Vite proxies `/api` to the Go server; you usually **do not** set `VITE_API_URL`. Use it only when the API is on another origin.

### 3. Database and storage

Apply migrations using your Supabase workflow (linked remote or local). Project migrations live under [`backend/supabase/migrations/`](backend/supabase/migrations/) and the Go server can apply [`backend/internal/migrate/sql/schema.sql`](backend/internal/migrate/sql/schema.sql) on startup depending on your setup.

Ensure a **storage bucket** named `documents` exists and RLS policies match your security model (see `CLAUDE.md` and `context/CLAUDE_CODE_CONTEXT.md`).

### 4. Run the stack

**Recommended:** orchestrated dev from `backend/`:

```bash
cd backend
./dev.sh              # remote Supabase + analyser + API (default when SUPABASE_URL is non-local)
./dev.sh local        # full local Supabase via Docker + API + analyser
./dev.sh stop
./dev.sh status
```

Start the **Go API** directly if you prefer:

```bash
cd backend
go run ./cmd/server
# Health: curl -s http://127.0.0.1:8080/health
```

**Frontend** (from repo root):

```bash
npm run frontend:dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`). Sign up / log in via Supabase Auth.

---

## npm scripts (root)

| Script | Description |
|--------|-------------|
| `npm run frontend:install` | Install frontend dependencies |
| `npm run frontend:dev` | Vite dev server |
| `npm run frontend:build` | Typecheck + production build |
| `npm run frontend:lint` | ESLint |
| `npm run frontend:preview` | Preview production build |
| `npm run backend:supabase:start` | Start local Supabase (from `backend` package.json) |
| `npm run backend:supabase:stop` | Stop local Supabase |
| `npm run backend:supabase:db:push` | Push DB migrations |
| `npm run backend:supabase:functions:deploy` | Deploy Edge Functions |

---

## Features (high level)

- Upload lab reports (PDF / images) with validation and free-tier limits  
- Extraction pipeline → `health_values` + document metadata  
- **Dashboard**, **Reports**, **Insights**, **Health timeline**, **Biomarker library**, **Family** profiles  
- Notifications and notification preferences  
- Subscription / payments (Razorpay) where configured  
- Privacy tooling (e.g. access events, data export) per backend routes  

---

## Development notes

- **Single source of truth for schema and AI rules:** [`context/CLAUDE_CODE_CONTEXT.md`](context/CLAUDE_CODE_CONTEXT.md)  
- **Architecture and commands:** [`CLAUDE.md`](CLAUDE.md)  
- **Frontend:** `cd frontend && npm run lint && npm run build` before shipping UI changes  
- **Backend:** `cd backend && go build ./...` or `go test ./...`  

---

## Security

- Do **not** commit `backend/.env` or service role keys.  
- Use `.env.example` only as a template.  
- All production tables should use **Row Level Security** aligned with your Supabase auth model.  

---

## License

Specify your license here (e.g. MIT, proprietary). This README is a project template until you add one.

---

## Repository

Remote: [https://github.com/Paradox-455M/vitalog](https://github.com/Paradox-455M/vitalog)
