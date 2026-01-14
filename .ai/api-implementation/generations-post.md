<analysis>

**1. Key points of the API specification**

- Endpoint: `POST /generations`.
- Auth: requires logged-in user; otherwise `401`.
- Input JSON: `{ source_text: string }`.
- Validation: `source_text` required, length between 1000 and 10000 characters inclusive.
- Processing steps:
  - Compute `source_text_hash` (e.g. SHA-256) and `source_text_length`.
  - Call OpenRouter LLM (via HTTP) with a prompt that instructs it to return flashcard proposals.
  - Measure generation duration in ms.
- On success:
  - Parse LLM output into list of `{ front, back }` proposals.
  - Insert row in `generations` with analytics and metadata.
  - Return `200 OK` with `{ generation_id, flashcards_proposals, generated_count }`.
- On error from LLM (including timeout):
  - Insert row in `generation_error_logs` with error code/message and input metadata.
  - Return error response to client (`502` for upstream issues, `429` for rate-limit, etc.).
- Rate limiting: `429` when per-user/per-IP generation limit exceeded.
- Other errors: `400` invalid input, `500` internal.

**2. Required and optional parameters**

- **HTTP-level**
  - Required:
    - Auth context: `user.id` (from Supabase auth in Astro `locals`), implied by `401` requirement.
  - Optional:
    - None explicitly at route level (no query or path params described).

- **Request body JSON** (`CreateGenerationCommand` already defined in `src/types.ts`):
  - Required fields:
    - `source_text: string` – must be present and non-empty; length in `[1000, 10000]` chars.
  - Optional fields:
    - None defined in spec.

- **Derived / internal parameters** (not part of public API but required for implementation):
  - `source_text_hash: string` – SHA-256 of `source_text` (hex or base64; hex is typical for varchar).
  - `source_text_length: number` – number of characters in `source_text` (must satisfy DB check).
  - `model: string` – OpenRouter model identifier (e.g. `openai/gpt-4.1-mini`), taken from config/env.
  - `generation_duration: number` – ms between just before LLM call and just after successful parse.
  - `generated_count: number` – proposals length.
  - `error_code: string` – stable short code for `generation_error_logs` (e.g. `upstream_timeout`, `upstream_error`, `invalid_upstream_response`).
  - `error_message: string` – human-readable description / partial upstream message.
  - Rate limit identifiers: user id + IP (from request) to check per-user/per-IP limits.

**3. Necessary DTO types and Command Models**

- From `src/types.ts` (already present):
  - `CreateGenerationCommand` (request body): `{ source_text: string }`.
  - `FlashcardProposalDto`: `{ temp_id: string; front: string; back: string; source: "ai-full" }`.
  - `CreateGenerationResponseDto`: `{ generation_id: number; flashcards_proposals: FlashcardProposalDto[]; generated_count: number }`.
  - `GenerationErrorLogDto`, `GenerationErrorLogsListResponseDto` (for other endpoints, but useful to align shapes).
- Additional internal models (not exported through `src/types.ts`, but useful in services):
  - `AiGenerationResult` (service output):
    - `proposals: Array<{ front: string; back: string }>`
    - `model: string`
    - `duration_ms: number`
  - `ParsedFlashcardProposal` (intermediate parsing type): `{ front: string; back: string }`.
  - `OpenRouterError` (internal error type):
    - `code: "timeout" | "upstream_error" | "invalid_response" | "rate_limited" | "bad_request" | "unknown"`
    - `httpStatus?: number`
    - `message: string`
    - `upstreamCode?: string | number`
- Database insert models (typed via Supabase-generated types and `TablesInsert` generics):
  - `TablesInsert<"generations">` – used for insert payload into `generations` table.
  - `TablesInsert<"generation_error_logs">` – used for insert payload into error logs table.

**4. Logic extraction to services**
To keep the Astro route thin and follow backend rules, the core logic should live in services under `src/lib/services`:

- `src/lib/services/aiGenerationService.ts` (or similar):
  - Responsible for:
    - Validating and preparing prompt for OpenRouter.
    - Calling OpenRouter HTTP API (using `fetch` with `import.meta.env.OPENROUTER_API_KEY` etc.).
    - Measuring duration.
    - Parsing the JSON/text response to structured flashcard proposals (`{ front, back }[]`).
  - API surface (example):
    - `generateFlashcardProposals(options: { sourceText: string; model: string; timeoutMs: number }): Promise<AiGenerationResult>`
    - Throw well-typed errors (e.g. `OpenRouterError` or custom error classes) for upstream issues.

