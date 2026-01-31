# API Endpoint Implementation Plan: PATCH /flashcards/:id

## 1. Endpoint Overview

Update the `front` and/or `back` text of a single existing flashcard that belongs to the authenticated user.

The endpoint:

- Accepts a numeric path parameter `id`.
- Accepts a JSON body with optional `front` and/or `back` fields.
- Requires at least one of `front` or `back` to be provided.
- Enforces maximum content lengths and basic text validation.
- If the flashcard `source` was `"ai-full"` and the content is edited, updates `source` to `"ai-edited"`.
  - When the flashcard is linked to a generation (`generation_id` is not null) and its `source` transitions from `"ai-full"` to `"ai-edited"`, it also attempts to keep the `generations` analytics counters in sync by decrementing `accepted_unedited_count` and incrementing `accepted_edited_count` for the corresponding `generations` row.
- Relies on the `on_flashcard_update` trigger to keep `updated_at` correct.
- Returns the full updated flashcard.

## 2. Request Details

- **HTTP Method**: `PATCH`
- **URL**: `/flashcards/:id`

### 2.1 Path Parameters

- `id: number` (required)
  - Comes from the Astro dynamic route segment.
  - Must be a positive integer (aligned with `bigserial` primary key).

Validation rules:

- Reject non-numeric values (e.g., `"abc"`, `"1.5"`, `NaN`).
- Reject `id <= 0`.
- On invalid `id`: respond with `400 Bad Request`.

### 2.2 Request Body

Body JSON is optional per-field but at least one of `front` or `back` must be present.

Shape (logical, after validation):

```ts
// Command model in src/types.ts
UpdateFlashcardCommand = Pick<FlashcardUpdateRow, "front" | "back">;
```

- `front?: string`
  - Optional key in the request body.
  - When present:
    - Interpreted as a string.
    - `trim()` applied.
    - Must be non-empty after trimming.
    - Maximum length: **200** characters.
- `back?: string`
  - Optional key in the request body.
  - When present:
    - Interpreted as a string.
    - `trim()` applied.
    - Must be non-empty after trimming.
    - Maximum length: **500** characters.

Additional rule:

- At least one of `front` or `back` must be present and valid after trimming.
  - If both are missing or both fail validation → `400 Bad Request`.

### 2.3 Validation Summary

- **Path param**
  - `id` must be a valid positive integer.
- **Body**
  - Must be valid JSON.
  - `front` / `back` must be strings when present.
  - Length constraints:
    - `front`: `1..200` (after trimming).
    - `back`: `1..500` (after trimming).
  - At least one of `front` / `back` must be provided.

## 3. Used Types

### 3.1 Command Models

- **`UpdateFlashcardCommand`**
  - Defined in `src/types.ts` as:
    - `type UpdateFlashcardCommand = Pick<FlashcardUpdateRow, "front" | "back">;`
  - Represents the normalized, validated subset of fields allowed to be updated.
  - Both `front` and `back` are optional; at least one is enforced by the Zod schema at the route level.

### 3.2 DTOs (Responses)

- **`FlashcardDetailResponseDto`**
  - Defined in `src/types.ts` as alias to `FlashcardDto`.
  - Structure (conceptual):
    ```ts
    type FlashcardDetailResponseDto = {
      id: number;
      front: string;
      back: string;
      source: "ai-full" | "ai-edited" | "manual";
      generation_id: number | null;
      created_at: string; // ISO timestamp
      updated_at: string; // ISO timestamp
    };
    ```

### 3.3 Error Types

- **`ApiErrorResponse<FlashcardsApiErrorCode>`** (from `src/types.ts`)
- **`FlashcardsApiErrorCode`**
  - Current union: `"invalid_request" | "unauthorized" | "internal_error"` - needs to be extended with `"not_found"`
  - For this endpoint:
    - `400` → `"invalid_request"`.
    - `401` → `"unauthorized"`.
    - `404` → Return `404` with an `ApiErrorResponse<"not_found">` and message like `"Flashcard not found"`.
    - `500` → `"internal_error"`.

## 4. Response Details

### 4.1 Success (200 OK)

- Status: **200 OK**
- Body: `FlashcardDetailResponseDto` (single updated flashcard).

Example:

