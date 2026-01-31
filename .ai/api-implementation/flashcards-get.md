# API Endpoint Implementation Plan: GET /flashcards

## 1. Endpoint Overview

Return a paginated list of the authenticated user’s flashcards. Supports basic pagination, optional sorting, and filtering by flashcard `source`. For now, the endpoint **does not perform text search** on `front` / `back` and ignores the semantic effect of `q` beyond validation.

## 2. Request Details

- **HTTP Method**: GET
- **URL**: `/flashcards`
- **Query Parameters (`FlashcardsListQueryCommand`)**:
  - **Pagination**
    - `page?: number`
      - Optional; defaults to `1` when omitted.
      - Must be an integer.
      - Minimum value: `1`.
    - `limit?: number`
      - Optional; defaults to `10` when omitted.
      - Must be an integer.
      - Range: `1`–`100`.
  - **Search** (temporarily unused)
    - `q?: string`
      - Optional; will be validated as a string when present.
      - For this iteration, the backend **does not apply any DB filtering based on `q`** (in the future it will be searched in `front` and `back`).
  - **Sorting**
    - `sort?: FlashcardsSortField`
      - Optional; allowed values: `"created_at" | "updated_at"`.
      - Default: `"created_at"`.
    - `order?: SortOrder`
      - Optional; allowed values: `"asc" | "desc"`.
      - Default: `"desc"`.
  - **Filters**
    - `source?: FlashcardSource`
      - Optional; allowed values: `"ai-full" | "ai-edited" | "manual"`.
      - For this iteration, the backend **does not apply any DB filtering based on `source`**. In the future it will limit results to flashcards with the given `source`.

- **Validation rules (summary)**
  - Reject non-numeric / NaN `page` or `limit` (400).
  - Enforce `page >= 1`; `1 <= limit <= 100`.
  - Restrict `sort` to the `FlashcardsSortField` union.
  - Restrict `order` to `SortOrder` union.
  - Restrict `source` to `FlashcardSource` union.
  - `q` must be a string if present; it won't be used for now, so we won't specify more detailed validation rules yet.

## 3. Used Types

- **Command models**
  - `FlashcardsListQueryCommand`
    - Represents normalized, validated query parameters after parsing.

- **DTOs**
  - `FlashcardDto`
    - Base DTO for exposed flashcard properties.
  - `FlashcardListItemDto = FlashcardDto`
    - Alias used in list responses for clarity.
  - `PaginationMetaDto`
    - `{ page: number; limit: number; total_items: number; total_pages: number }`.
  - `FlashcardsListResponseDto`
    - `{ items: FlashcardListItemDto[]; pagination: PaginationMetaDto }`.

- **Error envelope types**
  - `ApiErrorResponse<FlashcardsApiErrorCode>`
    - `FlashcardsApiErrorCode = "invalid_request" | "unauthorized" | "internal_error"`.

## 4. Response Details

- **Success (200 OK)**
  - Body: `FlashcardsListResponseDto`
  - Example:
    ```jsonc
    {
      "items": [
        {
          "id": 123,
          "front": "Question?",
          "back": "Answer.",
          "source": "ai-full",
          "generation_id": 42,
          "created_at": "2025-01-01T10:00:00.000Z",
          "updated_at": "2025-01-01T10:00:00.000Z",
        },
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total_items": 1,
        "total_pages": 1,
      },
    }
    ```

- **Error Responses**

  | Status                        | When                                                    | Body shape                            |
  | ----------------------------- | ------------------------------------------------------- | ------------------------------------- |
  | **400 Bad Request**           | Invalid query params (types, bounds, unsupported enums) | `ApiErrorResponse<"invalid_request">` |
  | **401 Unauthorized**          | User not authenticated                                  | `ApiErrorResponse<"unauthorized">`    |
  | **500 Internal Server Error** | Unexpected DB or server error                           | `ApiErrorResponse<"internal_error">`  |

  Note: **404 Not Found** is not used for listing; empty lists still return 200

- **Empty results**
  - When there are no flashcards for the user or given filters, return `200 OK` with:
    - `items: []`
    - `pagination.total_items = 0`, `total_pages = 0`, `page` and `limit` reflecting the requested (or default) values.

## 5. Data Flow

1. **Route entry (Astro)**
   - File: `src/pages/api/flashcards.ts`.
   - Detect HTTP method:
     - If `GET`, proceed with its handler.
     - (Existing `POST` handler remains unchanged.)
   - Use `locals` for Supabase client and authenticated user:
     - `const supabase = locals.supabase;`
     - `const user = locals.user;`

