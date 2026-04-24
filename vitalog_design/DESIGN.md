# Vitalog — Screen Design Reference

This document catalogues every screen in `vitalog_design/`, covering layout, key components, states, and implementation notes. Use it as the authoritative visual reference when building React components.

---

## Design System Baseline

All screens share the following tokens (defined in Tailwind config inside each `code.html`):

### Colors
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#3e6327` | CTAs, active nav, headings |
| `primary-container` | `#567c3d` | Gradient end, badges |
| `forest` (dark primary) | `#2D5016` / `#173901` | Left panel backgrounds, dark gradient |
| `secondary` | `#36684c` | Supporting interactive elements |
| `secondary-container` | `#b6ecc9` | Report count badge background |
| `tertiary` | `#894823` / `#562100` | Flagged / alert accents |
| `surface` | `#fbf9f2` | Page background |
| `surface-container` | `#f0eee7` | Card backgrounds |
| `surface-container-high` | `#eae8e1` | Stat cards, hover surfaces |
| `surface-container-highest` | `#e4e2dc` | Input fills, sidebar active |
| `on-surface` | `#1b1c18` | Body text |
| `on-surface-variant` | `#414943` | Muted text, metadata |
| `outline-variant` | `#c0c9c0` | Dividers, card borders |
| `error` | `#ba1a1a` | Validation errors |
| Alert amber | `#D4845A` | Flagged values, warning banners |
| Alert bg | `#F5EDE6` | Warning card background |
| Alert text | `#723612` | Warning card body text |

### Typography
| Role | Font | Notes |
|---|---|---|
| Headline / Display | Noto Serif | All `h1`–`h3`, serif figures |
| Body / UI | Manrope | All labels, body copy, nav |
| Landing page only | Lora + DM Sans | Additional font pair used only on landing |

### Spacing & Shape
- Border radius scale: `DEFAULT 0.25rem`, `lg 0.5rem`, `xl 1.5rem`, `full 9999px`
- Cards use `rounded-xl` (1.5 rem), pills use `rounded-full`
- Standard card padding: `p-6`
- Page horizontal padding: `px-8` (main app), `px-12` (detail views)

### Gradient
```css
background: linear-gradient(135deg, #3e6327 0%, #567c3d 100%);
```
Used on: logo icon container, CTA buttons, left auth panel, promo banners.

### Shared Navigation Shell
All authenticated screens use the same sidebar + top bar pattern:

**Sidebar** (`w-64`, sticky, `bg-[#fbf9f2]`, no right border in most screens):
- Logo: `w-10 h-10` gradient icon + "Vitalog" in Noto Serif
- Nav items: `py-2.5 px-4 rounded-xl gap-4`, Material Symbols icon + label
- Active item: `text-[#3e6327] font-bold` + right border `border-r-4 border-[#3e6327]`
- Inactive: `text-stone-500 font-medium hover:bg-[#e4e2dc]`
- Report badge: `bg-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full` showing count
- Bottom: Upgrade nudge card (`bg-[#f0eee7] p-4 rounded-2xl`) + user avatar row

**Top bar** (`sticky top-0 z-40`, `bg-[#fbf9f2]/70 backdrop-blur-md`):
- Left: Page title (Noto Serif, `text-2xl font-bold text-primary`) + subtitle
- Right: Primary CTA pill + notifications icon + account icon

**Nav items** (in order):
1. Dashboard (`dashboard`)
2. My Reports (`description`) — with count badge
3. Health Timeline (`timeline`)
4. Family (`family_restroom`)
5. Biomarker Library (`biotech` / `science`)
6. Settings (`settings`)

---

## Screens

---

### 1. Landing Page
**Folder:** `vitalog_landing_page/`

**Layout:** Full-width marketing page, no sidebar.

**Top Nav:** Frosted glass bar — logo left, nav links centre (Features, How It Works, Pricing, Testimonials), Sign In + "Start free" CTA right.

**Hero Section:**
- Large serif headline ("Understand your health reports in plain English")
- Sub-headline in Manrope
- Two CTAs: filled primary pill + ghost outline pill
- Hero image / abstract visual on the right side
- Social proof line ("Trusted by X+ users")

