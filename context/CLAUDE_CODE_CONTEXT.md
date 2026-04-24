# Vitalog — Claude Code Context
# Read this file first before writing any code.
# This is the single source of truth for the entire project.

---

## What is Vitalog?

Vitalog is an AI-powered personal health intelligence platform. Users upload medical documents (lab reports, prescriptions, discharge summaries). The AI extracts structured health data, explains it in plain language, and builds a longitudinal health timeline so users can track how their values change over time.

**One line:** Eka Care stores your health records. Vitalog makes you understand them.

**North star metric:** Number of users who have uploaded 3+ reports AND returned to the app within 30 days of their third upload.

---

## Target User (ICP)

Urban Indian professional, 25–40 years old. English-comfortable. Managing their own health and often elderly parents' health simultaneously. Gets annual employer health checkups. Reports scattered across WhatsApp, email, Apollo 247, Practo. Has no unified view of their health over time. Does not understand medical jargon.

**Persona 1 — Arjun:** 32, Bangalore, software engineer. Got borderline cholesterol report. Had no idea what it meant.
**Persona 2 — Priya:** 35, Mumbai, PM. Manages her own + both parents' health across 3 hospitals.

---

## Core Product — Three Layers

### Layer 1: Document Intelligence (Extraction)
- User uploads PDF, JPG, or PNG of any health document
- Vision AI model (Claude Vision or GPT-4 Vision) extracts structured JSON: test name, value, unit, reference range
- Normalisation layer maps variant names → canonical fields (Hb, HGB, Haemoglobin → "haemoglobin")
- Extracted JSON stored separately from raw document
- Accuracy target: 80%+ on varied real-world Indian lab reports

### Layer 2: Plain Language Comprehension (Explanation)
- AI prompt takes extracted JSON (NOT raw document) as input
- Returns plain language explanation: what was tested, what results mean, what's in range, what's outside range
- Non-diagnostic framing: NEVER says "you have X condition" or "take Y medicine"
- OK to say: "your ferritin is lower than last time, this often links to dietary iron, worth discussing with your doctor"
- Readability target: Class 8 English comprehension level
- Cached per report — not regenerated on every view

### Layer 3: Longitudinal Intelligence (Timeline)
- As user uploads multiple reports, canonical values are tracked over time
- Charts show value trends with reference range band overlaid
- Significant delta flagged: >15% change between consecutive reports gets a plain language note
- Family profiles: separate timelines per profile, all under one account

---

## Tech Stack

### Frontend
- React + TypeScript + Vite
- Recharts for health trend visualisations
- React Router for navigation
- Design system: custom CSS variables (see design tokens below)

### Backend / Infrastructure
- Supabase: auth, PostgreSQL database, file storage
- Row Level Security (RLS) on ALL tables from day one — this is non-negotiable
- Supabase Storage: encrypted bucket for raw documents
- Edge Functions for API routes (or Node/Express if preferred)

### AI
- Claude Vision (claude-3-5-sonnet or claude-3-opus) for document extraction
- Claude (claude-3-5-sonnet) for plain language explanation generation
- Single API call per document: send image/PDF page directly to Vision model with structured extraction prompt
- Do NOT build an OCR pipeline — Vision models handle messy Indian lab reports better than Tesseract

### Deployment
- Vercel for frontend
- Cloudflare in front of everything (DDoS, CDN, trust signal)
- Sentry for error tracking from day one

---

## Database Schema

### profiles
```sql
id uuid primary key references auth.users(id)
created_at timestamptz default now()
email text
full_name text
avatar_url text
plan text default 'free' -- 'free' | 'pro'
```

### family_members
```sql
id uuid primary key default gen_random_uuid()
owner_id uuid references profiles(id) on delete cascade
name text not null
relationship text -- 'self' | 'parent' | 'spouse' | 'child' | 'other'
date_of_birth date
created_at timestamptz default now()
```

