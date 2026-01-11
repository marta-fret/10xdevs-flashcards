-- 20260111205900_disable_rls_policies.sql
-- description: disables all rls policies for flashcards, generations, and generation_error_logs tables.

-- disable flashcards policies
DROP POLICY "allow select for own flashcards" ON public.flashcards;
DROP POLICY "allow insert for own flashcards" ON public.flashcards;
DROP POLICY "allow update for own flashcards" ON public.flashcards;
DROP POLICY "allow delete for own flashcards" ON public.flashcards;

-- disable generations policies
DROP POLICY "allow select for own generation logs" ON public.generations;
DROP POLICY "allow insert for own generation logs" ON public.generations;
DROP POLICY "allow update for own generations" ON public.generations;
DROP POLICY "allow delete for own generations" ON public.generations;

-- disable generation_error_logs policies
DROP POLICY "allow select for own error logs" ON public.generation_error_logs;
DROP POLICY "allow insert for own error logs" ON public.generation_error_logs;

alter table public.flashcards disable row level security;
alter table public.generations disable row level security;
alter table public.generation_error_logs disable row level security;