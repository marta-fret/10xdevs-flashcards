## REST API Plan

### 1. Resources

- **User / Auth**  
  Backed by Supabase `auth.users` and Supabase Auth APIs.

- **Flashcard**  
  DB table: `flashcards`  
  Fields: `id`, `user_id`, `front`, `back`, `source`, `generation_id`, `created_at`, `updated_at`.

- **Generation** (stores metadata and results of AI generation)  
  DB table: `generations`  
  Fields: `id`, `user_id`, `model`, `generated_count`, `accepted_unedited_count`, `accepted_edited_count`, `source_text_hash`, `source_text_length`, `generation_duration`, `created_at`, `updated_at`.

- **Generation Error Logs** (stores errors that occur during AI generation)  
  DB table: `generation_error_logs`  
  Fields: `id`, `user_id`, `model`, `source_text_hash`, `source_text_length`, `error_code`, `error_message`, `created_at`.

All data access is scoped to the authenticated user via Supabase Auth and PostgreSQL RLS (`user_id = users.id`).

---

### 2. Endpoints

#### 2.1 Flashcards

##### 2.1.1 GET `/flashcards`

- **Description**: Paginated list of the user’s flashcards with optional text search and sorting.
- **Query parameters**:
  - `page`: integer, optional, default `1`, min `1`.
  - `limit`: integer, optional, default `10`, max `100`.
  - `q`: string, optional – search term matched against `front` and `back` (`ILIKE '%q%'`).
  - `sort`: string, optional, e.g. `created_at` (default).
  - `order`: string, optional, `asc` or `desc` (default: `desc`).
  - optional filters (e.g. `source=ai-full`)
- **Response JSON (200)**:
  - `items`: array of
    - `{ id: number; front: string; back: string; source: 'ai-full' | 'ai-edited' | 'manual'; generation_id: number | null; created_at: string; updated_at: string; }`
  - `pagination`:
    - `{ page: number; limit: number; total_items: number; total_pages: number; }`
- **Success**:
  - `200 OK` – list returned (possibly empty).
- **Errors**:
  - `400 Bad Request` – invalid query parameters.
  - `401 Unauthorized` – not logged in.
  - `500 Internal Server Error` – DB error.

##### 2.1.2 POST `/flashcards`

- **Description**: Create one or more flashcards (manual or AI-generated) for the current user.
- **Request JSON**:
  - An object:
    - `flashcards`: array of flashcard objects, each:
      - `front`: string, required, max 200 characters.
      - `back`: string, required, max 500 characters.
      - `source`: string, required, one of `'ai-full'`, `'ai-edited'`, `'manual'`.
      - `generation_id`: integer or null, required if source is `ai-full` or `ai-edited`, must be null for `manual` source; when set, must reference an existing `generations.id` for this user.
- **Server behavior**:
  - Iterates over the array and validates each flashcard.
  - Uses the authenticated user as `user_id` for all inserted rows; `user_id` is never taken from the request body.
  - Inserts one row into `flashcards` for each element.
  - Updates `generations.accepted_unedited_count` and `generations.accepted_edited_count` based on the flashcards created.
- **Response JSON (201)**:
  - `flashcards`: array of newly created flashcards, each:
    - `{ id: number; front: string; back: string; source: 'ai-full' | 'ai-edited' | 'manual'; generation_id: number | null; created_at: string; updated_at: string; }`
- **Success**:
  - `201 Created` – one or more flashcards created.
- **Errors**:
  - `400 Bad Request` – validation error (e.g. missing/too-long fields, invalid `source`).
  - `401 Unauthorized` – not logged in.
  - `500 Internal Server Error` – DB error.

##### 2.1.3 GET `/flashcards/:id`

- **Description**: Get a single flashcard by ID.
- **Path parameters**:
  - `id`: integer, required.
- **Response JSON (200)**:
  - `{ id: number; front: string; back: string; source: 'ai-full' | 'ai-edited' | 'manual'; generation_id: number | null; created_at: string; updated_at: string; }`
