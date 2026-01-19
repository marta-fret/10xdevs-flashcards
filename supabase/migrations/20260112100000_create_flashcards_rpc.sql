-- This migration creates a PostgreSQL function (`create_flashcards`) that handles the creation of flashcards
-- and updates related generation counters in a single, atomic transaction.

-- First, define a custom type `flashcard_input` that matches the structure of the flashcard data
-- we expect to receive. This makes it easier to pass an array of flashcards to the function.
create type flashcard_input as (
  front text,
  back text,
  source text, -- Using text to match the varchar type in the table
  generation_id bigint
);

-- Define the main function `create_flashcards`.
-- It is declared with `security definer` to run with the permissions of the user who defines it,
-- allowing for controlled access to tables.
create or replace function create_flashcards(
  p_user_id uuid, -- The ID of the user creating the flashcards.
  p_flashcards flashcard_input[] -- An array of flashcards to be created.
)
returns setof flashcards -- The function will return a set of the newly created flashcard rows.
as $$
declare
  -- Declare variables that will be used within the function.
  v_generation_ids bigint[]; -- To store unique generation IDs from the input.
  v_generation_id bigint; -- For iterating through generation IDs.
  v_user_id_match uuid; -- To check if a generation belongs to the user.
  v_delta_map jsonb := '{}'::jsonb; -- A JSONB object to track counter updates for each generation.
  v_flashcard flashcard_input; -- For iterating through the input flashcards.
  v_key text; -- To use as a key in the JSONB map (the generation ID).
  v_inserted_flashcards flashcards[]; -- To store the flashcards that are inserted into the database.
  v_delta_value jsonb; -- For iterating through the JSONB delta map.
begin
  -- Step 1: Extract all unique, non-null generation IDs from the input array.
  -- This prevents redundant checks and prepares for validation.
  select array_agg(distinct (fc.generation_id))
  into v_generation_ids
  from unnest(p_flashcards) as fc
  where fc.generation_id is not null;

  -- Step 2: Verify that all specified generations exist and belong to the authenticated user.
  -- This is a critical security check to prevent a user from associating flashcards with another user's generations.
  if array_length(v_generation_ids, 1) > 0 then
    foreach v_generation_id in array v_generation_ids
    loop
      -- Check if the generation exists and if its `user_id` matches the provided `p_user_id`.
      select user_id into v_user_id_match from generations where id = v_generation_id;
      if not found or v_user_id_match <> p_user_id then
        -- If a generation is not found or doesn't belong to the user, raise an exception.
        -- This will roll back the entire transaction.
        raise exception 'Invalid generation_id: %', v_generation_id using errcode = 'P0001';
      end if;
    end loop;
  end if;

  -- Step 3: Calculate the counter deltas for accepted AI-generated cards.
  -- This aggregates how many 'ai-full' and 'ai-edited' cards are being accepted for each generation.
  foreach v_flashcard in array p_flashcards
  loop
    if v_flashcard.generation_id is not null then
      v_key := v_flashcard.generation_id::text;
      -- Initialize the counter object for a generation if it's not already in the map.
      if not (v_delta_map ? v_key) then
        v_delta_map := v_delta_map || jsonb_build_object(v_key, '{"full": 0, "edited": 0}');
      end if;

      -- Increment the 'full' counter for 'ai-full' source.
      if v_flashcard.source = 'ai-full' then
        v_delta_map := jsonb_set(
          v_delta_map,
          array[v_key, 'full'],
          (v_delta_map->v_key->'full')::numeric + 1
        );
      -- Increment the 'edited' counter for 'ai-edited' source.
      elsif v_flashcard.source = 'ai-edited' then
        v_delta_map := jsonb_set(
          v_delta_map,
          array[v_key, 'edited'],
          (v_delta_map->v_key->'edited')::numeric + 1
        );
      end if;
    end if;
  end loop;

  -- Step 4: Insert all the new flashcards into the `flashcards` table in a single operation.
  -- Using a Common Table Expression (CTE) with `returning *` is efficient for bulk inserts.
  with inserted as (
    insert into public.flashcards (user_id, front, back, source, generation_id)
    select p_user_id, fc.front, fc.back, fc.source, fc.generation_id
    from unnest(p_flashcards) as fc
    returning *
  )
  -- Store the newly inserted rows into the `v_inserted_flashcards` variable.
  select array_agg(inserted) into v_inserted_flashcards from inserted;

  -- Step 5: Update the `generations` table with the new acceptance counts.
  if v_delta_map <> '{}'::jsonb then
    for v_key, v_delta_value in select * from jsonb_each(v_delta_map)
    loop
      update public.generations
      set
        accepted_unedited_count = accepted_unedited_count + (v_delta_value->>'full')::int,
        accepted_edited_count = accepted_edited_count + (v_delta_value->>'edited')::int,
        updated_at = now()
      where id = v_key::bigint;
    end loop;
  end if;

  -- Step 6: Return the set of flashcards that were just created.
  -- The `unnest` function expands the array of flashcards into a set of rows.
  return query select * from unnest(v_inserted_flashcards);
end;
$$ language plpgsql security definer;
