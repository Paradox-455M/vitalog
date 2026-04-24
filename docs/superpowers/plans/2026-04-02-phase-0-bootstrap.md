# Phase 0: App Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the React + TypeScript + Vite app with routing, design tokens, Supabase client, Sentry, and deploy to Vercel so all three shell routes (`/`, `/login`, `/signup`) render without errors.

**Architecture:** Single Vite SPA in the repo root. React Router v6 handles client-side routing. Supabase client is a singleton in `src/lib/supabase.ts`. Design tokens live in `src/styles/tokens.css` imported globally. Sentry initialised before React renders in `main.tsx`.

**Tech Stack:** React 18, TypeScript 5, Vite 5, React Router v6, @supabase/supabase-js v2, @sentry/react, Vitest + @testing-library/react

---

## File Map

| Path | Purpose |
|------|---------|
| `src/main.tsx` | Entry point — Sentry init, React.createRoot |
| `src/App.tsx` | BrowserRouter + route definitions |
| `src/styles/tokens.css` | All CSS custom properties (design system) |
| `src/styles/global.css` | Base reset and body styles |
| `src/components/Layout.tsx` | Fixed nav + `<Outlet />` shared wrapper |
| `src/pages/Landing.tsx` | `/` — landing page shell |
| `src/pages/Login.tsx` | `/login` — login shell |
| `src/pages/Signup.tsx` | `/signup` — signup shell |
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/lib/supabase.test.ts` | Tests that client reads env vars |
| `src/App.test.tsx` | Route rendering smoke tests |
| `.env.example` | Env var template (committed) |
| `.env.local` | Actual secrets (gitignored) |
| `vercel.json` | Rewrites all paths to index.html for SPA |
| `vite.config.ts` | Vite config with test config |

---

## Task 1: Scaffold Vite App

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Run Vite scaffold**

```bash
cd "/Users/rahulsharma/Downloads/Code & Projects/vitalog"
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Please choose how to proceed":  
Select **"Ignore files and continue"** (preserves context/, design/, docs/).

- [ ] **Step 2: Install base dependencies**

```bash
npm install
npm install react-router-dom @supabase/supabase-js @sentry/react
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Verify app runs**

```bash
npm run dev
```

Expected: Vite dev server starts, `http://localhost:5173` renders the default Vite+React page with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html src/
git commit -m "chore: scaffold vite react-ts app"
```

---

## Task 2: Configure Vitest

**Files:**
- Modify: `vite.config.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Update vite.config.ts to include Vitest config**

Replace the contents of `vite.config.ts` with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 2: Create test-setup.ts**

```typescript
// src/test-setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Run tests (should be 0, no failures)**

```bash
npm test
```

Expected: `No test files found` or 0 tests, 0 failures — not an error exit.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/test-setup.ts package.json package-lock.json
git commit -m "chore: configure vitest with jsdom and testing-library"
```

---

## Task 3: Design Tokens and Global Styles

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`

- [ ] **Step 1: Create tokens.css**

```css
/* src/styles/tokens.css */
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

