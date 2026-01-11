/*
  20260111163000_init_schema.sql
  description: initial schema for flashcards, generations, and error logs based on the project plan.
  includes tables, relationships, indexes, rls policies, and triggers.
*/

-- create generations table
-- logs analytics data for each ai flashcard generation event.
create table public.generations (
    id bigserial primary key,
    user_id uuid not null,
    model varchar not null,
    generated_count integer not null,
    accepted_unedited_count integer,
    accepted_edited_count integer,
    source_text_hash varchar not null,
    source_text_length integer not null check (source_text_length between 1000 and 10000),
    generation_duration integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fk_generations_user foreign key (user_id) references auth.users(id) on delete cascade
);

-- enable rls for generations
alter table public.generations enable row level security;

-- create flashcards table
-- stores the flashcards created by users.
create table public.flashcards (
    id bigserial primary key,
    user_id uuid not null,
    front varchar(200) not null,
    back varchar(500) not null,
    source varchar not null check (source in ('ai-full', 'ai-edited', 'manual')),
    generation_id bigint,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fk_flashcards_user foreign key (user_id) references auth.users(id) on delete cascade,
    constraint fk_flashcards_generation foreign key (generation_id) references public.generations(id) on delete set null
);

-- enable rls for flashcards
alter table public.flashcards enable row level security;

-- create generation_error_logs table
-- logs errors that occur during the ai generation process.
create table public.generation_error_logs (
  id bigserial primary key,
  user_id uuid not null,
  model varchar not null,
  source_text_hash varchar not null,
  source_text_length integer not null check (source_text_length between 1000 and 10000),
  error_code varchar(100) not null,
  error_message text not null,
  created_at timestamptz not null default now(),
  constraint fk_generation_error_logs_user foreign key (user_id) references auth.users(id) on delete cascade
);

-- enable rls for generation_error_logs
alter table public.generation_error_logs enable row level security;

-- create indexes
create index flashcards_user_id_idx on public.flashcards (user_id);
create index flashcards_generation_id_idx on public.flashcards (generation_id);
create index generations_user_id_idx on public.generations (user_id);
create index generation_error_logs_user_id_idx on public.generation_error_logs (user_id);

-- create function to handle updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- create trigger for flashcards
create trigger on_flashcard_update
  before update on public.flashcards
  for each row
  execute function public.handle_updated_at();

-- create trigger for generations
create trigger on_generation_update
  before update on public.generations
  for each row
  execute function public.handle_updated_at();

-- rls policies

-- flashcards policies
-- allow authenticated users to view their own flashcards
create policy "allow select for own flashcards"
  on public.flashcards
  for select
  to authenticated
  using (auth.uid() = user_id);

-- allow authenticated users to insert their own flashcards
create policy "allow insert for own flashcards"
  on public.flashcards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- allow authenticated users to update their own flashcards
create policy "allow update for own flashcards"
  on public.flashcards
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- allow authenticated users to delete their own flashcards
create policy "allow delete for own flashcards"
  on public.flashcards
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- generations policies
-- allow authenticated users to view their own generation logs
create policy "allow select for own generation logs"
  on public.generations
  for select
  to authenticated
  using (auth.uid() = user_id);

-- allow authenticated users to insert their own generation logs
create policy "allow insert for own generation logs"
  on public.generations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "allow update for own generations"
  on public.generations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "allow delete for own generations"
  on public.generations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- generation_error_logs policies
-- allow authenticated users to view their own error logs
create policy "allow select for own error logs"
  on public.generation_error_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

-- allow authenticated users to insert their own error logs
create policy "allow insert for own error logs"
  on public.generation_error_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Note: Update and Delete policies are intentionally omitted as error logs should be immutable