**Feature Grid:** 3-column bento grid showcasing Upload → Extract → Understand flow. Each card has icon, bold headline, short body.

**How It Works:** Numbered step list with icon per step (Upload, AI reads it, Plain-language explanation, Track over time).

**Testimonials:** Cards with avatar, quote, name, city. Urban Indian professional personas.

**Pricing Section:**
- Free tier card (3 lifetime uploads, basic AI summary)
- Pro tier card (₹299/mo — unlimited uploads, timeline, 5 family profiles, export). Pro card has `vitality-gradient` background.

**Footer:** Logo, nav links, legal, social.

**Implementation notes:**
- Lora + DM Sans are only used here — do not import on app screens
- CTA "Start free" → routes to `/signup`

---

### 2. Sign Up
**Folder:** `sign_up_screen_solid_green/`

**Layout:** Two-panel, full screen.

**Left panel** (`lg:w-[55%]`, `bg-[#2D5016]`):
- Brand quote in large Noto Serif white (`text-5xl xl:text-6xl`)
- Italicised testimonial below quote
- Vitalog logo mark bottom-left
- Optional organic background texture overlay

**Right panel** (`lg:w-[45%]`, `bg-[#FAFAF7]`):
- Centered form, `max-w-[400px]`
- Eco icon mark at top (`bg-primary/10 rounded-2xl`)
- Tab switcher: "Sign up" (active, `border-b-2 border-[#3e6327]`) | "Log in"
- Fields: Full name, Email address, Password (with visibility toggle)
- CTA: `bg-[#4A7C5F] text-white rounded-full py-4 w-full` — "Create account"
- Divider + Google OAuth button below
- Footer: Terms & Privacy links

**States:**
- Default empty
- Validation error: red ring on field, error message below
- Loading: button disabled + spinner

---

### 3. Log In
**Folder:** `log_in_screen_solid_dark_green/`

**Layout:** Same two-panel structure as Sign Up.

**Left panel:** Same dark green (`#2D5016`) with brand message.

**Right panel:**
- Tab switcher with "Log in" active
- Fields: Email, Password (with visibility toggle)
- "Forgot password?" link aligned right
- CTA: "Sign in" rounded-full button
- Google OAuth option
- "Don't have an account? Sign up" footer link

---

### 4. Active Dashboard
**Folder:** `active_dashboard_updated_nav/`

**Layout:** Sidebar (w-64) + full-height main canvas.

**Top Bar:** "Good morning, Arjun" greeting + "Here's your health summary for today." subline. Right side: "Upload report" CTA + notifications + account icons.

**Stats Row** (4-column grid, `gap-6`):
Each card: `bg-[#EAF2EC] p-6 rounded-xl h-32 flex flex-col justify-between`
- Reports uploaded — `text-4xl font-serif text-primary`
- Values tracked — `text-4xl font-serif text-primary`
- Flagged values — `text-4xl font-serif text-[#D4845A]` (amber)
- Last upload — date in primary

**Main Grid** (65% / 35% split):

*Recent Reports (65%):*
- Section heading + "View all" link
- Report card: `bg-white p-6 rounded-xl hover:bg-surface-container-low border border-transparent hover:border-outline-variant/20`
  - Report name (bold, `text-lg`)
  - Lab name with `lab_profile` icon + date
  - AI Summary line: "AI Summary:" prefix in `text-primary font-bold`
  - Flagged biomarker pill: `bg-[#fcf3eb] text-[#894823] px-3 py-1 rounded-full text-xs font-bold` with `w-1.5 h-1.5 rounded-full` dot

*Health Snapshot (35%):*
- Biomarker mini-cards: `bg-white p-5 rounded-xl flex items-center justify-between`
  - Label (uppercase, `text-xs text-stone-500`)
  - Value + trend icon (`trending_up` in primary, `trending_flat` in stone-400, `trending_down` in tertiary)
  - SVG sparkline (decorative, 80×40, opacity-50)
- "View full timeline →" link
- Promo banner: gradient card, serif heading, sub-copy, white pill CTA

