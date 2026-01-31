# API Endpoint Implementation Plan: DELETE /flashcards/:id

## 1. Endpoint Overview

Permanently delete a single flashcard that belongs to the authenticated user.

The endpoint:

- Accepts a numeric path parameter `id`.
- Requires an authenticated user.
- Deletes the flashcard row from the `flashcards` table **only if** it is owned by the current user.
- Does **not** modify any fields in the `generations` table (analytics counters **must not** be updated for DELETE).
- Returns a simple confirmation message on success.

## 2. Request Details

- **HTTP Method**: `DELETE`
- **URL**: `/flashcards/:id`

### 2.1 Path Parameters

- `id: number` (required)
  - Comes from the Astro dynamic route segment.
  - Must be a positive integer, aligned with `bigserial` primary key in `flashcards.id`.

Validation rules:

- Reject non-numeric values (e.g., `"abc"`, `"1.5"`, `NaN`).
- Reject `id <= 0`.
- On invalid `id`: respond with `400 Bad Request`.

### 2.2 Request Body

- No JSON body is required or used for this endpoint.
- The handler should **not** attempt to parse `request.json()`.
  - This avoids unnecessary `400` errors from malformed JSON for a body that is not needed.
- Any body content sent by the client is ignored.

### 2.3 Validation Summary

- **Path param**
  - `id` must be a valid positive integer.
- **Body**
  - Not used; no validation is required.

## 3. Used Types

### 3.1 DTOs (Responses)

- **`DeleteFlashcardResponseDto`** (already defined in `src/types.ts`):

  ```ts
  export interface DeleteFlashcardResponseDto {
    message: string;
  }
  ```

  - For this endpoint, the `message` value should be set to a fixed string such as `"flashcard_deleted"` on success.

### 3.2 Error Codes

- Introduce a new alias in `src/types.ts`:

  ```ts
  export type FlashcardsApiDeleteErrorCode = FlashcardsApiErrorCode | "not_found";
  ```

- Mapping for this endpoint:
  - `400` → `"invalid_request"`.
  - `401` → `"unauthorized"`.
  - `404` → `"not_found"`.
  - `500` → `"internal_error"`.

## 4. Response Details

### 4.1 Success (200 OK)

- Status: **200 OK**
- Body: `DeleteFlashcardResponseDto`.

Example:

```jsonc
{
  "message": "flashcard_deleted",
}
```

### 4.2 Error Responses

| Status                        | When                                                              | Body shape                            |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| **400 Bad Request**           | Invalid `id` param (non-numeric, non-integer, `<= 0`)             | `ApiErrorResponse<"invalid_request">` |
| **401 Unauthorized**          | Missing or invalid authenticated user                             | `ApiErrorResponse<"unauthorized">`    |
| **404 Not Found**             | No flashcard for given `id` owned by the authenticated user       | `ApiErrorResponse<"not_found">`       |
| **500 Internal Server Error** | Supabase client missing, DB error, or unexpected server exception | `ApiErrorResponse<"internal_error">`  |

## 5. Data Flow

### 5.1 Route Entry (Astro API Route)

- Route file (shared with PATCH) will be: `src/pages/api/flashcards/[id].ts`.
- Add a DELETE handler:
  - `export const DELETE: APIRoute = async ({ params, locals }) => { ... }`.
- Use `locals` to access Supabase and authenticated user (per backend rules):
  - `const { supabase, user } = locals;`

### 5.2 Supabase and Authentication Guards

1. **Supabase availability**
   - If `!supabase`:
     - Return `500` with `ApiErrorResponse<"internal_error">` and message e.g. `"Supabase client not available"`.

2. **User authentication**
   - Read `const userId = user?.id;`.
   - If `!userId`:
     - Return `401` with `ApiErrorResponse<"unauthorized">` and message `"Authentication required"`.
   - Never accept `user_id` from path, query, or body.

### 5.3 Path Parameter Parsing & Validation (id)

- Extract raw param: `const rawId = params.id;`.
- Validate using a small Zod schema defined in the route:
  - Preprocess string to number.
  - Enforce integer and `>= 1`.
    NOTE: such schema slready exists for PATCH - please reuse.
