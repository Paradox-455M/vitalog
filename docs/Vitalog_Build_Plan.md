# Vitalog Build Plan

This plan translates the product context in `context/CLAUDE_CODE_CONTEXT.md` into an execution sequence from the current repo state.

## Current State

As of April 2, 2026, this project directory contains product context, a landing page reference, and a PRD, but no app scaffold yet. That means app bootstrap is a real delivery phase, not assumed-complete setup work.

## Planning Principles

- Keep the build aligned with Vitalog's core moat: comprehension plus longitudinal insight, not generic storage.
- Validate extraction quality before investing heavily in downstream UI.
- Treat privacy and RLS as first-class product requirements, not polish work.
- Preserve the original medical file at every stage.
- Keep AI output strictly non-diagnostic.

## Phase 0: App Bootstrap and Environments

Scope:
- Create the React + TypeScript + Vite app scaffold
- Add React Router and base route structure
- Set up design tokens from `design/landing_page.html`
- Wire Supabase client configuration
- Add environment variable handling for local, preview, and production
- Configure Vercel deployment
- Add Sentry to the frontend shell

Deliverables:
- `/`
- `/login`
- `/signup`
- Shared layout, fonts, tokens, and route shell

Exit criteria:
- App runs locally
- Preview deployment works
- Landing page, login, and signup routes render without placeholder build errors

Dependencies:
- Supabase project created
- Vercel project created

## Phase 1: Data and Security Foundation

Scope:
- Implement database schema for `profiles`, `family_members`, `documents`, and `health_values`
- Add missing `deleted_at` support for document soft deletes
- Set up Supabase Storage buckets and access rules
- Create RLS policies for every table
- Add profile bootstrapping after signup

Deliverables:
- SQL migrations
- Storage path conventions
- RLS test checklist

Exit criteria:
- User A cannot read User B's rows by direct query or route access
- User A cannot access User B's stored files by path guess
- Document rows support soft delete semantics

Dependencies:
- Phase 0 complete

## Phase 2: Extraction Engine Validation

Scope:
- Build the async extraction pipeline after upload
- Fetch uploaded files from storage
- Call the Vision model with the extraction prompt
- Parse and validate structured JSON
- Normalize test names with `CANONICAL_MAP`
- Insert `health_values`
- Generate and cache plain-language explanations
- Mark document states as `pending`, `processing`, `complete`, or `failed`

Deliverables:
- Extraction worker or edge function
- JSON validation layer
- Canonical normalization module
- Explanation generation module
- Failure handling and retry strategy

Exit criteria:
- End-to-end processing works for uploaded PDFs and images
- Extraction failures are visible and preserve the original file
- Manual evaluation across 50 real Indian lab reports reaches at least 80% extraction accuracy

Dependencies:
- Phase 1 complete
- AI API credentials available

## Phase 3: Auth and First-Upload Onboarding

Scope:
- Implement email auth
- Implement Google OAuth
- Create the post-signup profile setup flow
- Add consent copy and required policy acknowledgements
- Route first-time users directly into the upload flow

Deliverables:
- Auth screens
- Session persistence
- First-run redirect logic

Exit criteria:
- New user can sign up, land in the app, and start their first upload without dead ends
- Returning user session handling works across refreshes

Dependencies:
- Phase 0 complete
- Phase 1 schema available

## Phase 4: Upload and Report Detail MVP

Scope:
- Build drag-and-drop upload UI
- Validate type and size client-side
- Upload original files to Supabase Storage
- Create `documents` rows
- Show processing state and completion state
- Build report detail page with:
  - original document access
  - cached explanation
  - extracted values
  - failed-processing messaging

Deliverables:
- `/upload`
- `/reports/:id`
- Progress, status, and error states

Exit criteria:
- User can upload a supported file and see the final extracted result end to end
- Original file is always available
- Failed extraction does not block access to the stored document

Dependencies:
- Phase 2 complete
- Phase 3 auth flow usable

## Phase 5: Dashboard and Document Management

Scope:
- Build chronological dashboard of uploads
- Add filters for date range and document type
- Add search across report metadata and extracted content
- Add download original file action
- Add soft delete and recovery UX

Deliverables:
- `/dashboard`
- List views, empty states, and filter controls
- Soft delete and recovery flow

Exit criteria:
- User can find, open, download, delete, and recover reports reliably
- Failed documents remain visible with clear status

Dependencies:
- Phase 4 complete

## Phase 6: Longitudinal Timeline

Scope:
- Build timeline queries from `health_values`
- Show per-metric charts with reference range context
- Flag changes greater than 15% between consecutive reports
- Support deep dive by canonical metric

Deliverables:
- `/timeline`
- `/timeline/:canonical_name`
- Recharts-based trend visualization
- Delta insight generation

Exit criteria:
- User with two or more reports can see trend lines for repeated values
- Significant deltas are surfaced with plain-language notes

Dependencies:
- Phase 2 extraction quality validated
- Phase 5 dashboard loop stable

## Phase 7: Family Profiles

Scope:
- Add family member CRUD
- Add active-profile switching
- Scope uploads, dashboard, and timeline by family member
- Enforce profile-level access through ownership rules

Deliverables:
- Family member management in `/profile`
- Profile switcher across core product surfaces

Exit criteria:
- One account can manage multiple family profiles without data mixing
- Profile switching updates uploads, reports, and trends correctly

Dependencies:
- Phase 5 complete
- Phase 6 complete or near-complete

## Phase 8: Trust, Gating, and Launch Readiness

Scope:
- Add privacy dashboard
- Add data export
- Add account deletion workflow
- Add free-tier gating and Pro entitlements
- Add analytics for north-star and funnel metrics
- Harden operational alerts and recovery flows

Deliverables:
- Privacy and account controls
- Entitlement checks for free vs Pro
- Event tracking for upload, explanation-read, and return behavior

Exit criteria:
- Design partners can complete the full product loop without manual support
- Key metrics are measurable
- Privacy, deletion, and export flows are usable and testable

Dependencies:
- Core MVP stable

## Recommended Build Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8

This order intentionally keeps extraction validation ahead of heavy product UI work. For Vitalog, weak extraction quality would undermine every later screen.

## Immediate Next Step

Start Phase 0 by scaffolding the Vite app, routing, shared design tokens, Supabase client wiring, and deployment configuration. That creates the base needed for schema work and auth without guessing at app structure later.
