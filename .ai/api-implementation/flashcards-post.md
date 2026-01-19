# API Endpoint Implementation Plan: POST /flashcards

## 1. Endpoint Overview

Create one or more flashcards for the authenticated user. Supports manual entry and acceptance of AI-generated cards. Updates generation analytics counters when applicable.

## 2. Request Details

- **HTTP Method**: POST
- **URL**: `/flashcards`
- **Body (`CreateFlashcardsCommand`)**:
  ```jsonc
  {
    "flashcards": [
      {
        "front": "string ≤200 chars",
        "back": "string ≤500 chars",
        "source": "ai-full | ai-edited | manual",
        "generation_id": 123, // null when source = "manual"
      },
    ],
  }
  ```
- **Validation rules**
  - `flashcards`: array `min 1`
  - `front` string length ≤200; non-empty trimmed.
  - `back` string length ≤500; non-empty trimmed.
  - `source` enum "ai-full | ai-edited | manual".
  - `generation_id`:
    - **Required & not null** when `source` is `ai-full` or `ai-edited`.
    - **Must be null** when `manual`.
    - Must reference an existing `generations.id` owned by current user.

## 3. Used Types

- **Request**: `CreateFlashcardsCommand` – envelope object representing the full POST body; `CreateFlashcardCommandItem` – schema for each element inside the `flashcards` array (all in `src/types.ts`).
- **Response**: `CreateFlashcardsResponseDto` – wrapper returned on success; `FlashcardDto` – DTO for every created flashcard inside the `flashcards` array (both in `src/types.ts`).
- **Internal helper (service-layer)**: `GenerationCounterDelta` – tracks how many _unedited_ vs _edited_ AI cards were accepted per `generation_id`, used to build incremental updates.
  ```ts
  interface GenerationCounterDelta {
    generationId: number;
    full: number;
    edited: number;
  }
  ```

## 4. Response Details

| Status                    | Description                     | Example Body                                                                 |
| ------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| **201 Created**           | Flashcards created successfully | `{ "flashcards": [ /* FlashcardDto */ ] }`                                   |
| 400 Bad Request           | Validation failure              | `{ "error": "invalid_request", "message": "front must be ≤200 characters" }` |
| 401 Unauthorized          | Authentication required         | `{ "error": "unauthorized", "message": "Authentication required" }`          |
| 500 Internal Server Error | Unexpected server error         | `{ "error": "internal_error", "message": "Unexpected server error" }`        |

## 5. Data Flow

1. **Route file** `src/pages/api/flashcards.ts` (Astro server endpoint) receives `POST` request. In astro route use supabase from context.locals.
2. If user from `Astro.locals` is missing or invalid, immediately return `401`.
3. Parse & validate body with Zod → `CreateFlashcardsCommand`. On validation failure immediately return `400`.
4. Invoke `flashcardsService.createFlashcards(userId, flashcards)`.
5. Service logic (single DB transaction):
   - Verify all referenced `generation_id` rows belong to user. If not return `400`.
   - Compute per-generation deltas: `{ full, edited }`.
   - `insert` all flashcards (`flashcards` table) with supplied fields + `user_id`.
   - For each affected generation row, `update` counters using Supabase RPC or `update({ accepted_unedited_count: ..., accepted_edited_count: ... })` with increments.
6. Return inserted rows mapped to `FlashcardDto`; status 201.

## 6. Security Considerations

- **Authentication**: require valid Supabase session; otherwise 401.
- **Authorization**:
  - Do **not** accept/inspect `user_id` from client.
  - Ensure `generation_id` belongs to the authenticated user.
- **Validation**: strict Zod schema + cross-field refinement blocks malformed data.
- **Dependency safety**: use Supabase query builder (prepared statements).

## 7. Error Handling

- **Validation Errors (400)**
  - Detected by Zod schema and additional guards.
  - Always try to validate as early as possible. As soon as validation fails, return the response and don't proceed with subsequent processing steps.

- **Authentication Errors (401)**
  - If Supabase user is absent, return `401`.

- **Internal Server Errors (500)**
  - Other errors, e.g. DB insert failures or unexpected exceptions.
  - Return generic `internal_error` envelope to client.

## 8. Performance Considerations

- Use **bulk insert** with array to Supabase; avoids N round-trips.
- Wrap inserts + updates in **single transaction** for atomicity.
- Indexes already exist on PK; ensure `generations.id` is PK (bigserial) so updates are quick.

## 9. Implementation Steps

1. **Service**: create `src/lib/services/flashcards.service.ts` with `createFlashcards(userId, flashcards)` method; add helper for per-generation counter aggregation.
2. **Route file** `src/pages/api/flashcards.ts`:
   1. Create Zod schema for `CreateFlashcardsCommand`.
   2. `export const prerender = false;`
   3. Auth guard (`locals.session`).
   4. Parse JSON → validate.
   5. Call service; catch & map errors as described above.
   6. Return `CreateFlashcardsResponseDto`, status 201.
3. **Unit tests** (Vitest) for validation schema and service counter aggregation.
4. **Docs**: add TSDoc documenting the API endpoint.