- **Success**:
  - `200 OK` – flashcard returned.
- **Errors**:
  - `400 Bad Request` – invalid ID format.
  - `401 Unauthorized` – not logged in.
  - `404 Not Found` – flashcard does not exist or does not belong to the user (RLS hides others).
  - `500 Internal Server Error` – DB error.

##### 2.1.4 PATCH `/flashcards/:id`

- **Description**: Update the `front` and/or `back` of an existing flashcard.
- **Path parameters**:
  - `id`: integer, required.
- **Request JSON** (at least one field required):
  - `front`: string, optional, max 200 characters.
  - `back`: string, optional, max 500 characters.
- **Server behavior**:
  - Validates new content lengths.
  - If source was `ai-full` it should be changed to `ai-edited`.
  - When the flashcard is linked to a generation (`generation_id` is not null) and its source transitions from `ai-full` to `ai-edited`, update `generations.accepted_unedited_count` and `generations.accepted_edited_count` for the corresponding generation row so analytics stay consistent.
  - Uses trigger `on_flashcard_update` to update `updated_at` automatically.
- **Response JSON (200)**:
  - Updated flashcard object (same shape as GET).
- **Success**:
  - `200 OK` – updated.
- **Errors**:
  - `400 Bad Request` – no updatable fields or invalid lengths.
  - `401 Unauthorized` – not logged in.
  - `404 Not Found` – flashcard not found or not owned by user.
  - `500 Internal Server Error` – DB error.

##### 2.1.5 DELETE `/flashcards/:id`

- **Description**: Delete a flashcard permanently.
- **Path parameters**:
  - `id`: integer, required.
- **Request JSON**: none.
- **Response JSON (200)**:
  - `message`: string, e.g. `"flashcard_deleted"`.
- **Success**:
  - `200 OK` – deleted.
- **Errors**:
  - `400 Bad Request` – invalid ID format.
  - `401 Unauthorized` – not logged in.
  - `404 Not Found` – flashcard not found or not owned by user.
  - `500 Internal Server Error` – DB error.

#### 2.2 AI-Powered Flashcard Generation

##### 2.2.1 POST `/generations`

- **Description**: Generate flashcards proposals using AI, based on user-provided text: call OpenRouter LLM to generate flashcard proposals, and (on success/failure) log analytics/error data.
- **Request JSON**:
  - `source_text`: string, required, length 1000–10000 characters.
- **Server behavior**:
  - Validates `source_text` length and returns `400` if outside `[1000, 10000]`.
  - Computes `source_text_hash` (e.g. SHA-256) and `source_text_length`.
  - Calls OpenRouter API with prompt to generate flashcards proposals.
  - On success:
    - Parses proposals into list of `{ front, back }`.
    - Inserts a row into `generations` with:
      - `user_id` = current user.
      - `model` = model.
      - `generated_count` = number of proposals.
      - `accepted_unedited_count` = `NULL` initially.
      - `accepted_edited_count` = `NULL` initially.
      - `source_text_hash`, `source_text_length`.
      - `generation_duration` = measured time in ms.
    - Returns `flashcards_proposals`, `generated_count` and `generation_id` to the client.
  - On LLM error / timeout:
    - Inserts a row into `generation_error_logs` with `user_id`, `model`, `source_text_hash`, `source_text_length`, `error_code`, `error_message`.
    - Returns an error response to the client.
- **Response JSON (200)** on success:
  - `generation_id`: number.
  - `flashcards_proposals`: array of
    - `{ temp_id: string; front: string; back: string; source: "ai-full" }`
  - `generated_count`: number.
- **Success**:
  - `200 OK` – proposals returned.
- **Errors**:
  - `400 Bad Request` – invalid or out-of-range `source_text`.
  - `401 Unauthorized` – not logged in.
  - `429 Too Many Requests` – per-user/per-IP rate limit exceeded for AI generation.
  - `502 Bad Gateway` – upstream LLM error (also logged to `generation_error_logs`).
  - `500 Internal Server Error` – internal failure.