2. **Authentication check**
   - If `locals.user` is missing/invalid:
     - Return `401` with `ApiErrorResponse<"unauthorized">`.
   - Do **not** accept any `user_id` from the query string or headers.
   - Use the authenticated user’s `id` as the only `user_id` in DB queries.

3. **Query parsing & validation (Zod)**
   - Read `new URL(request.url).searchParams`.
   - Convert raw values to a plain object and run them through a Zod schema that maps to `FlashcardsListQueryCommand`:
     - Cast numeric strings to numbers (if numeric) or fail validation.
     - Apply default values (`page=1`, `limit=10`, `sort="created_at"`, `order="desc"`).
     - Enforce allowed enum values for `sort`, `order`, and `source`.
   - On validation error:
     - Return `400` with `ApiErrorResponse<"invalid_request">` including a human-readable summary of the first validation error.

4. **Service call**
   - Extend `src/lib/services/flashcards.service.ts` service:
     - `async function listFlashcards(supabase: SupabaseClient, userId: string, query: FlashcardsListQueryCommand): Promise<FlashcardsListResponseDto>`.
   - From the route handler, call:
     - `const result = await flashcardsService.listFlashcards(supabase, userId, validatedQuery);`

5. **Service implementation: listFlashcards**
   1. **Compute pagination offsets**
      - `const page = query.page ?? 1;`
      - `const limit = query.limit ?? 10;`
      - `const offset = (page - 1) * limit;`

   2. **Base query**
      - Start with `supabase.from("flashcards")`.
      - `select` only the columns needed to build `FlashcardListItemDto`:
        - `id`, `front`, `back`, `source`, `generation_id`, `created_at`, `updated_at`.
      - Add `eq("user_id", userId)` to scope to the current user.

   3. **Apply filters** - Future feature!
      - If `query.source` is present:
        - Add `eq("source", query.source)`.
      - **Do not** apply any filter based on `query.q` for this iteration. You can put a comment that it will done in the future.

   4. **Apply sorting**
      - Determine `sortField` from `query.sort ?? "created_at"`.
      - Determine `sortOrder` from `query.order ?? "desc"`.
      - Use Supabase `.order(sortField, { ascending: sortOrder === "asc" })`.

   5. **Apply pagination**
      - Use `.range(offset, offset + limit - 1)` to fetch a single page.
      - Request an exact total count to build pagination metadata:
        - `.select("id, front, back, source, generation_id, created_at, updated_at", { count: "exact", head: false })`.

   6. **Execute query & handle Supabase result**
      - Await the query and inspect `{ data, error, count }`.
      - On `error`:
        - Log the error on the server (e.g., `console.error` or a logging helper).
        - Return/throw a structured internal error that the route maps to `500`.
        - **Do not** write to `generation_error_logs` here; that table is reserved for AI generation errors.
      - On success:
        - Map `data` rows to `FlashcardListItemDto` directly (fields already aligned).
        - Compute pagination metadata:
          - `total_items = count ?? 0`.
          - `total_pages = total_items === 0 ? 0 : Math.ceil(total_items / limit)`.
        - Return `FlashcardsListResponseDto`.

6. **Route response mapping**
   - On success from service:
     - Return `200` with `FlashcardsListResponseDto` serialized as JSON.
   - On known validation/auth/service errors:
     - Map to appropriate `ApiErrorResponse` and status codes (`400`, `401`, `500`).
   - Ensure consistent JSON shape with other `/flashcards` endpoints.

## 6. Security Considerations

- **Authentication**
  - Require an authenticated user via `locals.user`.
  - Unauthenticated callers receive `401` and `ApiErrorResponse<"unauthorized">`.

- **Authorization / Multi-tenancy isolation**
  - Never accept `user_id` from the client.
  - All queries must include `eq("user_id", userIdFromSession)`.
  - This prevents a user from listing another user’s flashcards by guessing IDs or query parameters.

- **Input validation**
  - Use Zod to validate and normalize query parameters into `FlashcardsListQueryCommand`.
  - Prevent type confusion and injection via unvalidated `sort` or `order` values.
  - Clamp pagination inputs to reasonable bounds.

- **Database query safety**
  - Use Supabase query builder (parameterized SQL under the hood) instead of manual string interpolation.
  - Restrict `sort` to a fixed enum mapped to known column names to avoid dynamic column injection.

- **Information disclosure**
  - Do not leak internal error details (SQL, stack traces) in responses.
  - For `500`, return a generic `internal_error` message.
  - **Do not** put any sensitive data into logs!

