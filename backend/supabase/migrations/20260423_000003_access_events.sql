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

alter table public.access_events enable row level security;

drop policy if exists access_events_select_own on public.access_events;
create policy access_events_select_own
on public.access_events
for select
using (user_id = auth.uid());
