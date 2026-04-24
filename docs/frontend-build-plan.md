# Vitalog — Frontend Build Plan

This plan covers the full UI-first frontend build across 6 phases. All screens are built with static/mock data first. Backend (Supabase) wiring is a dedicated final phase.

**Design reference:** `vitalog_design/DESIGN.md`  
**Tech stack:** React 19, Vite 8, TypeScript 5.9, React Router 7, Tailwind CSS v4, Supabase (auth only until Phase 5)

---

## Phase 0 — Foundation

**Goal:** Project infrastructure ready. Every subsequent screen can be built without setup friction.

### Tasks

- [ ] Install Tailwind CSS v4 + `@tailwindcss/vite` plugin, configure `frontend/vite.config.ts`
- [ ] Replace `index.css` globals with `@import "tailwindcss"` base; keep CSS variable tokens in `:root`
- [ ] Map design palette to Tailwind theme extensions:
  - `primary: #3e6327`, `primary-container: #567c3d`
  - `forest: #2D5016`, `forest-dark: #173901`
  - `surface: #fbf9f2`, `surface-container: #f0eee7`
  - `surface-container-high: #eae8e1`, `surface-container-highest: #e4e2dc`
  - `on-surface: #1b1c18`, `on-surface-variant: #414943`
  - `secondary-container: #b6ecc9`, `outline-variant: #c0c9c0`
  - `amber: #D4845A`, `amber-light: #F5EDE6`, `amber-text: #723612`
  - `error: #ba1a1a`
- [ ] Wire fonts: `font-serif` → Noto Serif, `font-sans` → Manrope (app-wide); Lora + DM Sans scoped to landing only
- [ ] Build `SideNav` component:
  - Logo (gradient icon + "Vitalog" in Noto Serif)
  - Nav items: Dashboard, My Reports (with count badge), Health Timeline, Family, Biomarker Library, Settings
  - Active state: `text-primary font-bold border-r-4 border-primary`
  - Inactive state: `text-stone-500 hover:bg-surface-container-highest`
  - Bottom: Upgrade nudge card + user avatar row
- [ ] Build `TopBar` component:
  - Sticky, `bg-surface/70 backdrop-blur-md`
  - Left: page title (Noto Serif) + subtitle
  - Right: primary CTA pill + notification icon + account icon
- [ ] Build `AppShell` layout: SideNav + TopBar + `<Outlet />`
- [ ] Expand `App.tsx` routing scaffold — all routes point to placeholder pages:

```
/                         → LandingPage
/signup                   → SignupPage
/login                    → LoginPage
/dashboard                → DashboardPage
/reports                  → ReportsPage
/reports/:id              → ReportDetailPage
/family                   → FamilyPage
/biomarkers               → BiomarkerLibraryPage
/insights                 → InsightsPage
/settings                 → SettingsPage
/settings/notifications   → NotificationSettingsPage
/settings/privacy         → PrivacyPage
/settings/subscription    → SubscriptionPage
```

- [ ] Wire `RequireAuth` guard around all `/dashboard` and deeper routes
- [ ] Create `frontend/src/mock/` directory with typed static data fixtures for all screens

### Deliverable
Full navigation shell is clickable. Every route loads without errors. Design tokens available as Tailwind classes across the project.

---

## Phase 1 — Auth Flow

**Goal:** Polished public-facing screens. First impression of the product.

### Screens
1. Landing Page (`/`)
2. Sign Up (`/signup`)
3. Log In (`/login`)

### Tasks

**Landing Page**
- [ ] Full-width layout, no sidebar
- [ ] Frosted glass top nav: logo left, links centre (Features, How It Works, Pricing, Testimonials), Sign In + "Start free" right
- [ ] Hero: large Lora serif headline, sub-headline, two CTA pills, hero image right, social proof line
- [ ] Feature grid: 3-column bento, Upload → Extract → Understand
- [ ] How It Works: numbered step list with icons
- [ ] Testimonials: cards with avatar, quote, name, city (Indian professional personas)
- [ ] Pricing: Free card + Pro card (`vitality-gradient` bg, ₹299/mo)
- [ ] Footer: logo, nav links, legal, social
- [ ] Lora + DM Sans fonts scoped to this page only