- `src/lib/services/generationAnalyticsService.ts`:
  - Responsible for DB interactions related to generations and error logs.
  - API surface:
    - `logGenerationSuccess(supabase, params): Promise<{ generationId: number }>` where `params` includes user id, model, counts, hash, length, duration.
    - `logGenerationError(supabase, params): Promise<void>` where `params` includes user id, model, hash, length, errorCode, errorMessage.
  - Uses Supabase client from `Astro.locals`.

- Route handler glue (`src/pages/api/generations.ts` or `/generations/index.ts` depending on routing pattern):
  - Responsibilities:
    - Authentication / user extraction.
    - Request validation using Zod (`CreateGenerationCommand` schema mirror).
    - Rate limit checks.
    - Hash/length calculations.
    - Calling `aiGenerationService.generateFlashcardProposals`.
    - On success: call `generationAnalyticsService.logGenerationSuccess`, map proposals to `FlashcardProposalDto`, return `CreateGenerationResponseDto`.
    - On LLM errors: call `generationAnalyticsService.logGenerationError` and map error to HTTP status and JSON body.

**5. Input validation plan**

- Tooling: Zod schemas in the route, per backend rules.
- Schema for request body:
  - `source_text`:
    - `z.string()`
    - `.min(1000, { message: "source_text must be at least 1000 characters" })`
    - `.max(10000, { message: "source_text must be at most 10000 characters" })`.
- Additional checks / guards:
  - Reject non-JSON or invalid JSON body with `400` and a standard error payload.
  - Reject empty or whitespace-only `source_text`, even if length matches, if desired (optional tightening).
  - Enforce content-type `application/json` (or accept JSON with appropriate check; otherwise respond `415` or `400` – spec doesnt require 415, so likely treat as `400`).
  - Rate limit check before heavy work:
    - Use per-user and per-IP counters (implementation may rely on Supabase, Redis, or in-memory store; in this stack probably Supabase or another store; the plan should remain storage-agnostic but note requirement).
    - If exceeded: return `429` with short message; no LLM call or DB `generations` insert; might still log meta info to `generation_error_logs` only if spec requires (not required, so error logs table stays for upstream errors only).
- DB constraints alignment:
  - Ensure `source_text_length` used for inserts always equals `source_text.length` and is within `[1000, 10000]`, matching DB `CHECK`.
  - Ensure `generation_duration` is non-negative integer.
  - `generated_count` must equal `flashcards_proposals.length`.

**6. Error logging in `generation_error_logs`**

- When to log:
  - Only when there is an LLM/upstream-related error (including timeouts, invalid response formats, non-2xx HTTP statuses, OpenRouter rate-limits, etc.).
  - Do **not** log validation (`400`) or authentication (`401`) errors here; they are not upstream failures.
- Fields population:
  - `user_id`: from Supabase auth context.
  - `model`: same model used (or attempted) for the LLM call.
  - `source_text_hash`: computed SHA-256 of `source_text`.
  - `source_text_length`: `source_text.length`.
  - `error_code`: mapped from internal/OpenRouter error code. Examples:
    - `upstream_timeout` – when the LLM call exceeds configured timeout.
    - `upstream_http_error_<status>` – e.g. `upstream_http_error_500`.
    - `upstream_invalid_response` – response not parseable into expected structure.
    - `upstream_rate_limited` – OpenRouter 429.
  - `error_message`:
    - Concise, sanitized message combining a high-level description with limited upstream info.
    - Avoid logging secrets, full prompts, or very long text; truncate to safe length (e.g. 1000 chars).
- Error log insertion behavior:
  - Fire-and-forget style, but still awaited so that persistent failures surface – if logging itself fails, route should continue returning an error response (preferably `500` if logging failure indicates broader DB problems).

**7. Potential security threats**

- **Unauthorized access**:
  - Calling endpoint without logged-in user must be blocked and return `401`.
  - Use Supabase auth session from Astro context; do not accept user ID from client.