**Flagged Values Alert** (full-width, below grid):
- `bg-[#F5EDE6] p-8 rounded-xl border border-[#D4845A]/10`
- Warning icon in amber circle
- "N values need your attention" heading
- 2-column grid of flagged biomarker rows
- Informational disclaimer box: italic, `bg-[#fdfaf8]`, info icon
- "Add to doctor's list" text link

---

### 5. My Reports List
**Folder:** `my_reports_list_updated_nav/`

**Layout:** Standard sidebar + main content. "My Reports" nav item active.

**Main Content:**
- Page heading "My Reports" + count badge
- Toolbar: search input (left), filter/sort controls (right)
- Report list: each row is a card identical to dashboard report cards
- Empty state: centred illustration + "Upload your first report" CTA

**Filter Bar:**
- Date range picker
- Report type filter (dropdown)
- Lab name filter
- Status chips (All / Complete / Processing / Failed)

**Report Card** (same as dashboard):
- Report type title, lab, date
- AI summary preview (1 line, truncated)
- Flagged biomarker pills
- Three-dot menu (`more_vert`): View, Share, Download, Delete

---

### 6. Report Detail View (v1)
**Folder:** `report_detail_view/`

**Layout:** Sidebar (`w-72` here) + main. "My Reports" active in sidebar.

**Top Bar:**
- Breadcrumb: Dashboard › My Reports › [Report Name]
- Right actions: Share, Download original, Print (all text+icon)

**Header Section:**
- Large icon (`w-16 h-16 rounded-2xl bg-surface-container-high`) + Report title (`text-4xl font-bold`)
- Meta row: lab name, date, status badge

**AI Explanation Block:**
- Section header: "What this means"
- Paragraph summary in Manrope
- Framing note: "This is an observation, not a diagnosis."

**Biomarker Table:**
- Columns: Name | Value | Unit | Reference Range | Status
- Status chip: Normal (`bg-secondary-container text-sm`) | Flagged (`bg-[#fcf3eb] text-[#894823]`) | Critical
- Trend arrow on each row (if prior value exists)

**Historical Comparison:**
- Mini sparkline chart per biomarker (Recharts line chart)
- "Previous: X" + delta percentage

---

### 7. Report Detail View v2
**Folder:** `vitalog_report_detail_v2/`

**Layout:** Sidebar + main (same pattern, `primary: #173901` darker variant).

**Differences from v1:**
- Slightly darker primary color (`#173901` vs `#3e6327`)
- More structured card layout for biomarker breakdown
- Action plan section at the bottom ("What to do next")

**Action Plan Section:**
- Three action cards: Diet, Lifestyle, Doctor's note
- Each card: icon + bold recommendation + one-line explanation

---

### 8. Report Upload Flow
**Folder:** `report_upload_flow/`

**Layout:** Backdrop-blurred modal overlay over a bento-grid background.

**Modal:**
- `backdrop-filter: blur(8px)` + `rgba(27, 28, 24, 0.4)` overlay
- Modal card: `bg-white rounded-3xl p-8 max-w-lg w-full`

**Upload Area:**
- Dashed border SVG (custom dashed with `#C8DFD0` stroke, `rx=24`)
- Cloud upload icon, "Drop your report here" heading
- Sub-copy: "PDF, JPG, PNG — up to 20MB"
- "Browse files" secondary button

**Progress States** (multi-step stepper):
1. Idle — file drop zone visible
2. Uploading — progress bar (`bg-primary rounded-full`) + filename + cancel
3. Extracting — spinner + "AI is reading your report…"
4. Complete — checkmark icon, summary of values extracted, "View report" CTA
5. Failed — error icon, "Extraction failed" message, retry button

**Background** (visible behind modal):
- Bento grid (`grid-template-columns: repeat(4, 1fr)`) of past report cards at reduced opacity

---

### 9. Family Profiles
**Folder:** `family_profiles_updated_nav/`

**Layout:** Sidebar + main. "Family" active.

**Page Header:** "Family Profiles" h1 + "Manage the health circles of your loved ones." subline.

