# Vitalog — Backend Integration Plan

This document outlines the step-by-step plan to connect the UI (Phases 0-4) to the Supabase backend.

---

## Current State

### Already Built (Backend)
- [x] Database schema with RLS (`backend/supabase/migrations/20260402_000001_vitalog_phase1_schema.sql`)
- [x] Extraction Edge Function (`backend/supabase/functions/extraction/index.ts`)
- [x] Supabase client configuration (`frontend/src/lib/supabaseClient.ts`)
- [x] Auth context & provider (`frontend/src/auth/AuthProvider.tsx`)
- [x] Canonical map for biomarker normalization
- [x] Extraction & explanation prompts

### Already Built (Frontend)
- [x] All UI screens with mock data
- [x] Navigation, routing, layouts
- [x] Components (TopBar, SideNav, ReportCard, etc.)
- [x] Trend charts with Recharts

### Not Yet Done
- [ ] Environment variables configured (`.env.local` not created — app cannot talk to Supabase at all)
- [ ] Supabase project connected
- [ ] Storage bucket `documents` created (`cd backend && supabase storage create documents` not run)
- [ ] Profile bootstrap DB trigger (`handle_new_user()`) confirmed in migration — new signups won't have a `profiles` row without it
- [ ] Real auth flows working (`LoginPage` and `SignupPage` are form shells only)
- [ ] `RequireAuth` guard re-enabled in `App.tsx` (currently bypassed for frontend development)
- [ ] Data hooks replacing mock data (`frontend/src/hooks/` directory does not exist)
- [ ] Upload flow connected to Storage
- [ ] Real-time status updates
- [ ] Edge function retry / re-trigger strategy for failed extractions
- [ ] Payment integration
- [ ] Razorpay webhook Edge Function (B7 depends on this but no plan file exists for it)
- [ ] `backend/supabase/config.toml` updated to declare the `documents` storage bucket

### Critical Blockers (nothing works until these are done)
1. **`.env.local` missing** — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before any other step
2. **Profile bootstrap trigger not verified** — if `handle_new_user()` is missing from the migration, every hook relying on `profiles` will silently fail after signup
3. **Storage bucket not created** — uploads will error without the `documents` bucket

---

## Pre-Integration Checklist

Before starting integration, ensure:

```bash
# 1. Supabase CLI installed
brew install supabase/tap/supabase

# 2. Supabase project created at supabase.com
# 3. Get your project credentials from Settings > API

# 4. Create .env.local with:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 5. Link local project to remote
supabase link --project-ref your-project-ref

# 6. Verify handle_new_user() trigger exists in migration
#    Open backend/supabase/migrations/20260402_000001_vitalog_phase1_schema.sql
#    Confirm the following block is present (add it if missing):
#
#    create or replace function public.handle_new_user()
#    returns trigger language plpgsql security definer as $$
#    begin
#      insert into public.profiles (id, email, full_name)
#      values (new.id, new.email, new.raw_user_meta_data->>'full_name');
#      return new;
#    end;
#    $$;
#
#    create trigger on_auth_user_created
#      after insert on auth.users
#      for each row execute procedure public.handle_new_user();

# 7. Apply migrations
cd backend && supabase db push

# 8. Create the documents Storage bucket
supabase storage create documents --public=false

# 9. Set Edge Function secrets
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key

# 10. Verify backend/supabase/config.toml declares the bucket (add if missing):
#    [storage.buckets.documents]
#    public = false
```

---

## Phase B1: Auth Integration

**Goal:** Real authentication working end-to-end.

### Tasks

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1.1 | Create `.env.local` with Supabase credentials | `.env.local` | High |
| 1.2 | Test Supabase client connection | `frontend/src/lib/supabaseClient.ts` | High |
| 1.3 | Update `AuthProvider` to handle real sessions | `frontend/src/auth/AuthProvider.tsx` | High |
| 1.4 | Wire `LoginPage` to `supabase.auth.signInWithPassword` | `frontend/src/pages/LoginPage.tsx` | High |
| 1.5 | Wire `SignupPage` to `supabase.auth.signUp` | `frontend/src/pages/SignupPage.tsx` | High |
| 1.6 | Add Google OAuth flow | `LoginPage.tsx`, `SignupPage.tsx` | Medium |
| 1.7 | Enable `RequireAuth` guard in `App.tsx` | `frontend/src/App.tsx` | High |
| 1.8 | Add password reset flow | `LoginPage.tsx` | Low |
| 1.9 | Handle email verification | `AuthProvider.tsx` | Low |

### Exit Criteria
- User can sign up with email/password
- User can log in and session persists across refresh
- Unauthenticated users redirected to `/login`
- Google OAuth works (optional for v1)