- **Abuse / denial-of-service via long or frequent inputs**:
  - Mitigated by `source_text` length validation and rate limiting.
  - Ensure a strict timeout on LLM call to avoid tying up server resources.

- **Prompt injection and malicious content in `source_text`**:
  - LLM is external; prompts may be adversarial.
  - Use strong, instruction-first prompt design that does not echo untrusted content in system messages more than necessary.
  - Treat all LLM outputs as untrusted: validate structure and length of `front` / `back` before returning.

- **Data leakage in logs**:
  - Avoid logging full `source_text` in DB or app logs; only retain hash and length as per schema.
  - Similarly, avoid storing entire OpenRouter response or prompt; only log minimal error info.

- **API key exposure**:
  - Read OpenRouter API key from `import.meta.env` variables.
  - Never send key to client or log it.

- **Injection in generated flashcards**:
  - Generated `front`/`back` content could contain HTML/JS. The API should return them as plain strings and UI should treat them as text, not as `innerHTML`. The API plan should note this expectation.

- **Multi-tenant data isolation**:
  - `user_id` derived from auth session ensures generation records are tied only to their owner.
  - Subsequent APIs must filter by `user_id`, but that is out of scope here; this plan keeps logging scoped to current user.

**8. Potential error scenarios and status codes**

- **400 Bad Request**
  - Missing `source_text`.
  - `source_text` not a string.
  - `source_text` length < 1000 or > 10000.
  - Invalid JSON body.
  - Response body: e.g. `{ error: "invalid_request", message: "source_text must be between 1000 and 10000 characters" }`.

- **401 Unauthorized**
  - No valid Supabase auth session in Astro context.
  - Response body: `{ error: "unauthorized", message: "Authentication required" }`.

- **429 Too Many Requests**
  - Per-user or per-IP rate limit exceeded for this endpoint.
  - Response body: `{ error: "rate_limited", message: "Too many generation requests, please try again later" }`.

- **502 Bad Gateway**
  - Upstream LLM error (non-2xx, timeout, invalid response) while the rest of backend functions normally.
  - Also creates a row in `generation_error_logs`.
  - Response body: `{ error: "upstream_error", message: "AI provider failed to generate flashcards" }`.

- **500 Internal Server Error**
  - DB failure inserting into `generations` or `generation_error_logs`.
  - Unexpected exceptions in service code.
  - Misconfiguration (e.g. missing API key) detected at runtime.
  - Response body: `{ error: "internal_error", message: "Unexpected server error" }`.

- **Implementation note on 201 vs 200**
  - Spec explicitly states success response is `200 OK` for proposals (no flashcards persisted yet), which aligns with guidelines that `201 Created` is for resource creation. Here we only create an analytics record (`generations`), while the actual flashcards are not yet stored.

</analysis>

# API Endpoint Implementation Plan: POST /generations

## 1. Endpoint Overview

Server-side REST endpoint responsible for generating AI-based flashcard proposals from user-provided source text. It:

- Accepts a long `source_text` from the authenticated user.
- Validates length constraints (1000–10000 characters).
- Calls OpenRouter LLM to generate flashcard proposals.
- Measures generation duration.
- Persists an analytics record in the `generations` table on success.
- Logs upstream AI failures in `generation_error_logs`.
- Returns proposals (not yet stored flashcards) plus a `generation_id` to be referenced by later endpoints (e.g. creating/accepting flashcards).

No flashcards are persisted by this endpoint; it only produces proposals and analytics.

## 2. Request Details

- **HTTP Method**: `POST`
- **URL**: `/generations`
- **Authentication**:
  - Requires a valid Supabase-authenticated user available in Astro `locals`.
  - If no authenticated user is present, respond with `401 Unauthorized`.
- **Headers**:
  - `Content-Type: application/json` (required for request body parsing).
  - `Authorization: Bearer <access_token>` (handled by Supabase/astro integration).

### Request Body

JSON object matching `CreateGenerationCommand` from `src/types.ts`:

```jsonc
{
  "source_text": "<string, 1000-10000 characters>",
}
```

- **Required fields**:
  - `source_text: string`
- **Field constraints**:
  - Must be a string.
  - `source_text.length >= 1000` and `<= 10000` (characters).
  - Optionally trim leading/trailing whitespace before measuring length (define explicitly in implementation to keep behavior predictable).

### Validation Behavior