```jsonc
{
  "id": 123,
  "front": "Updated question?",
  "back": "Updated answer.",
  "source": "ai-edited",
  "generation_id": 42,
  "created_at": "2025-01-01T10:00:00.000Z",
  "updated_at": "2025-01-02T11:30:00.000Z",
}
```

### 4.2 Error Responses

| Status                        | When                                                                 | Body shape                            |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| **400 Bad Request**           | Invalid `id` param, invalid JSON, invalid body fields, or empty body | `ApiErrorResponse<"invalid_request">` |
| **401 Unauthorized**          | Missing or invalid authenticated user                                | `ApiErrorResponse<"unauthorized">`    |
| **404 Not Found**             | No flashcard for given `id` owned by the authenticated user          | `ApiErrorResponse<"not_found">`       |
| **500 Internal Server Error** | Supabase client missing, DB error, or unexpected server exception    | `ApiErrorResponse<"internal_error">`  |

## 5. Data Flow

### 5.1 Route Entry (Astro API Route)

- New file: `src/pages/api/flashcards/[id].ts` (dynamic segment for `id`).
- Exported handler for `PATCH` only:
  - `export const PATCH: APIRoute = async ({ request, params, locals }) => { ... }`.
- Use `locals` for Supabase and user (per backend rules):
  - `const { supabase, user } = locals;`

### 5.2 Authentication & Supabase Guard

1. **Supabase availability**
   - If `!supabase`:
     - Return `500` with `ApiErrorResponse<"internal_error">` and message `"Supabase client not available"`.

2. **User authentication**
   - Read `const userId = user?.id;`.
   - If `!userId`:
     - Return `401` with `ApiErrorResponse<"unauthorized">` and message `"Authentication required"`.
   - Do **not** accept any `user_id` from path, query, or body.

### 5.3 Path Parameter Parsing & Validation (id)

- Extract raw param: `const rawId = params.id;`.
- Validate using Zod in the route (simple schema):
  - Preprocess string to `number`.
  - Enforce integer and `>= 1`.
- On parse/validation failure:
  - Return `400` with `ApiErrorResponse<"invalid_request">` and e.g. `"Invalid flashcard id"`.

### 5.4 Request Body Parsing & Validation

1. **Parse JSON body**
   - Attempt `await request.json()`.
   - On failure (invalid JSON):
     - Return `400` with `ApiErrorResponse<"invalid_request">` and message `"Invalid JSON body"`.

2. **Apply body validation schema**
   - `const parseResult = updateFlashcardCommandSchema.safeParse(json);`
   - If `!parseResult.success`:
     - Extract first error message and return `400` with `"invalid_request"`.
   - Else:
     - `const command = parseResult.data as UpdateFlashcardCommand;`

### 5.5 Service Call: Update Flashcard

- Instantiate service:
  - `const flashcardsService = new FlashcardsService(supabase);`

- Service exposes method (conceptual):
  - `updateFlashcard(userId: string, id: number, command: UpdateFlashcardCommand): Promise<FlashcardDetailResponseDto | null>`.

- Route calls:
  - `const result = await flashcardsService.updateFlashcard(userId, id, command);`

### 5.6 Flow in `FlashcardsService.updateFlashcard`:

1. **Fetch current flashcard details**
   - Issue a `select` to get current `source`, `front`, `back`, and `generation_id` .
   - If no row matched `(id, user_id)`:
     - Return `null` to the route.

2. **Prepare update payload**
   - `const { front, back } = command;`
   - **`source` transition logic**
     - Goal: If the existing `source` is `"ai-full"` and the flashcard is edited, set `source` to `"ai-edited"`.
     - Practical approach:
       - If `source` is `"ai-full"`:
         - Determine if `front` or `back` value is changing.
         - If so, include `source: "ai-edited"` in the update payload.
       - If `source` is `"ai-edited"` or `"manual"`, do not modify `source`.
   - Do not set `updated_at` in the update payload - `on_flashcard_update` trigger will update `updated_at` automatically.
   - Construct a partial update object containing only `front`, `back` and `source` if it should change.

