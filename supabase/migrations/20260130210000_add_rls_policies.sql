/*
  20260130210000_add_rls_policies.sql
  description: re-enable row level security (rls) and define per-user policies
    for flashcards, generations, and generation_error_logs tables.
  tables: public.flashcards, public.generations, public.generation_error_logs
  notes:
    - flashcards and generations are fully manageable (crud) by their owner.
    - generation_error_logs remain immutable (no update/delete by design).
*/

-- enable row level security on all relevant tables.
-- this is safe to run even if rls was already enabled; the command is idempotent.
alter table public.flashcards enable row level security;
alter table public.generations enable row level security;
alter table public.generation_error_logs enable row level security;

-- optionally, you could force rls so it cannot be bypassed by superusers.
-- keeping it as standard rls here for clarity.

-- ============================================================================
-- flashcards rls policies
-- each authenticated user can fully manage only their own flashcards.
-- anonymous users are explicitly denied for all operations.
-- ============================================================================

-- authenticated: select own flashcards
create policy "authenticated_select_own_flashcards"
  on public.flashcards
  for select
  to authenticated
  using (auth.uid() = user_id);

-- authenticated: insert own flashcards
create policy "authenticated_insert_own_flashcards"
  on public.flashcards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- authenticated: update own flashcards
create policy "authenticated_update_own_flashcards"
  on public.flashcards
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- authenticated: delete own flashcards
create policy "authenticated_delete_own_flashcards"
  on public.flashcards
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- anon: explicitly deny all access to flashcards
-- using (false) means no rows are ever visible or modifiable for this role.
create policy "anon_no_access_flashcards_select"
  on public.flashcards
  for select
  to anon
  using (false);

create policy "anon_no_access_flashcards_insert"
  on public.flashcards
  for insert
  to anon
  with check (false);

create policy "anon_no_access_flashcards_update"
  on public.flashcards
  for update
  to anon
  using (false)
  with check (false);

create policy "anon_no_access_flashcards_delete"
  on public.flashcards
  for delete
  to anon
  using (false);

-- ============================================================================
-- generations rls policies
-- each authenticated user can fully manage only their own generation records.
-- anonymous users are explicitly denied for all operations.
-- ============================================================================

-- authenticated: select own generations
create policy "authenticated_select_own_generations"
  on public.generations
  for select
  to authenticated
  using (auth.uid() = user_id);

-- authenticated: insert own generations
create policy "authenticated_insert_own_generations"
  on public.generations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- authenticated: update own generations
create policy "authenticated_update_own_generations"
  on public.generations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- authenticated: delete own generations
create policy "authenticated_delete_own_generations"
  on public.generations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- anon: explicitly deny all access to generations
create policy "anon_no_access_generations_select"
  on public.generations
  for select
  to anon
  using (false);

create policy "anon_no_access_generations_insert"
  on public.generations
  for insert
  to anon
  with check (false);

create policy "anon_no_access_generations_update"
  on public.generations
  for update
  to anon
  using (false)
  with check (false);

create policy "anon_no_access_generations_delete"
  on public.generations
  for delete
  to anon
  using (false);

-- ============================================================================
-- generation_error_logs rls policies
-- generation error logs are owned by a user but are intended to be immutable
-- audit records. authenticated users can read and insert their own logs
-- but cannot update or delete them. anonymous users are fully denied.
-- ============================================================================

-- authenticated: select own error logs
create policy "authenticated_select_own_error_logs"
  on public.generation_error_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

-- authenticated: insert own error logs
create policy "authenticated_insert_own_error_logs"
  on public.generation_error_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- note: no update/delete policies for authenticated users on
-- generation_error_logs to keep these records immutable.

-- anon: explicitly deny all access to error logs
create policy "anon_no_access_error_logs_select"
  on public.generation_error_logs
  for select
  to anon
  using (false);

create policy "anon_no_access_error_logs_insert"
  on public.generation_error_logs
  for insert
  to anon
  with check (false);

create policy "anon_no_access_error_logs_update"
  on public.generation_error_logs
  for update
  to anon
  using (false)
  with check (false);

create policy "anon_no_access_error_logs_delete"
  on public.generation_error_logs
  for delete
  to anon
  using (false);