**Sign Up**
- [ ] Two-panel full-screen layout (55% forest left / 45% cream right)
- [ ] Left: brand quote in Noto Serif white, testimonial, logo mark
- [ ] Right: eco icon mark, tab switcher (Sign up | Log in), name + email + password fields, "Create account" CTA, divider + Google OAuth, terms footer
- [ ] Form states: default, validation error (red ring + message), loading (disabled + spinner)

**Log In**
- [ ] Same two-panel structure as Sign Up
- [ ] Tab switcher with "Log in" active, email + password, forgot password link, "Sign in" CTA, Google OAuth, sign-up footer link

### Deliverable
Public flow navigable end-to-end. Auth form states all visible. `/signup` ↔ `/login` tab switching works.

---

## Phase 2 — Core Experience

**Goal:** The primary product loop. Upload → view report → see dashboard. Highest priority screens.

### Screens
4. Active Dashboard (`/dashboard`)
5. My Reports List (`/reports`)
6. Report Detail v1 (`/reports/:id`)
7. Report Detail v2 (alternate layout, same route)
8. Report Upload Modal (overlay on `/dashboard` or `/reports`)

### Tasks

**Dashboard**
- [ ] Stats row (4 cards): Reports uploaded, Values tracked, Flagged values (amber), Last upload
- [ ] Recent Reports section (65%): report cards with name, lab, date, AI summary line, flagged biomarker pill
- [ ] Health Snapshot (35%): biomarker mini-cards with value + trend icon + sparkline
- [ ] "View full timeline →" link
- [ ] Upgrade promo banner (gradient card, serif heading, CTA)
- [ ] Flagged Values Alert: full-width amber block, 2-column flagged biomarker rows, disclaimer box

**My Reports List**
- [ ] Page heading + count badge
- [ ] Search input + filter/sort controls
- [ ] Filter bar: date range, report type, lab name, status chips (All / Complete / Processing / Failed)
- [ ] Report card list (identical to dashboard cards)
- [ ] Three-dot menu per card: View, Share, Download, Delete
- [ ] Empty state: illustration + "Upload your first report" CTA

**Report Detail v1**
- [ ] Breadcrumb: Dashboard › My Reports › [Report Name]
- [ ] Right actions: Share, Download original, Print
- [ ] Header: large icon + report title + meta row (lab, date, status badge)
- [ ] AI Explanation block: "What this means" heading, paragraph, "Observation only" framing note
- [ ] Biomarker table: Name / Value / Unit / Reference Range / Status columns
- [ ] Status chips: Normal (`bg-secondary-container`) / Flagged (`bg-amber-light text-amber-text`) / Critical
- [ ] Trend arrow per row
- [ ] Historical comparison: sparkline + "Previous: X" + delta percentage