:root {
  /* Brand */
  --sage: #4A7C5F;
  --sage-light: #6B9E7E;
  --sage-pale: #EAF2EC;
  --sage-muted: #C8DFD0;
  --forest: #2D5016;

  /* Neutrals */
  --cream: #FAFAF7;
  --white: #FFFFFF;
  --warm-border: #E8E6DF;
  --warm-gray: #6B6860;
  --warm-gray-light: #A8A69F;

  /* Text */
  --text-primary: #1C1C1A;
  --text-secondary: #5A5A55;

  /* Alerts */
  --amber: #D4845A;
  --amber-light: #F5EDE6;

  /* Typography */
  --font-display: 'Lora', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

- [ ] **Step 2: Create global.css**

```css
/* src/styles/global.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background: var(--cream);
  color: var(--text-primary);
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font-family: var(--font-body);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/
git commit -m "feat: add design system tokens and global styles"
```

---

## Task 4: Supabase Client

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/supabase.test.ts`
- Create: `.env.example`
- Create: `.env.local` (gitignored — do not commit)

- [ ] **Step 1: Write the failing test first**

```typescript
// src/lib/supabase.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('supabase client', () => {
  it('exports a supabase client object', async () => {
    const { supabase } = await import('./supabase')
    expect(supabase).toBeDefined()
    expect(typeof supabase.from).toBe('function')
    expect(typeof supabase.auth.signInWithPassword).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/lib/supabase.test.ts
```

Expected: FAIL — `Cannot find module './supabase'`

- [ ] **Step 3: Create .env.example**

```bash
# .env.example — copy to .env.local and fill in values
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

- [ ] **Step 4: Create .env.local with real values**

```bash
# .env.local (never commit — already in .gitignore from vite scaffold)
VITE_SUPABASE_URL=https://YOUR_REAL_URL.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_REAL_ANON_KEY
VITE_SENTRY_DSN=YOUR_SENTRY_DSN
```

If you don't have Supabase credentials yet, use placeholder strings — the client will initialise but requests will fail. That's fine for Phase 0.

- [ ] **Step 5: Write the implementation**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test src/lib/supabase.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts .env.example
git commit -m "feat: add supabase client singleton"
```

---

## Task 5: Layout Component

**Files:**
- Create: `src/components/Layout.tsx`
- Create: `src/components/Layout.css`

- [ ] **Step 1: Create Layout.tsx**

```tsx
// src/components/Layout.tsx
import { Link, Outlet } from 'react-router-dom'
import './Layout.css'

export function Layout() {
  return (
    <>
      <nav className="nav">
        <div className="nav-logo">
          <div className="logo-mark">
            <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 2L9 16M4 7L9 2L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <Link to="/" className="logo-name">Vitalog</Link>
        </div>
        <div className="nav-links">
          <Link to="/login">Log in</Link>
          <Link to="/signup" className="nav-cta">Get started</Link>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </>
  )
}
```

- [ ] **Step 2: Create Layout.css**

```css
/* src/components/Layout.css */
.nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  background: rgba(250, 250, 247, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--warm-border);
  padding: 0 var(--space-12);
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-mark {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: var(--sage);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-mark svg {
  width: 18px; height: 18px;
}

.logo-name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--forest);
  letter-spacing: -0.3px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.nav-links a {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--sage);
}

.nav-cta {
  background: var(--sage) !important;
  color: white !important;
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-weight: 500 !important;
  transition: background 0.2s !important;
}

.nav-cta:hover {
  background: var(--forest) !important;
}

.main-content {
  padding-top: 64px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat: add shared Layout component with nav"
```

---

## Task 6: Page Shells

**Files:**
- Create: `src/pages/Landing.tsx`
- Create: `src/pages/Login.tsx`
- Create: `src/pages/Signup.tsx`

- [ ] **Step 1: Create Landing.tsx**

This is a placeholder shell — the real landing page content from `design/landing_page.html` gets ported later. The hero copy and structure match the design reference.

```tsx
// src/pages/Landing.tsx
import './Landing.css'
import { Link } from 'react-router-dom'

export function Landing() {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-eyebrow">
          <span className="eyebrow-dot" />
          AI-powered health intelligence
        </div>
        <h1 className="hero-title">
          Your health records,<br />
          <em>finally understood</em>
        </h1>
        <p className="hero-subtitle">
          Upload any lab report. Get a plain-language explanation instantly.
          Watch your health trends build over time.
        </p>
        <div className="hero-actions">
          <Link to="/signup" className="btn-primary">Upload your first report</Link>
          <Link to="/login" className="btn-ghost">Log in</Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create Landing.css**

```css
/* src/pages/Landing.css */
.hero {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  padding: var(--space-20) var(--space-12);
  max-width: 1200px;
  margin: 0 auto;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--sage-pale);
  border: 1px solid var(--sage-muted);
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
  color: var(--sage);
  margin-bottom: var(--space-8);
}

.eyebrow-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--sage);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.hero-title {
  font-family: var(--font-display);
  font-size: 56px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -1.5px;
  color: var(--text-primary);
  margin-bottom: var(--space-6);
}

.hero-title em {
  font-style: italic;
  color: var(--sage);
}

.hero-subtitle {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-12);
  max-width: 440px;
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.btn-primary {
  background: var(--sage);
  color: white;
  padding: 14px 28px;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: var(--forest);
}

.btn-ghost {
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 400;
  padding: 14px 16px;
  transition: color 0.2s;
}

.btn-ghost:hover {
  color: var(--sage);
}
```

- [ ] **Step 3: Create Login.tsx**

```tsx
// src/pages/Login.tsx
import './AuthPage.css'
import { Link } from 'react-router-dom'

export function Login() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to your Vitalog account</p>

        <form className="auth-form">
          <label className="field-label">
            Email
            <input type="email" className="field-input" placeholder="you@example.com" autoComplete="email" />
          </label>
          <label className="field-label">
            Password
            <input type="password" className="field-input" placeholder="••••••••" autoComplete="current-password" />
          </label>
          <button type="submit" className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>
            Log in
          </button>
        </form>

        <p className="auth-footer">
          No account? <Link to="/signup">Get started free</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create Signup.tsx**

```tsx
// src/pages/Signup.tsx
import './AuthPage.css'
import { Link } from 'react-router-dom'

export function Signup() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start understanding your health today</p>

        <form className="auth-form">
          <label className="field-label">
            Full name
            <input type="text" className="field-input" placeholder="Arjun Sharma" autoComplete="name" />
          </label>
          <label className="field-label">
            Email
            <input type="email" className="field-input" placeholder="you@example.com" autoComplete="email" />
          </label>
          <label className="field-label">
            Password
            <input type="password" className="field-input" placeholder="••••••••" autoComplete="new-password" />
          </label>
          <button type="submit" className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>
            Create account
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create AuthPage.css (shared by Login and Signup)**

```css
/* src/pages/AuthPage.css */
.auth-page {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.auth-card {
  background: var(--white);
  border: 1px solid var(--warm-border);
  border-radius: var(--radius-xl);
  padding: var(--space-12);
  width: 100%;
  max-width: 420px;
}

.auth-title {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.auth-subtitle {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: var(--space-8);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.field-input {
  padding: 10px 14px;
  border: 1px solid var(--warm-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 15px;
  background: var(--white);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.field-input:focus {
  border-color: var(--sage);
}

.field-input::placeholder {
  color: var(--warm-gray-light);
}

.auth-footer {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}

.auth-footer a {
  color: var(--sage);
  font-weight: 500;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/
git commit -m "feat: add Landing, Login, Signup page shells"
```

---

## Task 7: Wire Router and Global Styles

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Replace App.tsx with router setup**

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Update main.tsx to import global styles**

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 3: Update index.html title**

In `index.html`, change:
```html
<title>Vite + React + TS</title>
```
to:
```html
<title>Vitalog — Your Health, Understood</title>
```

- [ ] **Step 4: Run the dev server and verify all three routes**

```bash
npm run dev
```

Visit:
- `http://localhost:5173/` → landing page with hero text and nav
- `http://localhost:5173/login` → login card
- `http://localhost:5173/signup` → signup card

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx index.html
git commit -m "feat: wire router and global styles"
```

---

## Task 8: Route Smoke Tests

**Files:**
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write the tests**

```tsx
// src/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('routing', () => {
  it('renders landing page at /', () => {
    renderRoute('/')
    expect(screen.getByText(/finally understood/i)).toBeInTheDocument()
  })

  it('renders login page at /login', () => {
    renderRoute('/login')
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  it('renders signup page at /signup', () => {
    renderRoute('/signup')
    expect(screen.getByText('Create your account')).toBeInTheDocument()
  })

  it('nav is present on all routes', () => {
    renderRoute('/')
    expect(screen.getByText('Vitalog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.test.tsx
git commit -m "test: add route smoke tests"
```

---

## Task 9: Sentry Integration

**Files:**
- Modify: `src/main.tsx`
- Install: `@sentry/react` (already installed in Task 1)

- [ ] **Step 1: Add Sentry init to main.tsx**

Replace `src/main.tsx` with:

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './styles/tokens.css'
import './styles/global.css'
import { App } from './App'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.1,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

`enabled: import.meta.env.PROD` means Sentry is off in local dev. It activates in Vercel preview/production.

- [ ] **Step 2: Verify dev server still starts**

```bash
npm run dev
```

Expected: No errors, app loads normally.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: add sentry error tracking (enabled in prod only)"
```

---

## Task 10: Vercel Config and Build Check

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

Without this, Vercel serves 404 on direct navigation to `/login` or `/signup` because there are no corresponding static files.

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 2: Run production build to confirm no type errors**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors. Outputs to `dist/`.

- [ ] **Step 3: Run typecheck explicitly**

```bash
npx tsc --noEmit
```

Expected: No output (zero errors).

- [ ] **Step 4: Run full test suite one final time**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel SPA rewrite config"
```

---

## Task 11: Deploy to Vercel

**Files:** No code changes.

- [ ] **Step 1: Install Vercel CLI if not present**

```bash
npm i -g vercel
```

- [ ] **Step 2: Link and deploy**

```bash
cd "/Users/rahulsharma/Downloads/Code & Projects/vitalog"
vercel
```

When prompted:
- Set up and deploy: **Y**
- Which scope: select your account
- Link to existing project: **N** (first time)
- Project name: `vitalog`
- Which directory: `.` (root)
- Override build settings: **N**

- [ ] **Step 3: Set environment variables in Vercel**

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_SENTRY_DSN
```

Add each for `Production` and `Preview` environments when prompted.

- [ ] **Step 4: Trigger production deploy**

```bash
vercel --prod
```

- [ ] **Step 5: Verify deployment**

Visit the Vercel URL. Check:
- `/` renders landing page
- `/login` renders login card (not 404)
- `/signup` renders signup card (not 404)
- Browser console shows no errors

---

## Phase 0 Exit Criteria Checklist

- [ ] `npm run dev` starts without errors
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — production build succeeds
- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `/`, `/login`, `/signup` all render correctly locally
- [ ] Vercel preview deployment is live
- [ ] `/login` and `/signup` return 200 (not 404) on direct navigation in preview
- [ ] Sentry is initialised (check Sentry dashboard for the project appearing)

---

## Next Phase

Once all exit criteria pass: write and execute `2026-04-02-phase-1-database.md` covering the Supabase schema, RLS policies, Storage bucket setup, and soft delete migrations.