### documents
```sql
id uuid primary key default gen_random_uuid()
owner_id uuid references profiles(id) on delete cascade
family_member_id uuid references family_members(id) on delete cascade
storage_path text not null -- Supabase Storage path
file_name text not null
file_type text -- 'pdf' | 'image'
document_type text -- 'blood_test' | 'prescription' | 'discharge_summary' | 'scan' | 'other'
report_date date -- extracted or user-provided date of the test
lab_name text -- extracted lab name
extraction_status text default 'pending' -- 'pending' | 'processing' | 'complete' | 'failed'
explanation_text text -- cached plain language explanation
created_at timestamptz default now()
```

### health_values
```sql
id uuid primary key default gen_random_uuid()
document_id uuid references documents(id) on delete cascade
family_member_id uuid references family_members(id) on delete cascade
canonical_name text not null -- normalised field name e.g. 'haemoglobin'
display_name text not null -- human-readable e.g. 'Haemoglobin'
value numeric not null
unit text
reference_low numeric
reference_high numeric
is_flagged boolean default false -- true if outside reference range
report_date date not null -- denormalised from document for efficient timeline queries
created_at timestamptz default now()
```

### RLS Policies (apply to ALL tables)
```sql
-- profiles: users can only read/update their own row
-- family_members: owner_id must match auth.uid()
-- documents: owner_id must match auth.uid()
-- health_values: join to documents where owner_id matches auth.uid()
```

---

## Extraction Prompt (tested, use this)

```
You are a medical document parser. Extract all health test data from this document.

Return ONLY valid JSON in this exact structure, nothing else:
{
  "document_type": "blood_test | prescription | discharge_summary | scan | other",
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "string or null",
  "patient_name": "string or null",
  "tests": [
    {
      "raw_name": "exact name as written in document",
      "canonical_name": "normalised snake_case name e.g. haemoglobin",
      "display_name": "human readable e.g. Haemoglobin",
      "value": numeric_value_only,
      "unit": "string e.g. g/dL",
      "reference_low": numeric_or_null,
      "reference_high": numeric_or_null,
      "is_flagged": true_if_outside_range
    }
  ]
}

Rules:
- Extract ALL test values you can find
- For value, return ONLY the numeric part (not strings like ">3.5")
- If document is not a health document, return {"document_type": "other", "tests": []}
- If handwritten or unclear, still attempt extraction and note confidence
- Handle mixed Hindi/English documents
- Common Indian lab format variations: treat Hb, HGB, Haemoglobin, Hemoglobin as canonical_name "haemoglobin"
```

---

## Explanation Prompt (tested, use this)

```
You are a warm, knowledgeable health companion explaining a medical report to someone with no medical training.

Here is the extracted data from their report:
{EXTRACTED_JSON}

Write a plain language explanation following these rules:
1. Start with a 1-2 sentence overall summary ("Your blood work looks mostly good with one thing worth keeping an eye on")
2. For each flagged value, explain what it measures, why it matters, and what the change means in everyday terms
3. For values in normal range, briefly confirm they are healthy
4. NEVER diagnose conditions or recommend specific medications
5. For concerning values, suggest "worth discussing with your doctor" — nothing stronger
6. OK to mention lifestyle factors ("this often links to dietary iron intake")
7. Use simple words. No jargon. Write for a Class 8 reading level.
8. Tone: warm, informative, like a knowledgeable friend — not clinical, not alarming
9. Maximum 300 words

Format your response as:
SUMMARY: [1-2 sentence overview]
FINDINGS: [bullet points for each notable finding]
ALL CLEAR: [brief mention of values that are healthy]
```

---

## Normalisation Map (seed this, expand as you see edge cases)