---

## Phase B2: Data Hooks

**Goal:** Create reusable hooks that fetch real data from Supabase.

### Hooks to Create

```
frontend/src/hooks/
├── useProfile.ts         # Current user's profile
├── useDocuments.ts       # List of documents (reports)
├── useDocument.ts        # Single document with health values
├── useHealthValues.ts    # Health values for a document
├── useFamilyMembers.ts   # Family members list
├── useTimeline.ts        # Aggregated timeline data
└── useBiomarkerTrend.ts  # Trend data for a specific biomarker
```

### Tasks

| # | Task | File | Priority |
|---|------|------|----------|
| 2.1 | Create `useProfile` hook | `frontend/src/hooks/useProfile.ts` | High |
| 2.2 | Create `useDocuments` hook with filters | `frontend/src/hooks/useDocuments.ts` | High |
| 2.3 | Create `useDocument` hook (single) | `frontend/src/hooks/useDocument.ts` | High |
| 2.4 | Create `useHealthValues` hook | `frontend/src/hooks/useHealthValues.ts` | High |
| 2.5 | Create `useFamilyMembers` hook | `frontend/src/hooks/useFamilyMembers.ts` | Medium |
| 2.6 | Create `useTimeline` hook | `frontend/src/hooks/useTimeline.ts` | Medium |
| 2.7 | Create `useBiomarkerTrend` hook | `frontend/src/hooks/useBiomarkerTrend.ts` | Medium |
| 2.8 | Add loading/error states to all hooks | All hooks | High |

### Hook Patterns

```typescript
// Example: useDocuments.ts
export function useDocuments(filters?: DocumentFilters) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('report_date', { ascending: false })
      
      if (error) setError(error)
      else setDocuments(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [filters])

  return { documents, loading, error, refetch }
}
```

### Exit Criteria
- All hooks return `{ data, loading, error }`
- Hooks handle empty states gracefully
- Data is properly typed with TypeScript

---

## Phase B3: Page Integration

**Goal:** Replace mock data with real Supabase data on all pages.

### Tasks

| # | Task | Page | Hooks Used |
|---|------|------|------------|
| 3.1 | Dashboard: real stats & recent reports | `DashboardPage.tsx` | `useDocuments`, `useHealthValues` |
| 3.2 | Reports List: real reports with filters | `ReportsPage.tsx` | `useDocuments` |
| 3.3 | Report Detail: real values & explanation | `ReportDetailPage.tsx` | `useDocument`, `useHealthValues` |
| 3.4 | Timeline: real trend data | `HealthTimelinePage.tsx` | `useTimeline`, `useBiomarkerTrend` |
| 3.5 | Insights: real insights from health values | `InsightsPage.tsx` | `useHealthValues`, `useTimeline` |
| 3.6 | Family: real family members | `FamilyPage.tsx` | `useFamilyMembers` |
| 3.7 | Settings: real profile data | `SettingsPage.tsx` | `useProfile` |
| 3.8 | Biomarker Library: user's values overlay | `BiomarkerLibraryPage.tsx` | `useHealthValues` |

### Loading & Error States

Every page must handle:
- **Loading**: Show skeleton or spinner
- **Error**: Show error message with retry
- **Empty**: Show appropriate empty state with CTA

### Exit Criteria
- All pages show real data
- Loading states are smooth (no flicker)
- Error states are informative
- Empty states guide user to action

---

## Phase B4: Upload Flow

**Goal:** Full upload → extraction → display pipeline.

### Upload State Machine

```
IDLE → UPLOADING → PENDING → PROCESSING → COMPLETE
                                      ↘ FAILED
```

### Tasks

| # | Task | File | Priority |
|---|------|------|----------|
| 4.1 | Wire dropzone to Supabase Storage upload | `UploadModal.tsx` | High |
| 4.2 | Create document row with `status: pending` | `UploadModal.tsx` | High |
| 4.3 | Call extraction Edge Function | `UploadModal.tsx` | High |
| 4.4 | Poll or subscribe for status updates | `UploadModal.tsx` | High |
| 4.5 | Show extraction progress states | `UploadModal.tsx` | High |
| 4.6 | Handle extraction failure gracefully | `UploadModal.tsx` | High |
| 4.7 | Navigate to report detail on complete | `UploadModal.tsx` | Medium |

### Upload Implementation