3. **Update and select data for response in a single call**
   - Use Supabase `update` with filters:
     - `.from("flashcards")`
     - `.update({ front?, back?, source? })`
     - `.eq("id", id)`
     - `.eq("user_id", userId)`
     - `.select("id, front, back, source, generation_id, created_at, updated_at")`
     - `.maybeSingle()`

4. **Handle Supabase response**
   - If `error` is present:
     - Log server-side (no PII or sensitive data).
     - Throw an error for the route to translate into `500`.
   - If `data` is `null` (no row matched `(id, user_id)`):
     - Return `null` to the route.
   - Else:
     - Cast/return as `FlashcardDetailResponseDto`.

5. **Synchronize generation analytics counters**
   - Using the pre-update state (from the initial `select`) and the post-update state (from the `update ... select`):
     - If there is no `generation_id` (manual flashcard) or the `source` classification did not change between `"ai-full"` and `"ai-edited"`, do **not** touch the `generations` table.
     - If the flashcard belongs to a generation (`generation_id` is not null) and its `source` moved from `"ai-full"` (before update) to `"ai-edited"` (after update):
       - Update the corresponding `generations` row so that:
         - `accepted_unedited_count` is decremented by 1.
         - `accepted_edited_count` is incremented by 1.
   - If updating the `generations` counters fails, log the error (including `generation_id`, `flashcard_id`, and old/new `source`) and do **not** fail the PATCH request solely because of this; the flashcard update is the primary outcome and analytics consistency can be repaired later if needed.

### 5.7 Handling service result in the route:

- If `result === null`:
  - Return `404` with `ApiErrorResponse<"not_found">` and `"Flashcard not found"`.
- Else:
  - Return `200` with `result` serialized as JSON.
- If service threw error:
  - Return `500` with `ApiErrorResponse<"internal_error">` and a message like `"Internal server error"`.

### 5.8 Route Response Mapping summary:

- **Success**:
  - `200` with `FlashcardDetailResponseDto`.
- **Validation/auth errors**:
  - `400` / `401` as described above, with `ApiErrorResponse` shape.
- **Not found**:
  - `404` with `ApiErrorResponse<"not_found">`.
- **Server error**:
  - `500` with generic `internal_error` payload.

## 6. Security Considerations

- **Authentication**
  - Require authenticated user via `locals.user`.
  - If missing, return `401` and `ApiErrorResponse<"unauthorized">`.

- **Authorization / Multi-tenancy**
  - Never accept `user_id` from client.
  - Always filter DB operations by both `id` and `user_id`.
  - Returning `404` when no row matches prevents leaking whether an `id` exists for another user.

- **Input Validation & Sanitization**
  - Use Zod for:
    - `id` param parsing.
    - Body structure and length constraints.
  - Trim strings to avoid leading/trailing whitespace abuse.
  - Prevent optional fields from being sent as invalid types.

- **Database Safety**
  - Use Supabase query builder (no raw SQL string concatenation).
  - Limit update to a single row via `.eq("id", id)` and `.eq("user_id", userId)`.

- **Business Rule Integrity**
  - Do not expose `source` or `generation_id` in the request body.
  - Enforce source transition logic server-side only.

- **Information Disclosure**
  - Do not leak internal DB errors or stack traces.
  - Use generic messages for `500` and more specific but harmless messages for `400`/`404`.
  - **Do not** put any sensitive data into logs!

## 7. Error Handling

### 7.1 400 Bad Request

Possible causes:

- Invalid `id` path parameter (non-integer, <= 0).
- Malformed JSON body.
- Body missing both `front` and `back`.
- `front` or `back` exceeding max length or empty after trimming.

Response pattern:

```jsonc
{
  "error": {
    "code": "invalid_request",
    "message": "<human-readable explanation>",
  },
}
```

### 7.2 401 Unauthorized

- Triggered when `locals.user` is missing or `user.id` is falsy.
- Response:

```jsonc
{
  "error": {
    "code": "unauthorized",
    "message": "Authentication required",
  },
}
```

### 7.3 404 Not Found

- Triggered when `FlashcardsService.updateFlashcard` returns `null`.
- Indicates that the flashcard does not exist for the current user.
- Response:

```jsonc
{
  "error": {
    "code": "not_found",
    "message": "Flashcard not found",
  },
}
```

### 7.4 500 Internal Server Error

