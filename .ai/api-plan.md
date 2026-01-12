## REST API Plan

### 1. Resources

- **User / Auth**  
  Backed by Supabase `auth.users` and Supabase Auth APIs.

- **Flashcard**  
  DB table: `flashcards`  
  Fields: `id`, `user_id`, `front`, `back`, `source`, `generation_id`, `created_at`, `updated_at`.

- **Generation** (AI generation event)  
  DB table: `generations`  
  Fields: `id`, `user_id`, `model`, `generated_count`, `accepted_unedited_count`, `accepted_edited_count`, `source_text_hash`, `source_text_length`, `generation_duration`, `created_at`, `updated_at`.

- **GenerationErrorLog** (AI generation error log)  
  DB table: `generation_error_logs`  
  Fields: `id`, `user_id`, `model`, `source_text_hash`, `source_text_length`, `error_code`, `error_message`, `created_at`.

- **Learning Session (ephemeral)**  
  In-memory / client-managed session over a user’s `flashcards`. No dedicated table in the current schema. The API only orchestrates which card to show next and records per-session feedback in memory for the duration of the session.

All data access is scoped to the authenticated user via Supabase Auth and PostgreSQL RLS (`user_id = users.id`).

---

### 2. Endpoints

#### 2.1 Auth / Account Management (Supabase-backed)

Auth endpoints are thin wrappers over Supabase Auth to keep the frontend simple and consistent. All operate on the current authenticated user.

##### 2.1.1 POST `/api/auth/signup`

- **Description**: Create a new user account via Supabase Email+Password. Returns a session and user profile.
- **Request JSON**:
  - `email`: string, required, valid email.
  - `password`: string, required, must meet password policy (e.g. min length 8).
- **Response JSON (201)**:
  - `user`: `{ id: string; email: string; created_at: string; }`
  - `session`: `{ access_token: string; refresh_token: string; expires_in: number; }`
- **Success**:
  - `201 Created` – account created, user logged in.
- **Errors**:
  - `400 Bad Request` – invalid email/password format.
  - `409 Conflict` – email already registered.
  - `500 Internal Server Error` – unexpected Supabase/Auth issue.

##### 2.1.2 POST `/api/auth/login`

- **Description**: Log in with email and password, returning Supabase session tokens.
- **Request JSON**:
  - `email`: string, required.
  - `password`: string, required.
- **Response JSON (200)**:
  - `user`: `{ id: string; email: string; created_at: string; }`
  - `session`: `{ access_token: string; refresh_token: string; expires_in: number; }`
- **Success**:
  - `200 OK` – login successful.
- **Errors**:
  - `400 Bad Request` – malformed payload.
  - `401 Unauthorized` – invalid credentials.
  - `500 Internal Server Error` – Supabase/Auth error.

##### 2.1.3 POST `/api/auth/logout`

- **Description**: Invalidate current session (server-side logout) and clear auth cookies if used.
- **Request JSON**: none.
- **Response JSON (200)**:
  - `message`: string, e.g. `"logged_out"`.
- **Success**:
  - `200 OK` – session ended.
- **Errors**:
  - `401 Unauthorized` – no active session.
  - `500 Internal Server Error` – Supabase/Auth error.

##### 2.1.4 POST `/api/auth/change-password`

- **Description**: Change password for the currently authenticated user.
- **Request JSON**:
  - `current_password`: string, required.
  - `new_password`: string, required, must meet password policy.
- **Response JSON (200)**:
  - `message`: string, e.g. `"password_changed"`.
- **Success**:
  - `200 OK` – password updated.
- **Errors**:
  - `400 Bad Request` – malformed payload or weak new password.
  - `401 Unauthorized` – user not authenticated.
  - `403 Forbidden` – current password invalid.
  - `500 Internal Server Error` – Supabase/Auth error.

##### 2.1.5 DELETE `/api/auth/account`

- **Description**: Permanently delete the current user account and all personal data (GDPR-compliant). Backend calls Supabase to remove the user; cascading deletes remove related rows (`ON DELETE CASCADE`).
- **Request JSON**:
  - `confirm`: string, required, must equal `"DELETE"` to prevent accidental deletion.