**Profile Grid** (`grid-cols-3 gap-8`):
Each card: `bg-surface-container-high p-8 rounded-2xl h-64 flex flex-col items-center text-center`
- Avatar (circular, `w-20 h-20`) with person icon or real photo
- Name in Noto Serif
- Relationship badge (e.g., "Father", "Spouse")
- Report count sub-label
- "View reports" link / hover state

**Add New Card:**
- Same grid slot, dashed border, `+` icon, "Add family member" label
- Triggers Add Family Member modal on click

**Free tier gate:** Card shows lock icon + "Upgrade to add more than 1 member" after limit.

---

### 10. Add Family Member Modal
**Folder:** `add_family_member_modal/`

**Layout:** Full-screen modal over dimmed family profiles page (the background is at `opacity-40 grayscale-[20%]`).

**Modal Card:** Centred, `max-w-md`, `rounded-2xl`, white.

**Form Fields:**
- Full name
- Relationship (dropdown: Self, Spouse, Parent, Child, Sibling, Other)
- Date of birth
- Blood group (optional)
- Profile photo upload (avatar circle with edit icon)

**CTA:** "Add member" filled primary button + "Cancel" ghost.

---

### 11. Subscription Management
**Folder:** `subscription_management/`

**Layout:** Sidebar with subscription-specific nav (Plans, Billing, History, Settings). Active: Settings.

**Current Plan Banner:**
- `bg-emerald-900 text-white rounded-xl p-6`
- Plan name, next billing date, amount
- "Manage" + "Cancel plan" actions

**Plan Comparison Cards** (2 up):

*Free Card:*
- 3 lifetime uploads, basic AI summary
- Grey/neutral styling

*Pro Card* (highlighted):
- `vitality-gradient` background or border
- ₹299/month
- Unlimited uploads, timeline, 5 family profiles, PDF export
- "Upgrade" CTA

**Billing History Table:**
- Date | Amount | Status | Invoice link

**Payment Method Section:**
- Masked card number + expiry
- "Update card" link

---

### 12. Health Insights & Action Plan
**Folder:** `health_insights_action_plan/`

**Layout:** Sidebar (Insights nav active) + main.

**Top Bar:** Breadcrumb + date range picker.

**Insights Feed:**
- Full-width cards, each insight has:
  - Category icon + label (e.g., "Nutrition", "Metabolic")
  - Serif observation headline ("Your Vitamin D has been low for 3 consecutive reports")
  - AI-generated context paragraph
  - Disclaimer tag: "Observation only"

**Action Plan Section:**
- `rounded-2xl` card with three action rows
- Each row: icon (Diet, Exercise, Doctor) + bold action text + sub-note
- "Add to calendar" or "Save" micro-action per row

**Trend Charts:**
- Recharts line chart per tracked biomarker
- X-axis: report dates, Y-axis: value
- Reference range shown as horizontal band (`opacity-10`)
- Delta badge on latest point: `+12% since last test` in amber if flagged

---

### 13. Privacy & Security Center
**Folder:** `privacy_security_center/`

**Layout:** Settings-family sidebar (Privacy active) + main.

**Section Groups:**

*Data Access:*
- Toggle rows: "Allow AI to read uploaded documents", "Store extracted values", "Share anonymised data for research"
- Each toggle: label + sub-description + `<input type="checkbox">` styled as pill toggle

*Connected Accounts:*
- Google row with connected/disconnect action

*Data Export:*
- "Download all my data (JSON)" + "Download PDF summary" buttons

*Delete Account:*
- Danger zone: red-border card, "Permanently delete account" with 30-day soft-delete caveat

---

### 14. Settings
**Folder:** `settings_updated_nav/`

**Layout:** Sidebar (Settings active, `primary: #173901`) + main.

**Sections:**
- **Profile** — Avatar upload, name, email, phone
- **Notifications** — Link to notification settings sub-page
- **Privacy** — Link to privacy center
- **Appearance** — Light/dark mode toggle (UI only, light mode default per design system)
- **Language** — English (only v1 option)
- **Subscription** — Current plan pill + "Manage" link
- **Sign out** button

Each section is a `rounded-xl bg-white p-6` card with a divider between rows.