```typescript
const CANONICAL_MAP: Record<string, string> = {
  // Haemoglobin
  'hb': 'haemoglobin', 'hgb': 'haemoglobin', 'hemoglobin': 'haemoglobin',
  'haemoglobin': 'haemoglobin', 'haemoglobin (hb)': 'haemoglobin',

  // Blood Sugar
  'fbs': 'fasting_blood_sugar', 'fasting blood sugar': 'fasting_blood_sugar',
  'fasting glucose': 'fasting_blood_sugar', 'blood glucose fasting': 'fasting_blood_sugar',
  'rbs': 'random_blood_sugar', 'ppbs': 'postprandial_blood_sugar',
  'hba1c': 'hba1c', 'glycated haemoglobin': 'hba1c', 'glycosylated hemoglobin': 'hba1c',

  // Thyroid
  'tsh': 'tsh', 'thyroid stimulating hormone': 'tsh',
  't3': 't3_total', 't4': 't4_total', 'ft3': 't3_free', 'ft4': 't4_free',

  // Lipid Profile
  'total cholesterol': 'cholesterol_total', 'cholesterol': 'cholesterol_total',
  'ldl': 'cholesterol_ldl', 'ldl cholesterol': 'cholesterol_ldl',
  'hdl': 'cholesterol_hdl', 'hdl cholesterol': 'cholesterol_hdl',
  'triglycerides': 'triglycerides', 'tg': 'triglycerides',

  // Iron Studies
  'serum ferritin': 'ferritin', 'ferritin': 'ferritin',
  'serum iron': 'serum_iron', 'tibc': 'tibc',

  // Liver
  'sgpt': 'alt', 'alt': 'alt', 'alanine aminotransferase': 'alt',
  'sgot': 'ast', 'ast': 'ast', 'aspartate aminotransferase': 'ast',

  // Kidney
  'serum creatinine': 'creatinine', 'creatinine': 'creatinine',
  'blood urea nitrogen': 'bun', 'bun': 'bun', 'urea': 'urea',

  // CBC
  'wbc': 'wbc', 'white blood cells': 'wbc', 'total leucocyte count': 'wbc', 'tlc': 'wbc',
  'rbc': 'rbc', 'red blood cells': 'rbc', 'rbc count': 'rbc',
  'platelets': 'platelets', 'platelet count': 'platelets', 'plt': 'platelets',

  // Vitamins
  'vitamin d': 'vitamin_d', 'vitamin d3': 'vitamin_d', '25-oh vitamin d': 'vitamin_d',
  'vitamin b12': 'vitamin_b12', 'cyanocobalamin': 'vitamin_b12',
}
```

---

## File Upload Flow

```
User selects file
  → Client validates: type (PDF/JPG/PNG), size (<20MB)
  → Upload to Supabase Storage: documents/{owner_id}/{uuid}.{ext}
  → Insert document row with status: 'pending'
  → Trigger extraction pipeline (Edge Function or background job):
      → Fetch file from Storage
      → Call Vision AI with extraction prompt
      → Parse JSON response
      → Normalise canonical_name values using CANONICAL_MAP
      → Insert health_values rows
      → Generate explanation (separate AI call with extracted JSON)
      → Update document row: status 'complete', explanation_text cached
  → Client polls document status or uses Supabase Realtime subscription
  → On complete: show explanation and extracted values to user
```

---

## Design System Tokens

```css
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
  --font-display: 'Lora', Georgia, serif;     /* headings, product name */
  --font-body: 'DM Sans', system-ui, sans-serif; /* body, UI */

  /* Spacing scale */
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px;

  /* Radius */
  --radius-sm: 8px; --radius-md: 12px;
  --radius-lg: 16px; --radius-xl: 24px;
}
```

---

## Screens to Build (in priority order)

### 1. Auth (Phase 0)
- `/` — Landing page (design complete, see design/landing_page.html)
- `/login` — Email + Google OAuth
- `/signup` — Email + Google OAuth

### 2. Core MVP (Phase 2)
- `/dashboard` — All uploaded reports, chronological, search/filter
- `/upload` — File upload flow with drag-and-drop
- `/reports/:id` — Single report view: original doc + plain language explanation + extracted values
- `/profile` — Account settings, family member management

### 3. Longitudinal Layer (Phase 3)
- `/timeline` — Health value trends, charts per canonical value
- `/timeline/:canonical_name` — Deep dive on single value over time

### 4. Onboarding
- First-time user flow: upload first report immediately (skip generic onboarding)

---

## Non-Negotiable Rules for Claude Code

1. **RLS on every table.** Never create a table without RLS policies. Health data without RLS is a privacy breach.