##### 2.2.2 GET `/generations`

- **Description**: Paginated list of AI generation events for the authenticated user.
- **Query parameters**:
  - `page`: integer, optional, default `1`, min `1`.
  - `limit`: integer, optional, default `10`, max `100`.
  - `sort`: string, optional, e.g. `created_at` (default).
  - `order`: string, optional, `asc` or `desc` (default: `desc`).
- **Response JSON (200)**:
  - `items`: array of generation objects, each:
    - `{ id: number; model: string; generated_count: number; accepted_unedited_count: number | null; accepted_edited_count: number | null; source_text_length: number; generation_duration: number; created_at: string; updated_at: string; }`
  - `pagination`:
    - `{ page: number; limit: number; total_items: number; total_pages: number; }`
- **Success**:
  - `200 OK` – list returned (possibly empty).
- **Errors**:
  - `400 Bad Request` – invalid query parameters.
  - `401 Unauthorized` – not logged in.
  - `500 Internal Server Error` – DB error.

##### 2.2.3 GET `/generations/:id`

- **Description**: Retrieve detailed information about a specific generation, including associated flashcards.
- **Path parameters**:
  - `id`: integer, required – generation ID.
- **Response JSON (200)**:
  - `generation`:
    - `{ id: number; model: string; generated_count: number; accepted_unedited_count: number | null; accepted_edited_count: number | null; source_text_length: number; generation_duration: number; created_at: string; updated_at: string;}`
  - `flashcards`: array of flashcards created from this generation, each:
    - `{ id: number; front: string; back: string; source: 'ai-full' | 'ai-edited'; generation_id: number; created_at: string; updated_at: string; }`
- **Success**:
  - `200 OK` – generation and its flashcards returned.
- **Errors**:
  - `400 Bad Request` – invalid ID format.
  - `401 Unauthorized` – not logged in.
  - `404 Not Found` – generation not found or not owned by user.
  - `500 Internal Server Error` – DB error.

##### 2.2.4 GET `/generation-error-logs`

Typically used internally or by admin users

- **Description**: Retrieve error logs for AI flashcard generation for the authenticated user or admin.
- **Response JSON**: List of error log objects.
- **Errors**:
  - `401 Unauthorized` – not logged in.
  - `403 Forbidden` – if access is restricted to admin users.
  - `500 Internal Server Error` – DB error.

### 3. Authentication and Authorization

- **Authentication mechanism**:
  - Supabase Auth (email/password) with JWT-based sessions (user authenticates via `/auth/login` or `/auth/register`, receiving a bearer token).
    - Clients authenticate via Authorization header (`Bearer <access_token>`).
  - Astro API routes use `Astro.locals.supabase` (Supabase client bound to the request) to identify the current user and interact with the DB and Auth APIs.

- **Authorization model**:
  - PostgreSQL Row-Level Security (RLS) is enabled on `flashcards`, `generations`, and `generation_error_logs` with policies `users.id = user_id`.
  - All application queries use the authenticated Supabase client, ensuring RLS is enforced automatically.
  - Flashcard, generation, and error-log endpoints do **not** accept `user_id` in the payload; the backend derives it from the authenticated session.
  - Protected endpoints require the token in the `Authorization` header.
  - Admin analytics endpoints additionally require an `admin` role/claim (e.g. via Supabase custom claims or a separate `is_admin` mapping), validated in the API route.

- **Rate limiting & abuse protection**:
  - AI generation endpoint is protected by per-user and per-IP rate limits (e.g. using middleware / edge functions):
    - Example: max 30 generation requests per user per hour; max 5 per minute per IP.
  - General API rate limiting at a coarser level (e.g. 100 requests per 15 minutes per IP) can be applied at the reverse proxy or middleware layer.
  - 429 responses include a `Retry-After` header where appropriate.

