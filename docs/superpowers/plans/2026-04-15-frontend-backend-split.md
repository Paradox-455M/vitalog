# Frontend Backend Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo into explicit `frontend/` and `backend/` folders, with the Vite app in `frontend/` and Supabase plus backend-facing assets in `backend/`, while keeping local development and builds working.

**Architecture:** Keep the repository root as a thin coordination layer with shared docs and instructions. Move runtime code and package manifests into app-specific folders, then update scripts and documentation so each side can be worked on independently. Verify by running frontend build/lint and checking backend package/script layout.

**Tech Stack:** React 19, TypeScript, Vite 8, ESLint 9, Supabase Edge Functions, npm

---

### Task 1: Define the new folder ownership and root orchestration

**Files:**
- Create: `frontend/package.json`
- Create: `backend/package.json`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Create app folder manifests**

Create `frontend/package.json` by moving the current frontend dependencies and scripts there. Create `backend/package.json` with backend helper scripts for Supabase operations.

```json
{
  "name": "vitalog-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

```json
{
  "name": "vitalog-backend",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:db:push": "supabase db push --linked",
    "supabase:functions:deploy": "supabase functions deploy extraction"
  }
}
```

- [ ] **Step 2: Convert the root manifest into a thin coordinator**

Update the root `package.json` so it delegates to the subprojects instead of holding app dependencies directly.

```json
{
  "name": "vitalog",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "frontend:dev": "npm --prefix frontend run dev",
    "frontend:build": "npm --prefix frontend run build",
    "frontend:lint": "npm --prefix frontend run lint",
    "backend:supabase:start": "npm --prefix backend run supabase:start",
    "backend:supabase:stop": "npm --prefix backend run supabase:stop",
    "backend:supabase:db:push": "npm --prefix backend run supabase:db:push"
  }
}
```

- [ ] **Step 3: Update the root README for the new layout**

Document the new structure and replace root-level frontend commands with folder-specific ones.

```md
## Repository layout

- `frontend/` — React, Vite, TypeScript client app
- `backend/` — Supabase config, migrations, and edge functions
- `docs/` — shared product and implementation docs
```

- [ ] **Step 4: Commit**

```bash
git add package.json README.md frontend/package.json backend/package.json
git commit -m "chore: define frontend backend workspace layout"
```

### Task 2: Move the frontend app and its config into `frontend/`

**Files:**
- Create: `frontend/src/**`
- Create: `frontend/public/**`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/eslint.config.js`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Move the frontend runtime files**

Move the current client app into `frontend/`.

```bash
mkdir -p frontend
mv src public index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js frontend/
mv package-lock.json frontend/package-lock.json
```

- [ ] **Step 2: Verify config paths still resolve from the new location**

Check that the moved configs still point at `src` and `vite.config.ts` relative to `frontend/`.

```json
{
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

```json
{
  "include": ["src"]
}
```

- [ ] **Step 3: Update any frontend docs that still point to root paths**

If `README.md` or build docs refer to `src/`, `public/`, or `vite.config.ts` at the repo root, rewrite them to `frontend/...`.

```md
- `npm --prefix frontend run dev`
- `npm --prefix frontend run build`
```

- [ ] **Step 4: Commit**

```bash
git add frontend README.md
git commit -m "chore: move vite app into frontend folder"
```

### Task 3: Move Supabase and backend-specific assets into `backend/`

**Files:**
- Create: `backend/supabase/**`
- Create: `backend/docs/backend-integration-plan.md`
- Create: `backend/docs/phase1-rls-checklist.md`
- Create: `backend/docs/phase2-extraction-edge-function.md`
- Modify: `README.md`

- [ ] **Step 1: Move the backend runtime directory**

Move Supabase and backend-only documentation under `backend/`.

```bash
mkdir -p backend/docs
mv supabase backend/
mv docs/backend-integration-plan.md docs/phase1-rls-checklist.md docs/phase2-extraction-edge-function.md backend/docs/
```

- [ ] **Step 2: Keep shared docs at the root**

Leave product and cross-cutting docs such as `docs/Vitalog_Build_Plan.md`, `docs/Vitalog_PRD_v1.docx`, `context/`, and `CLAUDE.md` at the repo root.

```text
Root stays for shared docs/instructions; backend gets only backend-owned runtime files and backend-specific docs.
```

- [ ] **Step 3: Update backend script examples and references**

Point Supabase commands to the backend folder.

```md
- `cd backend && supabase link --project-ref <your-project-ref>`
- `cd backend && supabase db push --linked`
```

- [ ] **Step 4: Commit**

```bash
git add backend README.md docs
git commit -m "chore: move supabase backend files into backend folder"
```

### Task 4: Verify the split and fix broken paths

**Files:**
- Test: `frontend/package.json`
- Test: `backend/package.json`
- Test: `README.md`

- [ ] **Step 1: Run the frontend lint command**

Run: `npm --prefix frontend run lint`
Expected: ESLint exits with code `0`

- [ ] **Step 2: Run the frontend build command**

Run: `npm --prefix frontend run build`
Expected: TypeScript and Vite complete successfully with exit code `0`

- [ ] **Step 3: Smoke-check backend structure**

Run: `find backend -maxdepth 2 -type f | sort`
Expected: shows `backend/package.json`, `backend/supabase/...`, and `backend/docs/...`

- [ ] **Step 4: Run a final repo layout check**

Run: `find . -maxdepth 2 -type d | sort`
Expected: `frontend/` and `backend/` exist at the repo root and runtime files are no longer duplicated at the top level

- [ ] **Step 5: Commit**

```bash
git add README.md frontend backend package.json
git commit -m "chore: verify frontend backend repo split"
```