---

### 15. Notification Settings
**Folder:** `notification_settings/`

**Layout:** Settings-family sidebar (Notifications active) + main.

**Toggle Groups:**

*Report Alerts:*
- "New report processed" — push + email
- "Extraction failed" — push + email (always on)

*Health Alerts:*
- "Flagged biomarker detected" — push + email
- "Significant change (>15%)" — push only

*Reminders:*
- "Annual health check reminder" — toggle + frequency picker
- "Prescription renewal" — toggle

Each row: label + description + dual toggles (Push / Email), styled as pill toggles.

---

### 16. Biomarker Library
**Folder:** `biomarker_library_updated_nav/`

**Layout:** Sidebar (Biomarker Library active) + main.

**Search + Filter Bar:**
- Full-width search input
- Category filter chips: All, Blood, Metabolic, Thyroid, Vitamins, Liver, Kidney

**Biomarker Grid** (`grid-cols-3 gap-4` or list mode toggle):
Each card:
- Biomarker name (Noto Serif)
- Common name / alias
- Normal range for adults (M/F split if different)
- What it measures — 1-sentence plain language description
- "See my values →" link (only shown if user has data)

**Detail Drawer / Modal (on click):**
- Full explanation panel slides in from right
- Extended description, causes of high/low, what to do

---

### 17. Consultation Booking Flow
**Folder:** `consultation_booking_flow/`

**Layout:** Sidebar (Consultation active, using `family_restroom` icon) + main.

**Doctor Search / Filter:**
- Specialty filter (General Physician, Endocrinologist, Cardiologist, etc.)
- City / online toggle
- Rating + availability filters

**Doctor Cards** (list):
- Photo, name, specialty, clinic, rating stars, "Next available" slot
- "Book now" CTA pill

**Booking Modal / Step Flow:**
1. Select slot (calendar grid + time chips)
2. Add reason / share report (optional — select from uploaded reports)
3. Confirm + payment (if applicable)
4. Confirmation screen with appointment card

**Implementation note:** This screen is v1 exploratory. Mark as out-of-scope for Phase 1–3 but keep as a visual reference.

---

## Component Inventory

The following reusable components appear across multiple screens:

| Component | Screens | Notes |
|---|---|---|
| `SideNav` | All app screens | Standardised in `active_dashboard_updated_nav` — use that as authority |
| `TopBar` | All app screens | Sticky, frosted glass, greeting left + CTA right |
| `ReportCard` | Dashboard, My Reports | Hover border, AI summary, biomarker pills |
| `BiomarkerPill` | Dashboard, Report Detail | Amber/flagged vs. normal variant |
| `StatCard` | Dashboard | `bg-[#EAF2EC]`, serif number |
| `FlaggedValuesBanner` | Dashboard | Full-width amber alert block |
| `SparklineChart` | Dashboard, Report Detail | SVG or Recharts, decorative |
| `UpgradeNudge` | Sidebar (all) | `bg-[#f0eee7] rounded-2xl` card |
| `PlanCard` | Subscription | Free vs Pro, gradient on Pro |
| `ToggleRow` | Privacy, Notifications | Label + description + pill toggle |
| `UploadDropzone` | Upload Modal | Dashed SVG border, multi-state |
| `BreadcrumbBar` | Report Detail | Grey / primary trail |
| `AuthSplitPanel` | Sign Up, Log In | 55% dark green left / 45% cream right |

---

## Routing Map (implied from screens)

```
/                         → Landing Page
/signup                   → Sign Up
/login                    → Log In
/dashboard                → Active Dashboard
/reports                  → My Reports List
/reports/:id              → Report Detail View
/upload                   → Report Upload Modal (overlay on /reports or /dashboard)
/family                   → Family Profiles
/family/add               → Add Family Member Modal
/biomarkers               → Biomarker Library
/insights                 → Health Insights & Action Plan
/settings                 → Settings
/settings/notifications   → Notification Settings
/settings/privacy         → Privacy & Security Center
/settings/subscription    → Subscription Management
/consultation             → Consultation Booking (v1 exploratory)
```
