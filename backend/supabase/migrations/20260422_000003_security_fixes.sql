-- Security fixes: RLS delete policies + missing indexes

-- M1: Allow users to delete their own in-app notifications (GDPR right to erasure).
drop policy if exists in_app_notifications_delete_own on public.in_app_notifications;
create policy in_app_notifications_delete_own
  on public.in_app_notifications
  for delete
  using (owner_id = auth.uid());

-- Documents delete policy (defense-in-depth; app-level enforces soft deletes).
drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own
  on public.documents
  for delete
  using (owner_id = auth.uid());

-- M5: Indexes on family_member_id to prevent full table scans on family-filtered queries.
create index if not exists documents_family_member_idx
  on public.documents (family_member_id);

create index if not exists health_values_family_member_idx
  on public.health_values (family_member_id);