2. **Never log raw health data.** Console.log of extracted values, report content, or explanation text is forbidden in production code. Use error boundaries that log only error types, not payloads.

3. **Always store the original file.** Never replace the raw document with only the extraction. Users must always be able to download their original.

4. **Non-diagnostic AI framing.** Review every AI prompt change. If the explanation starts sounding like a diagnosis, fix the prompt. The line is: observation ("your ferritin dropped") vs diagnosis ("you have iron deficiency anaemia").

5. **Soft deletes only on documents.** Mark deleted_at, never hard delete. 30-day recovery window. Health data loss is unrecoverable trust damage.

6. **Extraction failures are not silent.** If extraction fails, the document row status = 'failed', user sees a clear message, and the original file is still accessible.

7. **Cache explanations.** Generate once, store in explanation_text column. Do not call AI on every page load for explanation.

8. **Test RLS before shipping any feature.** Log in as User A, try to access User B's document ID directly. It must return 0 rows or 403.

---

## Build Order (follow this exactly)

```
Phase 0 (Week 1-2):
  ✓ Supabase project setup
  ✓ Schema with RLS
  ✓ Auth (email + Google)
  ✓ Vercel deployment
  ✓ Sentry error tracking
  ✓ Environment config (local / staging / prod)

Phase 1 (Week 3-4) — VALIDATE BEFORE BUILDING UI:
  ✓ Extraction pipeline (Edge Function)
  ✓ Test against 50 real Indian lab reports manually
  ✓ Normalisation layer
  ✓ Accuracy must reach 80%+ before proceeding

Phase 2 (Week 5-7) — MVP:
  ✓ Document upload UI
  ✓ Dashboard
  ✓ Single report view with explanation
  ✓ Family member profiles

Phase 3 (Week 8-10) — Longitudinal:
  ✓ Timeline page
  ✓ Trend charts (Recharts)
  ✓ Delta detection and flagging

Phase 4 (Week 11-12) — Trust:
  ✓ Security review
  ✓ Data export
  ✓ Account deletion (full wipe)
  ✓ Privacy dashboard
```

---

## Competitive Context

**Eka Care** — Main competitor. 30M registered users, $19.5M raised. Built as doctor EMR first, patient app second. Has ABHA integration. Does NOT have a plain language AI comprehension layer as core value prop. Their DNA is provider-first.

**DRiefcase** — Pure storage. No AI.

**ABHA App** — Government. No comprehension. Poor UX.

**Our moat:** Depth of AI comprehension layer + longitudinal delta detection. Switching cost compounds with every upload — leaving means losing your interpreted health history.

---

## Monetisation

**Free:** 3 lifetime report uploads, AI explanation, value extraction
**Pro (₹299/month):** Unlimited reports, trend charts, 5 family profiles, data export, priority support

Free to Pro conversion trigger: user hits 3-report limit, sees a teaser of the trend chart they would have access to.

---

## Key Decisions Already Made

- Web-first, mobile later
- India launch first (urban professionals), then expand
- English only for v1, vernacular in future
- No medication reminders (scope creep)
- Health tracking is derived from uploaded reports only — no manual data entry, no wearable integration in v1
- Charts are auto-generated from extraction data — zero user effort
- Do NOT integrate ABHA in v1 — regulatory complexity not worth it at this stage

---

## Founder Context

Solo developer, first-time founder. Strong in React, TypeScript, Vite, AI API integration, ETL pipelines. New to startup operations. Working toward building a fundable product. Based in Bangalore, India.

---

## Files in This Folder

```
vitalog/
├── context/
│   └── CLAUDE_CODE_CONTEXT.md    ← you are here
├── design/
│   └── landing_page.html         ← complete landing page design (open in browser)
└── docs/
    └── Vitalog_PRD_v1.docx       ← full product requirements document
```

---

## Quick Reference — What to Ask When Stuck

If confused about product direction → re-read "Core Product — Three Layers"
If confused about data model → re-read "Database Schema"
If confused about AI implementation → re-read extraction/explanation prompts
If confused about build order → re-read "Build Order"
If tempted to add a new feature → ask: does this deepen the core value or dilute it?