- **Response JSON (200)**:
  - `message`: string, e.g. `"account_deleted"`.
- **Success**:
  - `200 OK` – account and related data deleted.
- **Errors**:
  - `400 Bad Request` – confirmation string invalid.
  - `401 Unauthorized` – user not authenticated.
  - `500 Internal Server Error` – deletion failed.

---

#### 2.2 Flashcards

All flashcard endpoints require authentication and are scoped to the current user via Supabase RLS on `flashcards.user_id`.

##### 2.2.1 GET `/api/flashcards`

- **Description**: Paginated list of the user’s flashcards with optional text search and sorting.
- **Query parameters**:
  - `page`: integer, optional, default `1`, min `1`.
  - `page_size`: integer, optional, default `20`, max `100`.
  - `q`: string, optional – search term matched against `front` and `back` (`ILIKE '%q%'`).
  - `sort_by`: string, optional, one of `created_at` (default), `updated_at`.
  - `sort_dir`: string, optional, `asc` or `desc` (default: `desc`).
- **Response JSON (200)**:
  - `items`: array of
    - `{ id: number; front: string; back: string; source: 'ai-full' | 'ai-edited' | 'manual'; generation_id: number | null; created_at: string; updated_at: string; }`
  - `pagination`:
    - `{ page: number; page_size: number; total_items: number; total_pages: number; }`
- **Success**:
  - `200 OK` – list returned (possibly empty).
- **Errors**:
  - `400 Bad Request` – invalid pagination or sort parameters.
  - `401 Unauthorized` – not logged in.
  - `500 Internal Server Error` – DB error.

##### 2.2.2 POST `/api/flashcards`

- **Description**: Create a new _manual_ flashcard for the current user.
- **Request JSON**:
  - `front`: string, required, max 200 characters.
  - `back`: string, required, max 500 characters.
- **Server behavior**:
  - Sets `source = 'manual'`.
  - `user_id` is taken from authenticated user, not from the request.
- **Response JSON (201)**:
  - Newly created flashcard object:
    - `{ id: number; front: string; back: string; source: 'manual'; generation_id: number | null; created_at: string; updated_at: string; }`
- **Success**:
  - `201 Created` – flashcard created.
- **Errors**:
  - `400 Bad Request` – validation error (e.g. `front` or `back` missing/too long).
  - `401 Unauthorized` – not logged in.
  - `422 Unprocessable Entity` – request structurally correct but violates DB constraints.
  - `500 Internal Server Error` – DB error.

##### 2.2.3 GET `/api/flashcards/:id`

- **Description**: Get a single flashcard by ID belonging to the current user.
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

##### 2.2.4 PATCH `/api/flashcards/:id`

- **Description**: Update the `front` and/or `back` of an existing flashcard.
- **Path parameters**:
  - `id`: integer, required.
- **Request JSON** (at least one field required):
  - `front`: string, optional, max 200 characters.
  - `back`: string, optional, max 500 characters.
- **Server behavior**:
  - Validates new content lengths.
  - Uses trigger `on_flashcard_update` to update `updated_at` automatically.
- **Response JSON (200)**:
  - Updated flashcard object (same shape as GET).
- **Success**:
  - `200 OK` – updated.
- **Errors**:
  - `400 Bad Request` – no updatable fields or invalid lengths.
  - `401 Unauthorized` – not logged in.
  - `404 Not Found` – flashcard not found or not owned by user.
  - `422 Unprocessable Entity` – DB constraint violation.
  - `500 Internal Server Error` – DB error.

##### 2.2.5 DELETE `/api/flashcards/:id`

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

---

#### 2.3 AI-Powered Flashcard Generation

These endpoints implement PRD features F-02, F-03, F-06 and log data into `generations` and `generation_error_logs`.

##### 2.3.1 POST `/api/flashcards/ai/generate`

- **Description**: Accept user study notes, call OpenRouter LLM to generate flashcard proposals, and (on success/failure) log analytics/error data.
- **Request JSON**:
  - `source_text`: string, required, length 1,000–10,000 characters.
  - `model`: string, optional, default model ID configured in env (e.g. `"openrouter/your-default-model"`).