- Use a Zod schema in the route implementation to validate the JSON body.
- If JSON is invalid, missing `source_text`, or violates length constraints:
  - Return `400 Bad Request`.
  - Response payload should include a stable `error` code and a human-readable `message`.

### Derived Values (internal)

- `source_text_length: number` – `source_text.length` after any trimming logic; must fall within `[1000, 10000]`.
- `source_text_hash: string` – SHA-256 hash of `source_text` encoded as hex string for storage in `varchar`.
- `model: string` – OpenRouter model identifier from configuration (e.g. `import.meta.env.OPENROUTER_MODEL`).
- `generation_duration: number` – measured in milliseconds from just before the LLM call to immediately after successful parse.

### Rate Limiting

- Apply per-user and per-IP rate limits for this endpoint to prevent abuse:
  - Use a shared store (e.g. Supabase table, Redis, or other) according to project-wide approach.
  - Rate limit check must occur **after** auth and **before** the LLM call.
- If rate limit exceeded:
  - Return `429 Too Many Requests`.
  - Do **not** call OpenRouter.
  - Do **not** insert a `generations` row.
  - Optionally log basic telemetry via generic logging, but **not** in `generation_error_logs` table (reserved for upstream LLM failures).

## 3. Used Types

Types from `src/types.ts`:

- **`CreateGenerationCommand`**
  - Shape of the incoming JSON body: `{ source_text: string }`.
  - Used as the TypeScript type for parsed and validated request bodies.

- **`FlashcardProposalDto`**
  - DTO for individual proposals returned to the client:
    - `temp_id: string` – generated on the server; unique per proposal within this response.
    - `front: string` – flashcard question/term.
    - `back: string` – flashcard answer/explanation.
    - `source: "ai-full"` – constant literal indicating full AI generation.

- **`CreateGenerationResponseDto`**
  - Overall success response shape:
    - `generation_id: number` – primary key of inserted `generations` row.
    - `flashcards_proposals: FlashcardProposalDto[]` – list of proposals.
    - `generated_count: number` – number of proposals.

Supabase entity aliases (internal, already derived in `src/types.ts`):

- `GenerationRow` – inferred shape of a row from the `generations` table.
- `GenerationErrorLogRow` – inferred shape of a row from `generation_error_logs`.

Service-level helper types (internal, defined in `src/lib/services`):

- `AiGenerationResult` (not exported to clients):
  - `proposals: Array<{ front: string; back: string }>`
  - `model: string`
  - `duration_ms: number`

- `OpenRouterError` (or equivalent error model):
  - Holds typed information about upstream failures and is mapped to HTTP status + `generation_error_logs` entries.

## 3. Response Details

### Success (200 OK)

- Status: `200 OK`.
- Body: `CreateGenerationResponseDto`.

```jsonc
{
  "generation_id": 123,
  "flashcards_proposals": [
    {
      "temp_id": "temp-1",
      "front": "What is ...?",
      "back": "...",
      "source": "ai-full",
    },
  ],
  "generated_count": 1,
}
```

- Semantics:
  - `generation_id` corresponds to a row in `generations` linked to the current `user_id`.
  - `flashcards_proposals` are **not** yet saved; they are transient proposals.
  - `generated_count` must equal `flashcards_proposals.length`.

### Error Responses

All error responses should follow a consistent error envelope:

```jsonc
{
  "error": "<machine_readable_code>",
  "message": "<human readable description>",
}
```

- `400 Bad Request`
  - `error`: `"invalid_request"`.
  - Example `message`: "source_text must be between 1000 and 10000 characters".

- `401 Unauthorized`
  - `error`: `"unauthorized"`.
  - `message`: "Authentication required".

- `429 Too Many Requests`
  - `error`: `"rate_limited"`.
  - `message`: "Too many generation requests, please try again later".

- `502 Bad Gateway`
  - `error`: `"upstream_error"` (or more specific, e.g. `"upstream_timeout"`).
  - `message`: generic explanation that AI provider failed.

- `500 Internal Server Error`
  - `error`: `"internal_error"`.
  - `message`: generic unexpected server error text.

No `404 Not Found` is expected for this endpoint because it does not reference a resource by ID in the URL.

## 4. Data Flow

