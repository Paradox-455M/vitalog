# Phase 3: Auth & Onboarding — Design Spec

**Date:** 2026-04-16
**Status:** Approved

---

## Overview

Wire the existing auth UI (LoginPage, SignupPage) to real Supabase auth, re-enable the RequireAuth guard, and add a first-run onboarding screen that routes new users into their first upload.

Out of scope for this phase: Google OAuth (Phase 8), password reset (Phase 8), email confirmation (Phase 8).

---

## 1. Auth Wiring and Guards

### AuthProvider in main.tsx
`AuthProvider` currently exists but is not wrapping `App`. Add it in `main.tsx` so `useAuth()` is available throughout the tree.

```
<StrictMode>
  <AuthProvider>
    <App />
  </AuthProvider>
</StrictMode>
```

### RequireAuth re-enabled in App.tsx
Wrap the `AppShell` layout route in `<RequireAuth>`. All routes rendered inside `AppShell` become protected: `/dashboard`, `/reports`, `/reports/:id`, `/timeline`, `/family`, `/biomarkers`, `/insights`, `/settings`, `/settings/notifications`, `/settings/privacy`, `/settings/subscription`.

Public routes (no guard): `/`, `/login`, `/signup`, `/onboarding`.

`/onboarding` is intentionally public — the user has just created a session and the guard would cause a flash redirect before the session is confirmed client-side.

### RequireAuth loading state
Replace the current bare `<div style={{ padding: 16 }}>Loading...</div>` with a full-screen centered spinner using design system tokens (`bg-surface`, `text-primary`).

---

## 2. Email Confirmation

### Local config
Set `enable_confirmations = false` in `backend/supabase/config.toml` under `[auth.email]`. This covers local development.

### Remote Supabase dashboard (manual step)
`supabase db push` does not sync auth settings to the remote project. After applying local changes, manually disable "Confirm email" in the Supabase dashboard: **Authentication → Providers → Email → Confirm email → off**.

### Signup flow change
With confirmation disabled, Supabase returns a session immediately on `signUp`. `SignupPage` navigates to `/onboarding` on success (previously `/dashboard`).

Defensive fallback: if `data.session` is null (e.g., config drift where confirmation is still on remotely), show an inline message: *"Account created — please check your email to verify before signing in."* This prevents the user from being silently stuck.

---

## 3. Onboarding Page (`/onboarding`)

A new `OnboardingPage` component, added as a public route outside `AppShell`.

### Layout
Full-screen `bg-surface`, centered single column, no navigation chrome.

### Content
Three parts:

1. **Header** — leaf icon mark (`energy_savings_leaf`), heading "Welcome to Vitalog", and 2-line value prop:
   > *"Upload a lab report and we'll extract your results, explain what they mean, and build your personal health timeline over time."*

2. **CTA** — primary button: "Upload your first report". On click, sets `uploadOpen: true` and renders `<UploadModal open={true} onClose={handleModalClose} />`. When the modal closes (dismiss or upload complete), navigate to `/dashboard`.

3. **Skip link** — small muted text link below the button: "Skip for now →". Navigates to `/dashboard`. Handles the case where a returning user lands on `/onboarding` or a new user prefers to explore first.

### No guard needed
If a returning user navigates directly to `/onboarding`, the skip link exits cleanly. No redirect logic required.

---

## 4. Disabled OAuth and Dead Links

### Google OAuth buttons
Both `LoginPage` and `SignupPage` have an "Continue with Google" button with no handler. Add `disabled` attribute and `title="Coming soon"`. Apply `opacity-50 cursor-not-allowed` classes. No functional handler until Phase 8.

### "Forgot password?" link
In `LoginPage`, replace `<a href="#">Forgot password?</a>` with a `<span>` using muted text styling and `cursor-default`. It is no longer interactive. Will become a real link in Phase 8 when password reset is implemented.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/main.tsx` | Wrap `App` in `<AuthProvider>` |
| `frontend/src/App.tsx` | Wrap `AppShell` route in `<RequireAuth>`, add `/onboarding` route |
| `frontend/src/components/RequireAuth.tsx` | Replace loading div with styled full-screen spinner |
| `frontend/src/pages/SignupPage.tsx` | Navigate to `/onboarding` on success; add fallback message |
| `frontend/src/pages/LoginPage.tsx` | Disable OAuth button; replace "Forgot password?" with inert span |
| `frontend/src/pages/OnboardingPage.tsx` | New file — welcome screen + UploadModal trigger |
| `backend/supabase/config.toml` | Set `enable_confirmations = false` |

---

## Success Criteria

- Unauthenticated user visiting `/dashboard` is redirected to `/login`
- New signup → lands on `/onboarding`, can open upload modal, can skip to dashboard
- Returning user login → lands on `/dashboard`
- Auth state persists across page refresh
- Google OAuth and "Forgot password?" are visibly disabled, not broken