- **Rate limiting / abuse (future)**
  - Consider adding rate-limiting at the API gateway or middleware level if the endpoint becomes a hotspot for scraping, but this is outside the scope of this plan.

## 7. Error Handling

- **Validation Errors (400)**
  - Triggered when query parameters violate constraints:
    - Non-integer or out-of-range `page`/`limit`.
    - Unsupported `sort`, `order`, or `source` values.
  - Response:
    ```jsonc
    {
      "error": {
        "code": "invalid_request",
        "message": "page must be a positive integer",
      },
    }
    ```

- **Authentication Errors (401)**
  - Triggered when `locals.user` is missing.
  - Response:
    ```jsonc
    {
      "error": {
        "code": "unauthorized",
        "message": "Authentication required",
      },
    }
    ```

- **Internal Server Errors (500)**
  - Triggered on unhandled exceptions or Supabase errors (connection, timeout, unexpected failures).
  - Response:
    ```jsonc
    {
      "error": {
        "code": "internal_error",
        "message": "Unexpected server error",
      },
    }
    ```
  - Logging:
    - Log errors server-side with sufficient context: user ID, query parameters (sanitized), and error message.
    - **Do not** log to `generation_error_logs`; this table is reserved for AI generation errors, not generic listing failures.

Note: **Not Found (404)** is not applicable for this list endpoint (when no flashcards exist for the user or filters, return `200` with `items: []`.)

## 8. Performance Considerations

- **Pagination and count**
  - Use `limit` (max 100) and `page` to avoid returning excessively large result sets.
  - Use Supabase’s `count: "exact"` with care; if this becomes a bottleneck, consider switching to `"planned"` or estimating total pages.

- **Indexes**
  - Consider adding follwing DB indexes (**out of scope** to change here, but recommended):
    - `flashcards(user_id, created_at DESC)`
    - `flashcards(user_id, updated_at DESC)`

- **Round-trips**
  - Use a single Supabase query that returns data and count in one round-trip.

- **Future search support**
  - When enabling text search on `q`, add indexes on `front` / `back` or use PostgreSQL full-text search, but this is explicitly out of scope for this iteration.

## 9. Implementation Steps

1. **Extend / confirm shared types** (already present)
   - Verify `FlashcardsListQueryCommand`, `FlashcardsListResponseDto`, `FlashcardListItemDto`, and `FlashcardsApiErrorCode` in `src/types.ts` match this plan.
   - Adjust only if necessary to keep them aligned with the DB schema and this endpoint’s needs.

2. **Add validation schema**
   - Create `src/lib/flashcardsUtils.ts` and define there a Zod schema for query parameters:
     - Schema mirrors `FlashcardsListQueryCommand` and enforces bounds and enums.
     - Contains defaults for `page`, `limit`, `sort`, `order`.
   - Additionally please move there also schemas for existing POST request body (validating `CreateFlashcardsCommand`)

3. **Update `src/pages/api/flashcards.ts` route**
   - Ensure `export const prerender = false;` is present.
   - Structure the handler to branch on HTTP method:
     - `POST` → existing creation logic.
     - `GET` → new logic.
   - In `GET` handler:
     - Read Supabase client and user from `locals`.
     - Perform auth guard and return `401` on missing user.
     - Parse and validate query params into `FlashcardsListQueryCommand` using a Zod schema. Return `400` on validation error.
     - Call `flashcardsService.listFlashcards(supabase, userId, command)`.
     - Map service results to `FlashcardsListResponseDto` with status `200`.
     - Map known errors to `ApiErrorResponse<FlashcardsApiErrorCode>` with appropriate status codes.

4. **Extend `flashcardsService`**
   - In `src/lib/services/flashcards.service.ts`:
     - Add `listFlashcards` method as described in the Data Flow section.
     - If available: reuse any existing helpers (e.g., for mapping DB rows to DTOs) created for POST.
     - Implement robust handling of Supabase errors and return a consistent error shape for the route to translate.

5. **Testing** (For the future)
   - Unit tests (Vitest) for:
     - Query validation logic (various combinations of valid/invalid params).
     - `listFlashcards` service behavior (pagination math, filtering, sorting), using a mocked Supabase client.
   - Integration tests (optional but recommended):
     - Hitting `GET /flashcards` with different query strings and checking responses and status codes.

6. **Documentation**
   - Use TSdoc to describe `GET /flashcards` parameters, behavior on empty results, and examples of usage.