- On parse/validation failure:
  - Return `400` with `ApiErrorResponse<"invalid_request">` and message like `"Invalid flashcard id"`.

### 5.4 Service Call: Delete Flashcard

- Instantiate flashcards service:
  - `const flashcardsService = new FlashcardsService(supabase);`

- Service exposes method (conceptual):

  ```ts
  deleteFlashcard(userId: string, id: number): Promise<boolean>;
  ```

  - Returns `true` if a row was deleted.
  - Returns `false` if no row matched `(id, user_id)`.
  - Throws on Supabase errors.

- Route calls:

  ```ts
  const deleted = await flashcardsService.deleteFlashcard(userId, id);
  ```

### 5.5 Flow in `FlashcardsService.deleteFlashcard`

1. **Perform delete with ownership constraint**
   - Use Supabase query builder:
     - `.from("flashcards")`
     - `.delete()`
     - `.eq("id", id)`
     - `.eq("user_id", userId)`
     - `.select("id").maybeSingle()` (or equivalent) to distinguish between "no row" and success.

2. **Handle Supabase response**
   - If `error` is present:
     - Log the error using a service-level logger.
     - Throw an error to be translated into `500` by the route.
   - If `data` is `null` (no row matched `(id, user_id)`):
     - Return `false` (for 404 mapping).
   - Else (row deleted successfully):
     - Return `true`.

3. **Generations analytics**
   - Do **not** read or update the `generations` table.
   - The specification explicitly states that for DELETE we **must not** modify `accepted_unedited_count` or `accepted_edited_count`.

### 5.6 Handling Service Result in the Route

- If `deleted === false`:
  - Return `404` with `ApiErrorResponse<"not_found">` and message like `"Flashcard not found"`.
- Else (`deleted === true`):
  - Return `200` with body:

    ```jsonc
    {
      "message": "flashcard_deleted",
    }
    ```

- If the service throws an error:
  - Return `500` with `ApiErrorResponse<"internal_error">` and a generic message like `"Internal server error"`.

### 5.7 Route Response Mapping Summary

- **Success**:
  - `200` with `DeleteFlashcardResponseDto`.
- **Validation/auth errors**:
  - `400` / `401` with `ApiErrorResponse<FlashcardsApiDeleteErrorCode>`.
- **Not found**:
  - `404` with `ApiErrorResponse<"not_found">`.
- **Server error**:
  - `500` with `ApiErrorResponse<"internal_error">`.

## 6. Security Considerations

- **Authentication**
  - Require authenticated user via `locals.user`.
  - If missing, return `401` and `ApiErrorResponse<"unauthorized">`.

- **Authorization / Multi-tenancy**
  - Never accept `user_id` from the client.
  - Always filter DB operations by both `id` and `user_id`.
  - Returning `404` when no row matches `(id, user_id)` prevents leaking whether a given `id` exists for another user.

- **Input Validation & Sanitization**
  - Use Zod for `id` param parsing and validation.
  - Treat any invalid `id` as `400 Bad Request`.

- **Database Safety**
  - Use Supabase query builder (no raw SQL string concatenation).
  - Limit delete to a single row via filters on `id` and `user_id`.

- **Business Rule Integrity**
  - Do not touch `generations` analytics counters; DELETE must reflect only user intent to remove a flashcard, not a rejection of AI output.

- **Information Disclosure**
  - Do not leak internal DB errors or stack traces to clients.
  - Use generic messages for `500` and specific but non-sensitive messages for `400`/`404`.
  - Do **not** log sensitive data (e.g., user content)!

## 7. Error Handling

### 7.1 400 Bad Request

Possible causes:

- Invalid `id` path parameter (non-integer, `<= 0`, missing).

Response pattern:

```jsonc
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid flashcard id",
  },
}
```

### 7.2 401 Unauthorized

- Triggered when `locals.user` is missing or `user.id` is falsy.

Response:

```jsonc
{
  "error": {
    "code": "unauthorized",
    "message": "Authentication required",
  },
}
```

