# API Endpoint Implementation Plan: POST /generations

## 1. Endpoint Overview

Server-side REST endpoint responsible for generating AI-based flashcard proposals from user-provided source text. It:

- Accepts a long `source_text` from the authenticated user.
- Validates `source_text` length constraints (1000–10000 characters).
- Calls OpenRouter LLM to generate flashcard proposals.
- Measures generation duration.
- Persists an analytics record in the `generations` table on success.
- Logs upstream AI failures in `generation_error_logs`.
- Returns proposals (not yet stored flashcards) to be referenced by later endpoints (e.g. creating/accepting flashcards).

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

## 3. Used Types

Types from `src/types.ts`:

- **`CreateGenerationCommand`**
  - Shape of the incoming JSON body: `{ source_text: string }`.
  - Used as the TypeScript type for parsed and validated request bodies.

- **`FlashcardProposalDto`**
  - DTO for individual ai generated flashcardproposal returned to the client:
    - `temp_id: string` – generated on the server; unique per proposal within this response.
    - `front: string` – flashcard question/term.
    - `back: string` – flashcard answer/explanation.
    - `source: "ai-full"` – constant literal indicating full AI generation.

- **`CreateGenerationResponseDto`**
  - Overall success response shape:
    - `generation_id: number` – primary key of inserted `generations` row.
    - `flashcards_proposals: FlashcardProposalDto[]` – list of proposals.
    - `generated_count: number` – number of proposals.

## 4. Response Details

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

- `502 Bad Gateway`
  - `error`: `"upstream_error"`.
  - `message`: generic explanation that AI provider failed.

- `500 Internal Server Error`
  - `error`: `"internal_error"`.
  - `message`: generic unexpected server error text.

## 5. Data Flow

1. **Request Ingress**
   - Astro route `/src/pages/api/generations.ts` receives `POST` request.
   - In astro route use supabase from context.locals.

2. **Authentication Guard**
   - If `user` is missing or invalid, immediately return `401`.

3. **Body Parsing and Validation**
   - Parse JSON body.
   - Validate against Zod schema mirroring `CreateGenerationCommand`.
   - On validation failure: return `400`.

4. **Calling dedicated Service**
   - Call `generateFlashcardProposals({ source_text })` on GenerationService instance which will:
     - call OpenRouter API passing received source_text
     - on success compute and save generation metadata and return results in the shape compatible with `CreateGenerationResponseDto`

5. **Return Success Response**
   - response data: `CreateGenerationResponseDto`

6. **Handle LLM Errors**
   - Catch `OpenRouterError` from service.
   - prepare and save error data into `generation_error_logs`.
   - HTTP status: `502`.
   - Return consistent error envelope.

7. **Handle Internal Failures**
   - For unexpected exceptions (e.g. DB insert failure) return `500` with generic error envelope.

## 6. Security Considerations

- **Authentication**
  - Endpoint must be protected by Supabase auth.
  - Never accept `user_id` from the client; always derive from `Astro.locals`.

- **Authorization / Multi-tenancy**
  - `generations` rows must always be created with `user_id` equal to the authenticated user; this ensures proper ownership.

- **Input Validation**
  - Strictly validate request body using Zod.
  - Reject non-string `source_text` or out-of-range lengths early.

- **Secrets Management**
  - Read OpenRouter API key and base URL from `import.meta.env.OPENROUTER_API_KEY`.
  - Never return these values in responses or log them.

- **Data Minimization**
  - Do not store raw `source_text` or full OpenRouter responses in DB. Store only `source_text_hash` and `source_text_length` in analytics and error logs.
  - Truncate error messages stored in `generation_error_logs` to a safe length.

- **Output Safety**
  - Treat `front` and `back` as untrusted text; they may contain HTML or scripts.

- **Error data limited exposure**
  - Detailed error data is stored in `generation_error_logs`.
  - Only error code (eg. error: `upstream_error`) and general error message (eg. message: "Upstream AI provider error") are exposed in responses.

- **Denial of Service Protection**
  - Enforce strict maximum `source_text` length.
  - Configure a reasonable timeout for OpenRouter calls.

## 7. Error Handling

- **Validation Errors (400)**
  - Detected by Zod schema and additional guards.
  - Always try to validate as early as possible. As soon as validation fails, return the response and don't proceed with subsequent processing steps.

- **Authentication Errors (401)**
  - If Supabase user is absent, return `401`.

- **Upstream LLM Errors (502)**
  - Timeout, non-2xx status, or unparsable/invalid response from OpenRouter.
  - Log to `generation_error_logs` with `error_code` and `error_message`.
  - Return `502` with `upstream_error` error code in response.

- **Internal Server Errors (500)**
  - Other errors, e.g. DB insert failures for `generations` or `generation_error_logs`, misconfiguration (e.g. missing API key) or unexpected exceptions.
  - Return generic `internal_error` envelope to client.

## 8. Performance Considerations

- **LLM Call Efficiency**
  - Use concise prompts that still yield high-quality flashcards to minimize token usage and latency.
  - In the prompt specify the maximum number of flashcards to generate and limitations for `front` and `back` length.

- **Timeouts**
  - Configure a sensible timeout for OpenRouter calls to avoid long-running requests.

## 9. Implementation Steps

1. Create endpoint file: `src/pages/api/generations.ts`.

2. Design Zod Schema
   - Create a Zod schema in the API route file for `CreateGenerationCommand`.
   - Ensure length validation matches `[1000, 10000]`.

3. **Implement AI Generation Service**
   - Add `src/lib/services/generation.service.ts`.
   - Implement GenerationService class with service logic. Responsibility:
     - Creating and configuring OpenRouterService instance, using:
       - apiKey: `import.meta.env.OPENROUTER_API_KEY`,
       - model 'openai/gpt-4o-mini' hardcoded in a private readonly class property,
       - timeout: 60 seconds.
     - Building prompt for OpenRouter with clear instructions and expected JSON schema. Prompt should also include the maximum number of flashcards to generate (let's say 10) and limitations for `front` and `back` length according to the schema.
     - Exposing `generateFlashcardProposals({ source_text })` method for generating flashcards propsals. It should:
       - Call OpenRouter HTTP API to get flashcard proposals. IMPORTANT! On this stage we will use mocks instead of calling real OpenRouter API!
       - Measure duration of the call.
       - On success:
         - parse the JSON/text response to `FlashcardProposalDto[]` (poperty `temp_id` needs to be generated for example with `crypto.randomUUID()`),
         - prepare generation metadata and save them into `generations` table. Some details:
           - `source_text_length: number` equals to `source_text.length`.
           - `source_text_hash: string` – SHA-256 hash of `source_text` encoded as hex string for storage in `varchar`.
           - `generation_duration: number` – measured in milliseconds from just before the LLM call to immediately after successful parse.
         - return an object which is in line with CreateGenerationResponseDto type.
       - On error:
         - prepare error data (GenerationErrorLogDto) and save into `generation_error_logs`:
         - throw `OpenRouterError`.

4. **Update API Route**
   - Implement `POST` handler in `src/pages/api/generations.ts`:
     - Extract Supabase client and authenticated user from context.
     - Enforce auth guard.
     - Parse and validate body with Zod.
     - Call generateFlashcardProposals({ source_text }).
     - On success, return `CreateGenerationResponseDto`.
     - On LLM errors, return `502`.
     - On other errors, return `500`.

5. **Documentation**
   - Document endpoint behavior, request/response, and error formats for frontend consumers.
   - Highlight that returned flashcards are proposals only and must be persisted via dedicated flashcards endpoints.
