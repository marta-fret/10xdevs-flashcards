# PostgreSQL Database Schema for AI Flashcards

This document outlines the database schema for the AI Flashcards application, designed for PostgreSQL and managed via Supabase. The schema is based on the project's PRD and decisions from the database planning session.

## 1. Tables

The schema consists of three custom tables: `flashcards`, `generations`, and `generation_error_logs`. The `users` table is provided by Supabase Authentication.

### `flashcards`

Stores the flashcards created by users.

| Column | Data Type | Constraints & Notes |
| :--- | :--- | :--- |
| `id` | `bigserial` | **Primary Key** |
| `user_id` | `uuid` | **Not Null**, Foreign Key to `users.id`, `ON DELETE CASCADE` |
| `front` | `varchar(200)` | **Not Null** |
| `back` | `varchar(500)` | **Not Null** |
| `source` | `varchar` | **Not Null**, `CHECK (source IN ('ai-full', 'ai-edited', 'manual'))` |
| `generation_id` | `bigint` | Foreign Key to `generations.id`, `ON DELETE SET NULL` |
| `created_at` | `timestamptz` | **Not Null**, `DEFAULT now()` |
| `updated_at` | `timestamptz` | **Not Null**, `DEFAULT now()` |

### `generations`

Logs analytics data for each AI flashcard generation event.

| Column | Data Type | Constraints & Notes |
| :--- | :--- | :--- |
| `id` | `bigserial` | **Primary Key** |
| `user_id` | `uuid` | **Not Null**, Foreign Key to `users.id`, `ON DELETE CASCADE` |
| `model` | `varchar` | **Not Null** |
| `generated_count` | `integer` | **Not Null** |
| `accepted_unedited_count` | `integer` | **Nullable** |
| `accepted_edited_count` | `integer` | **Nullable** |
| `source_text_hash` | `varchar` | **Not Null** |
| `source_text_length` | `integer` | **Not Null**, `CHECK (source_text_length >= 1000 AND source_text_length <= 10000)` |
| `generation_duration` | `integer` | **Not Null** |
| `created_at` | `timestamptz` | **Not Null**, `DEFAULT now()` |
| `updated_at` | `timestamptz` | **Not Null**, `DEFAULT now()` |

### `generation_error_logs`

Logs errors that occur during the AI generation process.

| Column | Data Type | Constraints & Notes |
| :--- | :--- | :--- |
| `id` | `bigserial` | **Primary Key** |
| `user_id` | `uuid` | **Not Null**, Foreign Key to `users.id`, `ON DELETE CASCADE` |
| `model` | `varchar` | **Not Null** |
| `source_text_hash` | `varchar` | **Not Null** |
| `source_text_length` | `integer` | **Not Null**, `CHECK (source_text_length >= 1000 AND source_text_length <= 10000)` |
| `error_code` | `varchar(100)` | **Not Null** |
| `error_message` | `text` | **Not Null** |
| `created_at` | `timestamptz` | **Not Null**, `DEFAULT now()` |

As mentioned, users table is managed by Supabase. These are its columns:
- id: UUID PRIMARY KEY
- email: VARCHAR(255) NOT NULL UNIQUE
- encrypted_password: VARCHAR NOT NULL
- created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- confirmed_at: TIMESTAMPTZ 

## 2. Relationships

- **`users` to `flashcards`**: One-to-Many. A user can have many flashcards. The `user_id` in `flashcards` links to `users.id`.
- **`users` to `generations`**: One-to-Many. A user can initiate many generation events. The `user_id` in `generations` links to `users.id`.
- **`users` to `generation_error_logs`**: One-to-Many. A user can have multiple generation errors. The `user_id` in `generation_error_logs` links to `users.id`.
- **`generations` to `flashcards`**: One-to-Many. A single generation event can produce multiple flashcards. Each flashcard is linked to at most one generation event (or none if created manually). The `generation_id` in `flashcards` links to `generations.id`.

## 3. Indexes

- `CREATE INDEX ON public.flashcards (user_id);`
- `CREATE INDEX ON public.flashcards (generation_id);`
- `CREATE INDEX ON public.generations (user_id);`
- `CREATE INDEX ON public.generation_error_logs (user_id);`

## 4. PostgreSQL Policies (Row-Level Security)

RLS will be enabled on all tables to ensure users can only access their own data: so where `<table>.user_id` equals to `users.id`

### `flashcards` Table Policy

- **Policy Name**: `Allow full access to own flashcards`
- **Applies To**: `ALL`
- **USING**: `users.id = user_id`
- **WITH CHECK**: `users.id = user_id`

### `generations` Table Policy

- **Policy Name**: `Allow insert and select for own generation logs`
- **Applies To**: `SELECT, INSERT`
- **USING**: `users.id = user_id`
- **WITH CHECK**: `users.id = user_id`

### `generation_error_logs` Table Policy

- **Policy Name**: `Allow insert and select for own error logs`
- **Applies To**: `SELECT, INSERT`
- **USING**: `users.id = user_id`
- **WITH CHECK**: `users.id = user_id`

## 5. Functions and Triggers

### `handle_updated_at` Function

A trigger function to automatically update the `updated_at` column to the current timestamp whenever a row is modified.

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### `flashcards_updated_at` Trigger

A trigger on the `flashcards` table that fires the `handle_updated_at` function before any update operation.

```sql
CREATE TRIGGER on_flashcard_update
  BEFORE UPDATE ON flashcards
  FOR EACH ROW
  EXECUTE PROCEDURE handle_updated_at();
```

### `generations_updated_at` Trigger

A trigger on the `generations` table that fires the `handle_updated_at` function before any update operation.

```sql
CREATE TRIGGER on_generation_update
  BEFORE UPDATE ON public.generations
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
```
