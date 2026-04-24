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

alter table public.payment_events enable row level security;

drop policy if exists payment_events_select_own on public.payment_events;
create policy payment_events_select_own
on public.payment_events
for select
using (user_id = auth.uid());
