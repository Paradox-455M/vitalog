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
  created_at timestamptz default now()
);

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

-- 3) RLS (row-level security) - required on ALL tables
alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.documents enable row level security;
alter table public.health_values enable row level security;

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

