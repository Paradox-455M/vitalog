# Phase 1 RLS Verification Checklist

Goal: confirm cross-user isolation for `profiles`, `family_members`, `documents`, `health_values` and for Storage bucket objects.

## Prerequisites
1. Phase 1 migration is pushed to your Supabase project (`cd backend && supabase db push --linked`).
2. Create two test users in Supabase Auth: `User A` and `User B`.
3. Sign in as `User A` once (so they have an `auth.users` row and your `public.handle_new_user()` trigger creates a `profiles` row).

## Database isolation tests

### 1) `profiles`
1. Sign in as `User A`.
2. In the SQL editor (or via supabase-js), attempt:
   - `select * from public.profiles;`
3. Expected: you only see `User A`’s profile row.

### 2) `family_members`
1. Sign in as `User A`.
2. Insert a family member row for `User A` (any valid `owner_id` created for `User A`).
3. Sign in as `User B`.
4. Attempt:
   - `select * from public.family_members;`
5. Expected: `User B` sees 0 rows from `User A`.

### 3) `documents` (including soft deletes)
1. Sign in as `User A`.
2. Insert a document row (or upload a file in Phase 2 later).
3. Verify that a basic query works:
   - `select * from public.documents;`
4. Soft-delete the document as `User A`:
   - `update public.documents set deleted_at = now() where owner_id = auth.uid();`
5. Expected:
   - `documents_select_own` only returns rows where `deleted_at is null`.

### 4) `health_values` (join through `documents`)
1. Sign in as `User A`.
2. Insert at least one `health_values` row tied to a `documents.id` owned by `User A`.
3. Expected query:
   - `select * from public.health_values;`
   - returns only the rows for documents owned by `User A`.
4. Sign in as `User B`.
5. Expected:
   - `select * from public.health_values;` returns 0 rows for `User A` documents.

## Storage isolation tests

Assumption: files are stored under:
- bucket: `documents`
- object name: `documents/{owner_id}/{uuid}.{ext}` (i.e., prefix is `{owner_id}/...`)

### 1) List/select access
1. Sign in as `User A`.
2. Attempt to list or download a file object whose name starts with `User A`’s `auth.uid()` string.
3. Expected: access succeeds.

### 2) Cross-user file access
1. Sign in as `User B`.
2. Attempt to download a file stored under `User A`’s prefix.
3. Expected: access is denied (403 or empty result), because policies check:
   - `split_part(name, '/', 1) = auth.uid()::text`

## Profile bootstrap check
1. Create a brand-new user in Supabase Auth.
2. Sign in as that new user.
3. Expected: a matching `public.profiles` row exists with:
   - `plan = 'free'`

## Done criteria
1. User A cannot read any rows belonging to User B in `profiles`, `family_members`, `documents`, `health_values`.
2. User A cannot access User B’s Storage objects in bucket `documents`.
3. Soft-deleted documents are not returned by default document selects (where `deleted_at` is set).