```typescript
async function handleUpload(file: File) {
  setStatus('uploading')
  
  // 1. Upload to Storage
  const path = `${userId}/${uuid()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file)
  
  if (uploadError) { setStatus('failed'); return }

  // 2. Create document row
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      owner_id: userId,
      storage_path: `documents/${path}`,
      file_name: file.name,
      file_type: file.type,
      extraction_status: 'pending',
    })
    .select()
    .single()

  if (docError) { setStatus('failed'); return }

  // 3. Trigger extraction
  setStatus('processing')
  const { error: extractError } = await supabase.functions
    .invoke('extraction', { body: { document_id: doc.id } })

  // 4. Poll for completion or use Realtime
  pollForCompletion(doc.id)
}
```

### Realtime Subscription (Alternative to Polling)

```typescript
useEffect(() => {
  const channel = supabase
    .channel('document-status')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'documents',
      filter: `id=eq.${documentId}`,
    }, (payload) => {
      if (payload.new.extraction_status === 'complete') {
        setStatus('complete')
      } else if (payload.new.extraction_status === 'failed') {
        setStatus('failed')
      }
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [documentId])
```

### Extraction Retry Strategy

The edge function marks extraction as `failed` but provides no re-trigger mechanism. Add a manual retry to `ReportDetailPage`:

```typescript
async function retryExtraction(documentId: string) {
  await supabase
    .from('documents')
    .update({ extraction_status: 'pending' })
    .eq('id', documentId)

  await supabase.functions.invoke('extraction', {
    body: { document_id: documentId },
  })
}
```

Show a "Retry extraction" button on the report detail page when `extraction_status === 'failed'`. Do not allow infinite retries — cap at 3 attempts (add a `retry_count int default 0` column to `documents` if needed).

### Exit Criteria
- File uploads to Storage successfully
- Document row created with correct owner
- Extraction runs and updates status
- UI reflects all status changes
- Failed extractions show error + original file access
- Retry button visible and functional on failed reports

---

## Phase B5: Family Members CRUD

**Goal:** Full family member management.

### Tasks

| # | Task | File | Priority |
|---|------|------|----------|
| 5.1 | Wire add family member to Supabase | `AddFamilyMemberModal.tsx` | High |
| 5.2 | Wire family list to real data | `FamilyPage.tsx` | High |
| 5.3 | Add edit family member flow | New component | Medium |
| 5.4 | Add delete family member (with confirmation) | `FamilyPage.tsx` | Medium |
| 5.5 | Add profile switcher in TopBar | `TopBar.tsx` | Medium |
| 5.6 | Scope uploads to selected family member | `UploadModal.tsx` | Medium |
| 5.7 | Enforce free tier limit (1 family member) | `FamilyPage.tsx` | High |

### Exit Criteria
- Can add, edit, delete family members
- Family member data persists
- Free tier limited to 1 additional member
- Upload can target specific family member

---

## Phase B6: Profile & Settings

**Goal:** User can update their profile and preferences.

### Tasks

| # | Task | File | Priority |
|---|------|------|----------|
| 6.1 | Load real profile data | `SettingsPage.tsx` | High |
| 6.2 | Save profile updates to Supabase | `SettingsPage.tsx` | High |
| 6.3 | Avatar upload to Storage | `SettingsPage.tsx` | Low |
| 6.4 | Save notification preferences | `NotificationSettingsPage.tsx` | Low |
| 6.5 | Implement sign out | `TopBar.tsx`, `SettingsPage.tsx` | High |
| 6.6 | Implement account deletion (soft) | `PrivacyPage.tsx` | Medium |
| 6.7 | Implement data export (JSON/CSV) | `PrivacyPage.tsx` | Medium |

### Exit Criteria
- Profile changes persist
- Sign out clears session
- Account deletion marks for 30-day purge

---

## Phase B7: Subscription & Payments

**Goal:** Pro upgrade flow working.

### Tasks

| # | Task | File | Priority |
|---|------|------|----------|
| 7.1 | Integrate Razorpay SDK | New file | High |
| 7.2 | Create checkout flow | `SubscriptionPage.tsx` | High |
| 7.3 | Handle payment success webhook | Edge Function | High |
| 7.4 | Update `profiles.plan` on success | Edge Function | High |
| 7.5 | Show plan status in UI | `SubscriptionPage.tsx` | High |
| 7.6 | Gate features by plan | Various | High |
| 7.7 | Handle subscription cancellation | `SubscriptionPage.tsx` | Medium |

### Feature Gates

```typescript
// Free tier limits
const FREE_LIMITS = {
  maxUploads: 3,
  maxFamilyMembers: 1,
  hasTimeline: false,
  hasExport: false,
}

// Check in components
const { profile } = useProfile()
const isPro = profile?.plan === 'pro'

if (!isPro && uploadCount >= FREE_LIMITS.maxUploads) {
  showUpgradeModal()
}
```

### Razorpay Webhook Edge Function (missing — must be created)

No plan file exists for this. Create `backend/supabase/functions/razorpay-webhook/index.ts`:

```typescript
// backend/supabase/functions/razorpay-webhook/index.ts
// Receives Razorpay payment.captured events and upgrades the user's plan.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { createHmac } from 'https://deno.land/std@0.224.0/crypto/mod.ts'

serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? ''

  // Verify signature (HMAC-SHA256)
  const hmac = createHmac('sha256', secret)
  hmac.update(body)
  const expected = hmac.digest('hex')
  if (expected !== signature) {
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(body)
  if (event.event !== 'payment.captured') {
    return new Response('Ignored', { status: 200 })
  }

  const userId = event.payload.payment.entity.notes?.user_id
  if (!userId) return new Response('Missing user_id in notes', { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  await supabase
    .from('profiles')
    .update({ plan: 'pro' })
    .eq('id', userId)

  return new Response('OK', { status: 200 })
})
```

Set the required secrets:
```bash
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

Pass `user_id` in Razorpay's `notes` field when creating the order on the frontend so the webhook can identify the user without a database lookup.

### Exit Criteria
- Payment flow completes
- Webhook verifies Razorpay signature before acting
- Plan upgrades idempotently in database
- UI reflects plan status
- Feature gates enforce limits

---

## Phase B8: Testing & Validation

**Goal:** Ensure security and reliability.

### Tasks

| # | Task | Priority |
|---|------|----------|
| 8.1 | RLS validation: User A cannot access User B's data | Critical |
| 8.2 | RLS validation: Storage paths isolated | Critical |
| 8.3 | Test extraction on 10+ real Indian lab reports | High |
| 8.4 | Test upload failure recovery | High |
| 8.5 | Test session persistence across refresh | High |
| 8.6 | Test concurrent uploads | Medium |
| 8.7 | Test soft delete recovery | Medium |
| 8.8 | Load testing (optional) | Low |

### RLS Test Script

```sql
-- As User A, try to access User B's document
SELECT * FROM documents WHERE id = 'user-b-doc-id';
-- Should return 0 rows

-- Try to access via health_values
SELECT * FROM health_values WHERE document_id = 'user-b-doc-id';
-- Should return 0 rows
```

### Exit Criteria
- All RLS tests pass
- No cross-user data leakage
- Extraction accuracy ≥80% on test set

---

## Build Order

### Fastest Path to Working End-to-End

```
Sprint 1 — Get data flowing (1–2 days)
  Pre-checklist: .env.local, storage bucket, profile trigger verified
  B1: Auth wiring (env + signIn/signUp + RequireAuth on)
  B2: Core hooks (useDocuments, useDocument, useHealthValues)
  B3: Wire DashboardPage + ReportsPage + ReportDetailPage

Sprint 2 — Core feature (1 day)
  B4: Upload flow (Storage → document row → invoke extraction → Realtime)

Sprint 3 — Full product (2–3 days)
  B5: Family CRUD
  B6: Profile + sign out + account deletion
  B7: Razorpay checkout + webhook edge function
  B8: RLS validation (run phase1-rls-checklist.md)
```

### Single Most Important Unblock

Set `.env.local` first. Until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, the Supabase client throws on import and nothing works.

### Sequential dependency (do not skip):

```
B1: Auth Integration          ← Start here (env vars must be set first)
 ↓
B2: Data Hooks
 ↓
B3: Page Integration
 ↓
B4: Upload Flow               ← Core feature
 ↓
B5: Family Members
 ↓
B6: Profile & Settings
 ↓
B7: Subscription & Payments   ← Monetization (Razorpay webhook edge function required)
 ↓
B8: Testing & Validation      ← Before launch (run phase1-rls-checklist.md)
```

---

## Environment Variables

### Local Development (`.env.local`)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Edge Functions (Supabase Secrets)
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Production (Vercel)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Extraction accuracy too low | Test on 50 reports before building UI; iterate on prompts |
| RLS misconfiguration | Test cross-user access before every release |
| Payment webhook failures | Implement idempotency; log all payment events |
| Large file uploads | Client-side size validation; chunked upload for >10MB |
| Rate limiting | Implement request queuing; show user feedback |

---

## Definition of Done

Backend integration is complete when:

1. ✅ User can sign up, log in, and persist session
2. ✅ User can upload a report and see extracted values
3. ✅ User can view timeline with real trend data
4. ✅ User can manage family members
5. ✅ User can update profile settings
6. ✅ Pro upgrade flow works
7. ✅ All RLS tests pass
8. ✅ No mock data remains in production code