- **Server behavior**:
  - Validates `source_text` length and returns `400` if outside `[1000, 10000]`.
  - Computes `source_text_hash` (e.g. SHA-256) and `source_text_length`.
  - Calls OpenRouter API with prompt to generate Q/A pairs.
  - On success:
    - Parses proposals into list of `{ front, back }`.
    - Inserts a row into `generations` with:
      - `user_id` = current user.
      - `model` = chosen model.
      - `generated_count` = number of proposals.
      - `accepted_unedited_count` = `NULL` initially.
      - `accepted_edited_count` = `NULL` initially.
      - `source_text_hash`, `source_text_length`.
      - `generation_duration` = measured time in ms.
    - Returns proposals and `generation_id` to the client.
  - On LLM error / timeout:
    - Inserts a row into `generation_error_logs` with `user_id`, `model`, `source_text_hash`, `source_text_length`, `error_code`, `error_message`.
    - Returns an error response to the client.
- **Response JSON (200)** on success:
  - `generation_id`: number.
  - `proposals`: array of
    - `{ temp_id: string; front: string; back: string; }`
- **Success**:
  - `200 OK` – proposals returned.
- **Errors**:
  - `400 Bad Request` – invalid or out-of-range `source_text`.
  - `401 Unauthorized` – not logged in.
  - `429 Too Many Requests` – per-user/per-IP rate limit exceeded for AI generation.
  - `502 Bad Gateway` – upstream LLM error (also logged to `generation_error_logs`).
  - `500 Internal Server Error` – internal failure.

##### 2.3.2 POST `/api/flashcards/ai/save`

- **Description**: Save accepted (possibly edited) AI proposals as flashcards and update the corresponding `generations` row with acceptance metrics.
- **Request JSON**:
  - `generation_id`: number, required, must refer to an existing `generations` row owned by the user.
  - `generated_count`: number, required – total proposals originally returned (for consistency check with `generations.generated_count`).
  - `flashcards`: array of at least one item, each:
    - `front`: string, required, max 200 characters.
    - `back`: string, required, max 500 characters.
    - `source`: string, required, either `'ai-full'` or `'ai-edited'`.
- **Server behavior**:
  - Verifies `generation_id` belongs to the current user (RLS + explicit check).
  - Validates all `front`/`back` lengths and `source` enum.
  - Checks `generated_count` matches the stored `generations.generated_count`; on mismatch, returns `409 Conflict`.
  - Inserts one row into `flashcards` per `flashcards[]` item with:
    - `user_id` = current user.
    - `generation_id` = `generation_id`.
    - `source` = provided (`'ai-full'` or `'ai-edited'`).
  - Updates `generations` row:
    - `accepted_unedited_count` = number of `flashcards` with `source = 'ai-full'`.
    - `accepted_edited_count` = number with `source = 'ai-edited'`.
- **Response JSON (201)**:
  - `saved_count`: number.
  - `flashcards`: array of newly created flashcards (same shape as in 2.2.1).
- **Success**:
  - `201 Created` – flashcards saved and analytics updated.
- **Errors**:
  - `400 Bad Request` – invalid payload, lengths, or `source` values.
  - `401 Unauthorized` – not logged in.
  - `403 Forbidden` – `generation_id` does not belong to the user.
  - `404 Not Found` – `generation_id` not found.
  - `409 Conflict` – `generated_count` mismatch.
  - `422 Unprocessable Entity` – DB constraint violation.
  - `500 Internal Server Error` – DB error.

---

#### 2.4 Learning Module

The learning module uses existing `flashcards` data and a simple spaced repetition algorithm implemented in application code (no extra tables).

##### 2.4.1 POST `/api/learning/session`

- **Description**: Start a new learning session for the current user.
- **Request JSON** (all optional):
  - `limit`: number, optional, default `30` – maximum number of cards in this session.
  - `strategy`: string, optional – e.g. `'mixed'` (default), `'oldest-first'`, `'newest-first'`.
- **Server behavior**:
  - Fetches candidate flashcards for the user (e.g. all or a capped subset).
  - Orders them based on chosen `strategy`.
  - Generates a transient `session_id` and initial queue; session ordering may be returned fully to the client.