- Triggered when:
  - `supabase` is missing from `locals`.
  - Supabase returns an `error` during update.
  - Any unexpected exception occurs in route or service.

Response pattern:

```jsonc
{
  "error": {
    "code": "internal_error",
    "message": "Internal server error",
  },
}
```

Logging guidelines:

- Always log errors when they occur - use `createErrorLogger()` from src/lib/utils.ts to create a logger for a service or api route.
- Log enough context to debug (user id, flashcard id, high-level error information).
- Never log sensitive data - this rule has priority over any other one in case of conflicts.
- Do not write to `generation_error_logs` here; that table is reserved for generation-related failures.

## 8. Performance Considerations

- **Single-row update**
  - Operation affects exactly one row (if any) and is cheap.

- **Indexes**
  - Rely on primary key index on `id` and any existing indexes on `user_id`.
  - If necessary (future), consider a composite index on `(user_id, id)` for faster multi-tenant lookups, but this is out of scope for this implementation.

- **Network round-trips**
  - Use an update together with `returning` (`select`) to fetch the updated row, minimizing round-trips.

- **Payload size**
  - Request/response bodies are small (two short strings and a small object), so no special optimization required.

## 9. Implementation Steps

1. **Confirm and reuse shared types**
   - Ensure `UpdateFlashcardCommand` and `FlashcardDetailResponseDto` in `src/types.ts` match the needs of this endpoint (they already do).
   - No new public DTOs are required.

2. **Extend validation utilities (`src/lib/flashcardsUtils.ts`)**
   - Add `updateFlashcardCommandSchema`, shape::
     - `front?: string` → `z.string().trim().min(1).max(200).optional()`.
     - `back?: string` → `z.string().trim().min(1).max(500).optional()`.
     - Refinement to enforce at least one field:
       - `.refine(data => data.front !== undefined || data.back !== undefined, { message: "At least one of front or back must be provided" })`.
   - Export the schema for use by the route.

3. **Add dynamic route file for PATCH**
   - Create `src/pages/api/flashcards/[id].ts` with:
     - `export const prerender = false;`.
     - `PATCH` handler that:
       - Reads `supabase` and `user` from `locals` and applies auth guard.
       - Parses and validates `params.id` (Zod or a small helper schema inline).
       - Parses `request.json()` and validates with `updateFlashcardCommandSchema`.
       - Instantiates `FlashcardsService` and calls `updateFlashcard(userId, id, command)`.
       - Maps outcomes to status codes: `200`, `400`, `401`, `404`, `500`.
       - Uses the existing `jsonResponse` helper and consistent `ApiErrorResponse` shapes.

4. **Extend `FlashcardsService` (`src/lib/services/flashcards.service.ts`)**
   - Add method `updateFlashcard(userId: string, id: number, command: UpdateFlashcardCommand)`.
   - Implement logic as described in details in Data Flow, so summarising:
     - Determine whether `source` needs to change from `"ai-full"` to `"ai-edited"` when any content is updated.
     - Use Supabase `update` with proper filters and `select` to return the updated row.
     - Return `null` when no row was updated (for 404).
     - Throw on Supabase errors for the route to map to `500`.

5. **Wire error handling consistently**
   - Reuse `errorResponse` helper pattern from `src/pages/api/flashcards.ts` for generating `ApiErrorResponse<FlashcardsApiErrorCode>`.
   - Ensure all early returns (invalid `id`, invalid body, unauthorized, missing supabase) use this helper.
   - Remember to also log errors as described in Logging guidelines.

6. **Add tests (future work)**
   - **Unit tests** (Vitest):
     - Validation schema (`updateFlashcardCommandSchema`) for combinations of valid and invalid bodies.
     - `FlashcardsService.updateFlashcard` behavior:
       - Successful update with `front`, `back`, or both.
       - Source transition from `"ai-full"` to `"ai-edited"`.
       - No row update (returns `null`).
       - Supabase error handling.
   - **Integration tests** (Playwright or API-level tests):
     - Hitting `PATCH /flashcards/:id` with various payloads and verifying status codes and responses.

7. **Documentation (future)**
   - Add TSdoc comments to `updateFlashcard` service method and route handler summarizing behavior, including:
     - Validation rules.
     - Source transition semantics.
     - Error mappings and status codes.