1. **Request Ingress**
   - Astro route `/src/pages/api/generations.ts` (or `/generations/index.ts`) receives `POST` request.
   - Extract Supabase client and auth info from `Astro.locals`.

2. **Authentication Guard**
   - If `user` is missing or invalid, immediately return `401`.

3. **Rate Limit Check**
   - Compute rate limit key (e.g. `user_id` + IP).
   - Query/update rate limit store.
   - On violation: return `429` without further processing.

4. **Body Parsing and Validation**
   - Parse JSON body.
   - Validate against Zod schema mirroring `CreateGenerationCommand`.
   - On validation failure: return `400`.

5. **Pre-computation**
   - Compute `source_text_length`.
   - If out of range (guard against inconsistencies), return `400`.
   - Compute `source_text_hash` via SHA-256.
   - Resolve `model` and `timeoutMs` from configuration.

6. **LLM Invocation via Service**
   - Call `aiGenerationService.generateFlashcardProposals({ sourceText, model, timeoutMs })`.
   - Service responsibilities:
     - Build prompt with clear instructions and expected JSON schema.
     - Invoke OpenRouter with API key from `import.meta.env`.
     - Enforce timeout.
     - Parse and validate response into `{ front, back }[]`.
     - Return `AiGenerationResult` on success or throw `OpenRouterError` on failure.

7. **Handle LLM Success**
   - From `AiGenerationResult`, obtain `proposals` and `duration_ms`.
   - Map proposals to `FlashcardProposalDto[]`:
     - Generate `temp_id` (e.g. `crypto.randomUUID()` or deterministic index-based IDs).
     - Set `source` to `"ai-full"`.
   - Set `generated_count = proposals.length`.

8. **Persist Generation Analytics**
   - Call `generationAnalyticsService.logGenerationSuccess(supabase, { userId, model, generatedCount, sourceTextHash, sourceTextLength, generationDuration })`.
   - Service inserts into `generations` table and returns new `generation_id`.

9. **Return Success Response**
   - Construct `CreateGenerationResponseDto` using `generation_id`, `flashcards_proposals`, and `generated_count`.
   - Return `200 OK` with JSON body.

10. **Handle LLM Errors**
    - Catch `OpenRouterError` from service.
    - Map to `error_code` and `error_message` for `generation_error_logs`.
    - Call `generationAnalyticsService.logGenerationError(supabase, { userId, model, sourceTextHash, sourceTextLength, errorCode, errorMessage })`.
    - Map error to HTTP status:
      - Timeout / upstream HTTP errors / invalid response → `502`.
      - Upstream rate limit → `502` or `429` depending on design; per spec, treat as `502 Bad Gateway` from our API while still returning a clear message.
    - Return consistent error envelope.

11. **Handle Internal Failures**
    - For unexpected exceptions (e.g. DB insert failure), log server-side and return `500` with generic error envelope.

## 5. Security Considerations

- **Authentication**
  - Endpoint must be protected by Supabase auth.
  - Never accept `user_id` from the client; always derive from `Astro.locals`.

- **Authorization / Multi-tenancy**
  - `generations` rows must always be created with `user_id` equal to the authenticated user; this ensures proper ownership.
  - Downstream endpoints using `generation_id` must filter by `user_id` (out of scope here but important to note).

- **Input Validation**
  - Strictly validate request body using Zod.
  - Reject non-string `source_text` or out-of-range lengths early.

- **Secrets Management**
  - Read OpenRouter API key and base URL from `import.meta.env`.
  - Never return these values in responses or log them.

- **Data Minimization**
  - Do not store raw `source_text` or full OpenRouter responses in DB.
  - Store only `source_text_hash` and `source_text_length` in analytics and error logs.
  - Truncate error messages stored in `generation_error_logs` to a safe length.

- **Output Safety**
  - Treat `front` and `back` as untrusted text; they may contain HTML or scripts.
  - Document expectation that the frontend renders them as text, not injected HTML.

- **Denial of Service Protection**
  - Enforce strict maximum `source_text` length.
  - Configure a reasonable timeout for OpenRouter calls.
  - Apply per-user and per-IP rate limits.

## 6. Error Handling

- **Validation Errors (400)**
  - Detected by Zod schema and additional guards.
  - Do not hit OpenRouter or DB in this case.

- **Authentication Errors (401)**
  - If Supabase user is absent, return `401`.
  - No DB logging in `generation_error_logs`.