- **Response JSON (200)**:
  - `session_id`: string.
  - `cards`: array of
    - `{ card_id: number; front: string; }` – back is revealed client-side by calling another endpoint.
- **Success**:
  - `200 OK` – session initialized.
- **Errors**:
  - `401 Unauthorized` – not logged in.
  - `500 Internal Server Error` – DB error.

##### 2.4.2 GET `/api/learning/flashcards/:id`

- **Description**: Retrieve full content of a flashcard during a learning session (used when user clicks "Reveal Answer").
- **Path parameters**:
  - `id`: integer, required – flashcard ID.
- **Response JSON (200)**:
  - `{ id: number; front: string; back: string; }`
- **Success**:
  - `200 OK` – flashcard returned.
- **Errors**:
  - `400 Bad Request` – invalid ID.
  - `401 Unauthorized` – not logged in.
  - `404 Not Found` – flashcard not found or not owned by user.
  - `500 Internal Server Error` – DB error.

##### 2.4.3 POST `/api/learning/session/:session_id/feedback`

- **Description**: Submit self-assessment for a studied flashcard and receive the next card for this session.
- **Path parameters**:
  - `session_id`: string, required.
- **Request JSON**:
  - `card_id`: number, required.
  - `grade`: string, required – e.g. `'again' | 'hard' | 'good' | 'easy'`.
- **Server behavior**:
  - Validates that `card_id` belongs to current user.
  - Applies a simple spaced repetition decision rule to compute next `card_id` to serve in this session.
  - Session state can be maintained client-side (recommended for MVP) or via short-lived server state (e.g. in-memory cache); no extra DB schema required.
- **Response JSON (200)**:
  - `next_card`: `{ card_id: number; front: string; } | null` – `null` if session complete.
- **Success**:
  - `200 OK` – feedback accepted and next card computed.
- **Errors**:
  - `400 Bad Request` – invalid payload.
  - `401 Unauthorized` – not logged in.
  - `404 Not Found` – card missing or not owned by user.
  - `410 Gone` – session expired (optional behavior).
  - `500 Internal Server Error` – internal error.

---

#### 2.5 Internal Analytics (optional, internal / admin)

These endpoints expose aggregated metrics as described in the PRD. They should be protected by stricter authorization (e.g. admin role) in addition to regular authentication.

##### 2.5.1 GET `/api/admin/analytics/ai-acceptance`

- **Description**: Returns AI-generated flashcard acceptance rate (SM-01) and related statistics.
- **Query parameters** (optional):
  - `from`: ISO datetime string – start of period.
  - `to`: ISO datetime string – end of period.
- **Response JSON (200)**:
  - `time_range`: `{ from: string | null; to: string | null; }`
  - `totals`:
    - `proposed`: number – sum of `generations.generated_count`.
    - `accepted_unedited`: number – sum of `accepted_unedited_count`.
    - `accepted_edited`: number – sum of `accepted_edited_count`.
    - `accepted_total`: number.
    - `acceptance_rate`: number – `(accepted_total / proposed) * 100`.
- **Success**:
  - `200 OK` – analytics returned.
- **Errors**:
  - `401 Unauthorized` – not logged in.
  - `403 Forbidden` – user not admin.
  - `500 Internal Server Error` – DB error.

##### 2.5.2 GET `/api/admin/analytics/ai-adoption`

- **Description**: Returns AI adoption rate (SM-02) based on `flashcards.source`.
- **Response JSON (200)**:
  - `totals`:
    - `total_flashcards`: number.
    - `ai_generated`: number – count where `source` in (`'ai-full'`, `'ai-edited'`).
    - `manual`: number – count where `source = 'manual'`.
    - `ai_adoption_rate`: number – `(ai_generated / total_flashcards) * 100`.
- **Success**:
  - `200 OK` – analytics returned.
- **Errors**:
  - `401 Unauthorized` – not logged in.
  - `403 Forbidden` – user not admin.
  - `500 Internal Server Error` – DB error.

---

### 3. Authentication and Authorization