### 7.3 404 Not Found

- Triggered when `FlashcardsService.deleteFlashcard` returns `false`.
- Indicates that the flashcard does not exist for the current user (or is owned by another user).

Response:

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
  - Supabase returns an `error` during delete.
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

### 7.5 Logging Guidelines

- Always log server-side errors when they are thrown, using the existing logging utilities (e.g. `createErrorLogger()` from `src/lib/utils.ts`).
- Log enough context to debug (user id, flashcard id, high-level error information).
- Never log sensitive content - this rule has priority over any other one in case of conflicts.
- Do **not** write to `generation_error_logs` for this endpoint; that table is reserved for AI generation failures.

## 8. Performance Considerations

- **Single-row delete**
  - Operation affects at most one row and is cheap.

- **Indexes**
  - Rely on primary key index on `flashcards.id` and any existing indexes on `user_id`.
  - In the future, a composite index on `(user_id, id)` could further optimize multi-tenant lookups, but this is out of scope here.

- **Network round-trips**
  - Use a single `delete ... select` call to both perform the deletion and confirm whether a row was deleted.

- **Payload size**
  - The request has no body, and the response is a tiny JSON object; no special optimization is required.

## 9. Implementation Steps

1. **Confirm and reuse shared types**
   - Ensure `DeleteFlashcardResponseDto` in `src/types.ts` is used as the success response DTO for this endpoint.
   - Add `FlashcardsApiDeleteErrorCode` type:

     ```ts
     export type FlashcardsApiDeleteErrorCode = FlashcardsApiErrorCode | "not_found";
     ```

2. **Extend `FlashcardsService` (`src/lib/services/flashcards.service.ts`)**
   - Add method `deleteFlashcard(userId: string, id: number): Promise<boolean>`.
   - Implement logic as described in the Data Flow section:
     - Use Supabase `delete` with `.eq("id", id)` and `.eq("user_id", userId)`.
     - Use `.select("id").maybeSingle()` to determine if a row was deleted.
     - Return `true` when a row is deleted, `false` when not found.
     - Throw on Supabase errors.
     - Do **not** modify `generations` analytics counters.

3. **Add DELETE handler to dynamic route file**
   - In `src/pages/api/flashcards/[id].ts` (shared with PATCH):
     - Export `prerender = false;` if not already present.
     - Add `DELETE` handler that:
       - Reads `supabase` and `user` from `locals` and applies guards.
       - Parses and validates `params.id` using a small Zod schema (reuse - already created for PATCH).
       - Instantiates `FlashcardsService` and calls `deleteFlashcard(userId, id)`.
       - Maps outcomes to status codes: `200`, `400`, `401`, `404`, `500`.
       - Uses the existing `jsonResponse` helper and consistent `ApiErrorResponse` shapes.

4. **Wire error handling consistently**
   - Reuse the same error response pattern as other `/flashcards` endpoints (`ApiErrorResponse<...>`).
   - Ensure all early returns (invalid `id`, unauthorized, missing Supabase) use the same helper and error codes.
   - Log errors via `createErrorLogger()`.

5. **Add tests (future work)**
   - **Unit tests** (Vitest):
     - For the `id` validation schema in the route (valid IDs vs invalid ones).
     - For `FlashcardsService.deleteFlashcard` behavior:
       - Successful deletion when `(id, user_id)` matches.
       - Returning `false` when no matching row exists.
       - Proper propagation of Supabase errors.
   - **Integration / E2E tests** (Playwright or API-level):
     - Calling `DELETE /flashcards/:id` for:
       - Existing flashcard owned by the user → `200` + `"flashcard_deleted"`.
       - Non-existent `id` → `404`.
       - Flashcard belonging to another user → `404`.
       - Unauthenticated user → `401`.

6. **Documentation (future)**
   - Add brief TSdoc comments to `deleteFlashcard` service method and `DELETE` route handler summarizing:
     - Validation rules for `id`.
     - Ownership requirement.
     - Error mappings and status codes.
     - Explicit note that `generations` analytics are not updated on delete.
