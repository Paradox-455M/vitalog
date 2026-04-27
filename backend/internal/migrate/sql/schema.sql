-- Vitalog Phase 1: schema + soft deletes + RLS + Storage + profile bootstrap

create extension if not exists pgcrypto;

-- 1) Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free'
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  relationship text,
  date_of_birth date,
  created_at timestamptz default now(),
  deleted_at timestamptz -- soft delete
);

-- Backfill: add deleted_at column if table already exists without it
alter table public.family_members add column if not exists deleted_at timestamptz;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete cascade,
  storage_path text not null, -- Supabase Storage path (documents/{owner_id}/{uuid}.{ext})
  file_name text not null,
  file_type text,
  document_type text,
  report_date date,
  lab_name text,
  extraction_status text not null default 'pending', -- pending | processing | complete | failed
  explanation_text text, -- cached plain-language explanation
  created_at timestamptz default now(),
  deleted_at timestamptz -- soft delete (do not hard-delete reports)
);

create table if not exists public.health_values (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete cascade,
  canonical_name text not null,
  display_name text not null,
  value numeric not null,
  unit text,
  reference_low numeric,
  reference_high numeric,
  is_flagged boolean not null default false,
  report_date date not null, -- denormalised for efficient timeline queries
  created_at timestamptz default now()
);

-- 2) Indexes for common queries
create index if not exists documents_owner_id_idx on public.documents (owner_id);
create index if not exists documents_report_date_idx on public.documents (report_date);
create index if not exists health_values_canonical_date_idx on public.health_values (canonical_name, report_date);
-- M5: Family-member-scoped queries are common; prevent full table scans.
create index if not exists documents_family_member_idx on public.documents (family_member_id);
create index if not exists health_values_family_member_idx on public.health_values (family_member_id);
create index if not exists health_values_document_id_idx on public.health_values (document_id);
create index if not exists documents_extraction_status_idx on public.documents (extraction_status);

-- Notification preferences (per-user) + in-app inbox
alter table public.profiles
  add column if not exists notification_preferences jsonb
  default '{"new_report": true, "trend_detected": true, "family_updates": false, "health_tips": true, "email": true, "push": true, "whatsapp": false, "tone": "soft"}'::jsonb;

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  source_document_id uuid references public.documents(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists in_app_notifications_owner_created_idx
  on public.in_app_notifications (owner_id, created_at desc);
create index if not exists in_app_notifications_owner_unread_idx
  on public.in_app_notifications (owner_id)
  where read_at is null;
create unique index if not exists in_app_notifications_dedup_doc_kind
  on public.in_app_notifications (owner_id, source_document_id, kind)
  where source_document_id is not null;

-- Access / sign-in audit for privacy page (IP only; no GeoIP in v1)
create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  event_type text not null default 'sign_in'
);

create index if not exists access_events_user_created_idx
  on public.access_events (user_id, created_at desc);

-- Razorpay payment.captured audit (billing history)
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  razorpay_payment_id text not null unique,
  amount_paise int not null,
  currency text not null default 'INR',
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_user_created_idx
  on public.payment_events (user_id, created_at desc);

-- 3) RLS (row-level security) - required on ALL tables
alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.documents enable row level security;
alter table public.health_values enable row level security;
alter table public.in_app_notifications enable row level security;
alter table public.access_events enable row level security;
alter table public.payment_events enable row level security;

-- profiles: each user can only see/update their own row
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- in_app_notifications: owner can read, mark read, and delete; inserts from Go (service role) bypass RLS
drop policy if exists in_app_notifications_select_own on public.in_app_notifications;
create policy in_app_notifications_select_own
on public.in_app_notifications
for select
using (owner_id = auth.uid());

drop policy if exists in_app_notifications_update_own on public.in_app_notifications;
create policy in_app_notifications_update_own
on public.in_app_notifications
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- M1: Allow users to delete their own notifications (GDPR right to erasure).
drop policy if exists in_app_notifications_delete_own on public.in_app_notifications;
create policy in_app_notifications_delete_own
on public.in_app_notifications
for delete
using (owner_id = auth.uid());

-- access_events: users read own rows; inserts from API use DB role (bypasses RLS)
drop policy if exists access_events_select_own on public.access_events;
create policy access_events_select_own
on public.access_events
for select
using (user_id = auth.uid());

-- payment_events: users read own rows; inserts from Go bypass RLS
drop policy if exists payment_events_select_own on public.payment_events;
create policy payment_events_select_own
on public.payment_events
for select
using (user_id = auth.uid());

-- family_members: owner can CRUD their family members
drop policy if exists family_members_select_own on public.family_members;
create policy family_members_select_own
on public.family_members
for select
using (owner_id = auth.uid());

drop policy if exists family_members_insert_own on public.family_members;
create policy family_members_insert_own
on public.family_members
for insert
with check (owner_id = auth.uid());