- **Authentication mechanism**:
  - Supabase Auth (email/password) with JWT-based sessions.
  - Astro API routes use `Astro.locals.supabase` (Supabase client bound to the request) to identify the current user and interact with the DB and Auth APIs.
  - Clients authenticate via Authorization header (`Bearer <access_token>`) or secure HTTP-only cookies.

- **Authorization model**:
  - PostgreSQL Row-Level Security (RLS) is enabled on `flashcards`, `generations`, and `generation_error_logs` with policies `users.id = user_id`.
  - All application queries use the authenticated Supabase client, ensuring RLS is enforced automatically.
  - Flashcard, generation, and error-log endpoints do **not** accept `user_id` in the payload; the backend derives it from the authenticated session.
  - Admin analytics endpoints additionally require an `admin` role/claim (e.g. via Supabase custom claims or a separate `is_admin` mapping), validated in the API route.

- **Rate limiting & abuse protection**:
  - AI generation endpoints (`/api/flashcards/ai/generate`, `/api/flashcards/ai/save`) are protected by per-user and per-IP rate limits (e.g. using middleware / edge functions):
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

**User / Auth**

- `email` must be a valid email format.
- `password` and `new_password` must satisfy password policy (minimum length, recommended complexity rules).
- Account deletion requires explicit confirmation string `"DELETE"`.

**Flashcards** (`flashcards` table)

- `front`: required, non-empty, max 200 characters.
- `back`: required, non-empty, max 500 characters.
- `source`: required, must be one of `('ai-full', 'ai-edited', 'manual')`.
- `generation_id`: optional; if set, must reference an existing `generations.id` row belonging to the same user (enforced by RLS + foreign key).
- `user_id`: never taken from client; always populated from authenticated user.

**Generations** (`generations` table)

- `user_id`: required, from authentication.
- `model`: required, non-empty string, must be one of allowed model IDs configured in the backend.
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
  - `/api/flashcards/ai/generate` implements text submission, LLM call, proposal display, error handling, and `generations` + `generation_error_logs` logging.
  - `/api/flashcards/ai/save` implements the accept/edit/save flow, creation of `flashcards` rows, and updates `accepted_unedited_count` / `accepted_edited_count`.

- **Manual Flashcard Creation (F-03, US-008)**:
  - `/api/flashcards` (POST) allows manual add with validation on `front` (≤ 200 chars) and `back` (≤ 500 chars), marking `source = 'manual'`.

- **Flashcard Management (F-04, US-009–US-012)**:
  - `/api/flashcards` (GET) provides paginated listing and simple search (`q` against `front` and `back`).
  - `/api/flashcards/:id` (GET) shows full flashcard.
  - `/api/flashcards/:id` (PATCH) edits content.
  - `/api/flashcards/:id` (DELETE) deletes flashcards.

- **Learning Module (F-05, US-013–US-015)**:
  - `/api/learning/session` starts a learning session and returns a sequence of cards.
  - `/api/learning/flashcards/:id` reveals full front/back during a session.
  - `/api/learning/session/:session_id/feedback` records per-card feedback (grade) and computes the next card, encapsulating spaced repetition logic.

- **Internal Analytics (F-06, SM-01, SM-02)**:
  - `generations` + `flashcards` tables serve as the source of truth for AI acceptance/adoption metrics.
  - `/api/admin/analytics/ai-acceptance` and `/api/admin/analytics/ai-adoption` expose these metrics for internal dashboards.

#### 4.3 Error Handling Strategy

- All endpoints return structured error JSON:
  - `error`: machine-readable error code string (e.g. `"validation_error"`, `"unauthorized"`, `"rate_limited"`).
  - `message`: human-readable explanation (safe for UI display).
  - `details`: optional, structured field-level errors for validation issues.
- Business-rule violations (e.g. invalid state transitions or mismatched `generated_count`) return `409 Conflict` or `422 Unprocessable Entity` with clear messages.
- LLM-related errors are always logged in `generation_error_logs` and surfaced as `502` or `500` with generic messages to avoid leaking upstream details.

---

This REST API plan aligns with the current PostgreSQL schema, PRD requirements, and the Astro + Supabase + OpenRouter tech stack, providing a clear mapping from product features to concrete, validated, and secure endpoints.
