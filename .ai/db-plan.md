# PostgreSQL Database Schema for AI Flashcards

This document outlines the database schema for the AI Flashcards application, designed for PostgreSQL and managed via Supabase. The schema is based on the project's PRD and decisions from the database planning session.

## 1. Tables

The schema consists of three custom tables: `flashcards`, `generations`, and `generation_error_logs`. The `users` table is provided by Supabase Authentication.

### `flashcards`

Stores the flashcards created by users.

| Column | Data Type | Constraints & Notes |
| :--- | :--- | :--- |
| `id` | `bigserial` | **Primary Key** |
| `user_id` | `uuid` | **Not Null**, Foreign Key to `auth.users.id`, `ON DELETE CASCADE` |
| `front` | `text` | **Not Null**, `CHECK (length(front) <= 200)` |
| `back` | `text` | **Not Null**, `CHECK (length(back) <= 500)` |
| `source` | `text` | **Not Null**, `CHECK (source IN ('ai-full', 'ai-edited', 'manual'))` |
| `generation_id` | `bigint` | Foreign Key to `generations.id`, `ON DELETE SET NULL` |
| `created_at` | `timestamp` | **Not Null**, `DEFAULT now()` |
| `updated_at` | `timestamp` | **Not Null**, `DEFAULT now()` |

### `generations`

Logs analytics data for each AI flashcard generation event.

| Column | Data Type | Constraints & Notes |
| :--- | :--- | :--- |
| `id` | `bigserial` | **Primary Key** |
| `user_id` | `uuid` | **Not Null**, Foreign Key to `auth.users.id`, `ON DELETE CASCADE` |
| `model` | `text` | **Not Null** |
| `generated_count` | `integer` | **Not Null**, `CHECK (generated_count >= 0)` |
| `accepted_unedited_count` | `integer` | **Not Null**, `CHECK (accepted_unedited_count >= 0)` |
| `accepted_edited_count` | `integer` | **Not Null**, `CHECK (accepted_edited_count >= 0)` |
| `source_text_hash` | `text` | **Not Null** |
| `source_text_length` | `integer` | **Not Null**, `CHECK (source_text_length >= 1000 AND source_text_length <= 10000)` |
| `generation_time` | `interval` | **Not Null** |
| `created_at` | `timestamp` | **Not Null**, `DEFAULT now()` |

### `generation_error_logs`

Logs errors that occur during the AI generation process.

| Column | Data Type | Constraints & Notes |
| :--- | :--- | :--- |
| `id` | `bigserial` | **Primary Key** |
| `user_id` | `uuid` | **Not Null**, Foreign Key to `auth.users.id`, `ON DELETE CASCADE` |
| `model` | `text` | **Not Null** |
| `source_text_hash` | `text` | **Not Null** |
| `source_text_length` | `integer` | **Not Null**, `CHECK (source_text_length >= 1000 AND source_text_length <= 10000)` |
| `error_code` | `text` | |
| `error_message` | `text` | |
| `created_at` | `timestamp` | **Not Null**, `DEFAULT now()` |

## 2. Relationships

- **`users` to `flashcards`**: One-to-Many. A user can have many flashcards. The `user_id` in `flashcards` links to `auth.users.id`.
- **`users` to `generations`**: One-to-Many. A user can initiate many generation events. The `user_id` in `generations` links to `auth.users.id`.
- **`users` to `generation_error_logs`**: One-to-Many. A user can have multiple generation errors. The `user_id` in `generation_error_logs` links to `auth.users.id`.
- **`generations` to `flashcards`**: One-to-Many (optional). A single generation event can produce multiple flashcards. The `generation_id` in `flashcards` links to `generations.id`.

## 3. Indexes

To optimize queries that filter by user, B-tree indexes will be created on all `user_id` foreign key columns.

- `CREATE INDEX ON public.flashcards (user_id);`
- `CREATE INDEX ON public.generations (user_id);`
- `CREATE INDEX ON public.generation_error_logs (user_id);`

## 4. PostgreSQL Policies (Row-Level Security)

RLS will be enabled on all tables to ensure users can only access their own data.

### `flashcards` Table Policy

- **Policy Name**: `Allow full access to own flashcards`
- **Applies To**: `ALL`
- **USING**: `auth.uid() = user_id`
- **WITH CHECK**: `auth.uid() = user_id`

### `generations` Table Policy

- **Policy Name**: `Allow insert and select for own generation logs`
- **Applies To**: `SELECT, INSERT`
- **USING**: `auth.uid() = user_id`
- **WITH CHECK**: `auth.uid() = user_id`

### `generation_error_logs` Table Policy

- **Policy Name**: `Allow insert and select for own error logs`
- **Applies To**: `SELECT, INSERT`
- **USING**: `auth.uid() = user_id`
- **WITH CHECK**: `auth.uid() = user_id`

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
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
```
