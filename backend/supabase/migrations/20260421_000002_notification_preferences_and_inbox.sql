-- Notification preferences on profiles + in-app notifications inbox

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

alter table public.in_app_notifications enable row level security;

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