drop policy if exists family_members_update_own on public.family_members;
create policy family_members_update_own
on public.family_members
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists family_members_delete_own on public.family_members;
create policy family_members_delete_own
on public.family_members
for delete
using (owner_id = auth.uid());

-- documents: owner can see only their own non-deleted documents; owner can update (soft-delete)
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own
on public.documents
for select
using (owner_id = auth.uid() and deleted_at is null);

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own
on public.documents
for insert
with check (owner_id = auth.uid());

drop policy if exists documents_update_own on public.documents;
create policy documents_update_own
on public.documents
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Defense-in-depth: explicit delete policy (soft deletes are enforced in the app layer).
drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own
on public.documents
for delete
using (owner_id = auth.uid());

-- health_values: visible only through documents the owner can read
drop policy if exists health_values_select_own on public.health_values;
create policy health_values_select_own
on public.health_values
for select
using (
  exists (
    select 1
    from public.documents d
    where d.id = health_values.document_id
      and d.owner_id = auth.uid()
      and d.deleted_at is null
  )
);

drop policy if exists health_values_insert_own on public.health_values;
create policy health_values_insert_own
on public.health_values
for insert
with check (
  exists (
    select 1
    from public.documents d
    where d.id = health_values.document_id
      and d.owner_id = auth.uid()
      and d.deleted_at is null
  )
);

drop policy if exists health_values_update_own on public.health_values;
create policy health_values_update_own
on public.health_values
for update
using (
  exists (
    select 1
    from public.documents d
    where d.id = health_values.document_id
      and d.owner_id = auth.uid()
      and d.deleted_at is null
  )
)
with check (
  exists (
    select 1
    from public.documents d
    where d.id = health_values.document_id
      and d.owner_id = auth.uid()
      and d.deleted_at is null
  )
);

-- 4) Storage bucket + policies for raw documents
-- Bucket: documents (objects stored at documents/{owner_id}/{uuid}.{ext} inside the bucket)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists storage_objects_select_documents_own on storage.objects;
create policy storage_objects_select_documents_own
on storage.objects
for select
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists storage_objects_insert_documents_own on storage.objects;
create policy storage_objects_insert_documents_own
on storage.objects
for insert
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists storage_objects_update_documents_own on storage.objects;
create policy storage_objects_update_documents_own
on storage.objects
for update
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists storage_objects_delete_documents_own on storage.objects;
create policy storage_objects_delete_documents_own
on storage.objects
for delete
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- 5) Profile bootstrap on first auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    null,
    'free'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 6) Encryption: per-user DEK store
create table if not exists public.user_keys (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  encrypted_dek bytea not null,
  created_at    timestamptz default now()
);

alter table public.user_keys enable row level security;

drop policy if exists user_keys_select_own on public.user_keys;
create policy user_keys_select_own
on public.user_keys
for select
using (user_id = auth.uid());

-- Idempotent column type changes: numeric/text → BYTEA for sensitive health fields.
-- Existing plaintext data is preserved as raw bytes; run cmd/migrate-encrypt to re-encrypt.
do $$
begin
  -- health_values.value: numeric → bytea
  -- convert_to() encodes the text representation as UTF-8 bytes, avoiding the hex-only
  -- restriction on direct ::bytea casts introduced in PostgreSQL 9.0.
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'health_values' and column_name = 'value')
     in ('numeric', 'integer', 'real', 'double precision', 'bigint') then
    alter table public.health_values alter column value drop not null;
    alter table public.health_values alter column value type bytea using convert_to(value::text, 'UTF8');
  end if;

  -- health_values.reference_low: numeric → bytea
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'health_values' and column_name = 'reference_low')
     in ('numeric', 'integer', 'real', 'double precision', 'bigint') then
    alter table public.health_values alter column reference_low type bytea using convert_to(reference_low::text, 'UTF8');
  end if;

  -- health_values.reference_high: numeric → bytea
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'health_values' and column_name = 'reference_high')
     in ('numeric', 'integer', 'real', 'double precision', 'bigint') then
    alter table public.health_values alter column reference_high type bytea using convert_to(reference_high::text, 'UTF8');
  end if;

  -- documents.explanation_text: text → bytea
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'explanation_text')
     = 'text' then
    alter table public.documents alter column explanation_text type bytea using convert_to(explanation_text, 'UTF8');
  end if;

  -- family_members.name: text → bytea
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'family_members' and column_name = 'name')
     = 'text' then
    alter table public.family_members alter column name type bytea using convert_to(name, 'UTF8');
  end if;

  -- family_members.date_of_birth: date → bytea
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'family_members' and column_name = 'date_of_birth')
     = 'date' then
    alter table public.family_members alter column date_of_birth type bytea using convert_to(date_of_birth::text, 'UTF8');
  end if;
end $$;