- **Rate Limit Errors (429)**
  - Thrown by rate limit check.
  - Do not call OpenRouter or write to `generations` or `generation_error_logs`.

- **Upstream LLM Errors (502)**
  - Timeout, non-2xx status, or unparsable/invalid response from OpenRouter.
  - Log to `generation_error_logs` with `error_code` and `error_message`.
  - Return `502` with `upstream_error` code in response.

- **Internal Server Errors (500)**
  - DB insert failures for `generations` or `generation_error_logs`.
  - Misconfiguration (e.g. missing API key) or unexpected exceptions.
  - Log details server-side; return generic `internal_error` envelope to client.

- **Error Mapping Strategy**
  - Centralize mapping from internal error types to HTTP status + response envelope to keep behavior consistent and testable.

## 7. Performance Considerations

- **LLM Call Efficiency**
  - Use concise prompts that still yield high-quality flashcards to minimize token usage and latency.
  - Consider specifying a maximum number of flashcards in the prompt to bound response size.

- **Timeouts**
  - Configure a sensible timeout (e.g. 20–30 seconds) for OpenRouter calls to avoid long-running requests.

- **Database Access**
  - Only two DB writes per successful call: one `generations` insert; error cases add a single `generation_error_logs` insert.
  - No reads from DB are required in the hot path.

- **Rate Limiting**
  - Effective rate limits protect upstream provider and our infrastructure from misuse.

- **Serialization**
  - Ensure proposals are validated (e.g. max length per `front`/`back`) before returning to prevent oversized responses.

## 8. Implementation Steps

1. **Define Configuration**
   - Add environment variables for OpenRouter:
     - `OPENROUTER_API_KEY`
     - `OPENROUTER_BASE_URL` (if not default).
     - `OPENROUTER_MODEL`.
     - `OPENROUTER_TIMEOUT_MS` (optional, with a sensible default in code).

2. **Design Zod Schema**
   - Create a Zod schema in the API route file for `CreateGenerationCommand`.
   - Ensure length validation matches `[1000, 10000]`.

3. **Implement AI Generation Service**
   - Add `src/lib/services/aiGenerationService.ts`.
   - Implement `generateFlashcardProposals({ sourceText, model, timeoutMs })`:
     - Build prompt.
     - Call OpenRouter via `fetch` with correct headers.
     - Enforce timeout.
     - Parse and validate response into structured proposals; validate structure.
     - Throw typed `OpenRouterError` on failures.

4. **Implement Generation Analytics Service**
   - Add `src/lib/services/generationAnalyticsService.ts`.
   - Implement `logGenerationSuccess(supabase, params)` to insert into `generations` and return `generation_id`.
   - Implement `logGenerationError(supabase, params)` to insert into `generation_error_logs`.

5. **Create/Update API Route**
   - Implement `POST` handler in `src/pages/api/generations.ts`:
     - Extract Supabase client and authenticated user from context.
     - Enforce auth guard.
     - Perform rate limit check.
     - Parse and validate body with Zod.
     - Compute `source_text_hash` and `source_text_length`.
     - Call AI generation service and capture `duration_ms`.
     - On success, call analytics service to log generation, then return `CreateGenerationResponseDto`.
     - On LLM errors, log to `generation_error_logs` and return `502` with error envelope.
     - On other errors, return `500`.

6. **Add Unit Tests for Services**
   - Test `aiGenerationService` with mocked OpenRouter responses (success, error, invalid JSON, timeout).
   - Test `generationAnalyticsService` with mocked Supabase client (inserts success/failure).

7. **Add Integration Tests for Route**
   - Test success path: valid `source_text`, authenticated user, mock LLM and DB.
   - Test `400`, `401`, `429`, `502`, and `500` scenarios.
   - Verify `generations` and `generation_error_logs` are written as expected.

8. **Logging and Monitoring**
   - Add server-side logs for key events (rate-limit hits, upstream errors, internal failures) without leaking PII or secrets.
   - Optionally integrate with existing observability stack for metrics on generation volume, latency, and error rates.

9. **Documentation**
   - Document endpoint behavior, request/response, and error formats for frontend consumers.
   - Highlight that returned flashcards are proposals only and must be persisted via dedicated flashcards endpoints.