**Report Detail v2**
- [ ] Same structure as v1 with darker primary (`#173901`)
- [ ] More structured card layout for biomarker breakdown
- [ ] Action Plan section: 3 cards (Diet, Lifestyle, Doctor's note), each with icon + recommendation + explanation

**Upload Modal**
- [ ] Backdrop-blurred modal overlay
- [ ] Modal card: `rounded-3xl p-8 max-w-lg`
- [ ] Dashed SVG border upload area, cloud icon, "Drop your report here", file type/size note, "Browse files" button
- [ ] Multi-step progress states:
  1. Idle — dropzone
  2. Uploading — progress bar + filename + cancel
  3. Extracting — spinner + "AI is reading your report…"
  4. Complete — checkmark, extracted values summary, "View report" CTA
  5. Failed — error icon, retry button
- [ ] Background bento grid of past report cards (reduced opacity, decorative)

### Deliverable
Core product loop navigable with mock data. All upload modal states cycle-able. Report detail fully readable.

---

## Phase 3 — Profile & Discovery

**Goal:** Family management, biomarker education, and health insights views.

### Screens
9. Family Profiles (`/family`)
10. Add Family Member Modal
11. Biomarker Library (`/biomarkers`)
12. Health Insights & Action Plan (`/insights`)

### Tasks

**Family Profiles**
- [ ] Page header + subline
- [ ] Profile grid (`grid-cols-3`): avatar, name (Noto Serif), relationship badge, report count, "View reports" link
- [ ] Add New slot: dashed border, `+` icon, "Add family member"
- [ ] Free tier gate card: lock icon + upgrade prompt after limit

**Add Family Member Modal**
- [ ] Full-screen modal over dimmed family page (`opacity-40 grayscale-[20%]` background)
- [ ] Form: full name, relationship dropdown, date of birth, blood group (optional), profile photo upload
- [ ] "Add member" CTA + "Cancel" ghost button

**Biomarker Library**
- [ ] Full-width search input
- [ ] Category filter chips: All, Blood, Metabolic, Thyroid, Vitamins, Liver, Kidney
- [ ] Biomarker grid (`grid-cols-3`): name, alias, normal range (M/F), plain-language description, "See my values →"
- [ ] List/grid view toggle
- [ ] Detail drawer: slides in from right with full explanation, causes of high/low, what to do

**Health Insights & Action Plan**
- [ ] Breadcrumb + date range picker
- [ ] Insights feed: full-width cards with category icon, serif observation headline, AI context paragraph, "Observation only" disclaimer tag
- [ ] Action Plan section: 3 action rows (Diet, Exercise, Doctor), each with icon + action text + sub-note + "Save" micro-action
- [ ] Trend charts (Recharts): line chart per biomarker, X-axis dates, Y-axis values, reference range band, delta badge on latest point

### Deliverable
Family and discovery sections fully navigable with mock data. Recharts wired with static datasets.

---

## Phase 4 — Settings & Account

**Goal:** Complete account management surface.

### Screens
13. Settings (`/settings`)
14. Notification Settings (`/settings/notifications`)
15. Privacy & Security Center (`/settings/privacy`)
16. Subscription Management (`/settings/subscription`)

### Tasks

**Settings**
- [ ] Settings-family sidebar (sub-nav: Profile, Notifications, Privacy, Appearance, Language, Subscription)
- [ ] Profile section: avatar upload, name, email, phone fields
- [ ] Notification, Privacy links (route to sub-pages)
- [ ] Appearance: light/dark toggle (UI only, light default)
- [ ] Language: English only (v1)
- [ ] Subscription: current plan pill + "Manage" link
- [ ] Sign out button
- [ ] Each section in `rounded-xl bg-white p-6` card with row dividers

**Notification Settings**
- [ ] Settings-family sidebar (Notifications active)
- [ ] Toggle groups: Report Alerts, Health Alerts, Reminders
- [ ] Each row: label + description + dual pill toggles (Push / Email)
- [ ] "Extraction failed" always-on row (non-toggleable)

**Privacy & Security Center**
- [ ] Data Access toggles: AI reads docs, store extracted values, share anonymised data
- [ ] Connected Accounts: Google row with connect/disconnect
- [ ] Data Export: Download JSON + Download PDF buttons
- [ ] Danger zone: red-border card, "Permanently delete account", 30-day soft-delete caveat

**Subscription Management**
- [ ] Current plan banner: `bg-emerald-900 text-white`, plan name, billing date, amount, Manage + Cancel actions
- [ ] Plan comparison (2 up): Free card (neutral) + Pro card (gradient, ₹299/mo)
- [ ] Billing history table: Date / Amount / Status / Invoice
- [ ] Payment method: masked card + "Update card" link

### Deliverable
Full settings surface navigable. All toggles functional as local UI state.

---

## Phase 5 — Backend Integration

**Goal:** Replace all static/mock data with real Supabase queries. Ship the live product.

### Tasks

**Auth**
- [ ] Confirm Supabase auth flows work end-to-end (login, signup, Google OAuth, session persistence)
- [ ] Wire `RequireAuth` to real session state

**Data layer**
- [ ] Create `frontend/src/hooks/` directory with custom hooks per domain:
  - `useDocuments()` — fetch from `documents` table
  - `useHealthValues(documentId)` — fetch from `health_values`
  - `useFamilyMembers()` — fetch from `family_members`
  - `useProfile()` — fetch from `profiles`
- [ ] Replace all mock fixtures with hook calls
- [ ] Add loading states and error states to every data-dependent component

**Upload flow**
- [ ] Wire dropzone to Supabase Storage upload (`documents/{owner_id}/{uuid}.{ext}`)
- [ ] Insert document row (status: `pending`)
- [ ] Poll or subscribe via Supabase Realtime for status updates
- [ ] Show real extraction progress states

**Report detail**
- [ ] Load real biomarker data from `health_values`
- [ ] Render real AI explanation from `documents.explanation_text`
- [ ] Wire trend charts to real historical data

**Family**
- [ ] Wire add/edit/delete family member to `family_members` table
- [ ] Enforce free-tier gate (max 1 member) in UI + enforce via RLS

**Subscription**
- [ ] Wire plan display to real profile data
- [ ] Integrate payment provider (Razorpay or equivalent) for Pro upgrade

**RLS validation**
- [ ] Verify cross-user data isolation on every table before shipping
- [ ] Confirm no raw health data logged in production

### Deliverable
Live product. All screens powered by real data. Upload → extract → explain → timeline flow end-to-end.

---

## Component Inventory (built across phases)

| Component | Phase | Notes |
|---|---|---|
| `SideNav` | 0 | Authority source for nav structure |
| `TopBar` | 0 | Sticky, frosted glass |
| `AppShell` | 0 | Authenticated layout wrapper |
| `ReportCard` | 2 | Reused in Dashboard + Reports |
| `BiomarkerPill` | 2 | Amber/flagged vs normal variant |
| `StatCard` | 2 | `bg-[#EAF2EC]`, serif number |
| `FlaggedValuesBanner` | 2 | Full-width amber alert block |
| `SparklineChart` | 2 | Recharts or SVG, decorative |
| `UploadDropzone` | 2 | Multi-state upload area |
| `BreadcrumbBar` | 2 | Trail navigation |
| `AuthSplitPanel` | 1 | 55% dark green / 45% cream |
| `UpgradeNudge` | 0 | Sidebar nudge card |
| `PlanCard` | 4 | Free vs Pro |
| `ToggleRow` | 4 | Label + pill toggles |
| `BiomarkerDetailDrawer` | 3 | Slides in from right |

---

## Mock Data Structure (`frontend/src/mock/`)

Create typed fixtures for:
- `reports.ts` — array of `Document` objects with status, lab, date, AI summary
- `healthValues.ts` — array of `HealthValue` objects with canonical name, value, unit, range, status
- `familyMembers.ts` — array of `FamilyMember` objects
- `biomarkers.ts` — static biomarker library entries
- `insights.ts` — static insight cards and action plan entries

---

## Build Order Summary

| Phase | Screens | Key components |
|---|---|---|
| 0 — Foundation | — | Tailwind, SideNav, TopBar, AppShell, routing |
| 1 — Auth | Landing, Sign Up, Log In | AuthSplitPanel, pricing cards |
| 2 — Core | Dashboard, Reports, Detail, Upload | ReportCard, UploadDropzone, BiomarkerTable |
| 3 — Discovery | Family, Biomarkers, Insights | BiomarkerDetailDrawer, Recharts |
| 4 — Settings | Settings, Notifications, Privacy, Subscription | ToggleRow, PlanCard |
| 5 — Backend | All screens | Supabase hooks, Realtime, RLS |