- **Security measures**:
  - All endpoints served over HTTPS only.
  - OpenRouter API keys stored securely in server-side environment variables (`import.meta.env`) and never exposed to the client.
  - Inputs validated and sanitized to prevent SQL injection (Supabase client + parameterized queries) and prompt injection issues are mitigated by controlled system prompts.
  - Error responses avoid leaking internal details (e.g. full stack traces or raw upstream errors) while logging sufficient data internally (`generation_error_logs`).

---

### 4. Validation and Business Logic

#### 4.1 Validation Conditions per Resource

**Flashcards** (`flashcards` table)

- `front`: required, non-empty, max 200 characters.
- `back`: required, non-empty, max 500 characters.
- `source`: required, must be one of `('ai-full', 'ai-edited', 'manual')`.
- `generation_id`: integer or null, required if source is `ai-full` or `ai-edited`, must be null for `manual` source; when set, must reference an existing `generations.id` for this user.
- `user_id`: never taken from client; always populated from authenticated user.

**Generations** (`generations` table)

- `user_id`: required, from authentication.
- `model`: required, non-empty string.
- `generated_count`: required, integer ≥ 0.
- `accepted_unedited_count`: nullable, when set must be integer ≥ 0 and ≤ `generated_count`.
- `accepted_edited_count`: nullable, when set must be integer ≥ 0 and `accepted_unedited_count + accepted_edited_count ≤ generated_count`.
- `source_text_hash`: required, non-empty string.
- `source_text_length`: required, integer with DB check: `1000 ≤ source_text_length ≤ 10000`.
- `generation_duration`: required, integer ≥ 0 (milliseconds or similar unit, defined consistently in backend).

**GenerationErrorLogs** (`generation_error_logs` table)

- `user_id`: required, from authentication.
- `model`: required, non-empty string.
- `source_text_hash`: required, non-empty string.
- `source_text_length`: required, integer with DB check: `1000 ≤ source_text_length ≤ 10000`.
- `error_code`: required, string up to 100 characters.
- `error_message`: required, non-empty text.

#### 4.2 Business Logic Mapping

- **AI Flashcard Generation (F-02, US-006, US-007)**:
  - `POST /generations` accepts the user’s study text, calls the LLM via OpenRouter to generate flashcards proposals, and logs each generation event in the `generations` table. On failures it logs errors into `generation_error_logs`.
  - `POST /flashcards` allows saving accepted unchanged or edited flashcards proposals from a given `generation_id`.
  - `GET /generations` and `GET /generations/:id` expose generation history and details (including which flashcards came from which generation) to support internal analytics and debugging.
  - `GET /generation-error-logs` provides access to recorded generation failures for debugging and basic error analytics.

- **Manual Flashcard Creation (F-03, US-008)**:
  - `POST /flashcards` allows saving manually created flashcards.

- **Flashcard Management (F-04, US-009–US-012)**:
  - `GET /flashcards` provides a paginated, searchable list of the user’s flashcards.
  - `GET /flashcards/:id` returns full details of a single flashcard for viewing.
  - `PATCH /flashcards/:id` supports editing `front` and/or `back`.
  - `DELETE /flashcards/:id` removes a flashcard from the user’s collection.

- **Internal Analytics (F-06, SM-01, SM-02)**:
  - The `generations` table, combined with `flashcards.source`, is the source of truth for computing:
    - AI-generated flashcard acceptance rate (from `generated_count`, `accepted_unedited_count`, `accepted_edited_count`).
    - AI adoption rate (share of flashcards where `source` is `ai-full` or `ai-edited` vs. `manual`).
  - These metrics can be computed in reporting queries or dashboards without dedicated public API endpoints in the current scope.

---

This REST API plan aligns with the current PostgreSQL schema, PRD requirements, and the Astro + Supabase + OpenRouter tech stack, providing a clear mapping from product features to concrete, validated, and secure endpoints.
