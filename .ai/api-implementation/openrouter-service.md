# OpenRouter Service Implementation Guide

## 1. Service description

The **OpenRouter service** is a backend-only TypeScript service responsible for interacting with the OpenRouter API to perform LLM-based chats. It provides a clear, typed abstraction over the HTTP API, including:

- **Request construction** (system/user messages, response_format JSON schemas, model selection, model parameters).
- **Execution** via `fetch`.
- **Response handling** (parsing, optional JSON schema validation, normalization).
- **Error handling** with typed errors and safe logging.

In this project, the service should live in:

- `src/lib/services/openrouter.service.ts` (implementation)
- `src/lib/services/openrouter.types.ts` (OpenRouter-specific types)

The service will be used in **GenerationService**.

## 2. Constructor description

### 2.1. Class name and purpose

- **Class**: `OpenRouterService`
- **Purpose**: Encapsulate all interaction with OpenRouter chat/completions endpoint(s), providing a stable API for the rest of the app.

### 2.2. Constructor signature (conceptual)

The constructor should accept a configuration object rather than directly reading environment variables. This keeps the class testable and independent of Astro globals.

- **Constructor (TypeScript interface)**
  - `constructor(config: OpenRouterServiceConfig)`

- **`OpenRouterServiceConfig` fields**
  1. `apiKey: string`  
     OpenRouter API key (must be non-empty server-side).
  2. `apiUrl?: string`  
     Optional base URL for the API (default: `"https://openrouter.ai/api"`).
  3. `model: string`  
     Initial model name for this instance, e.g. `"openai/gpt-4.1"`.
  4. `modelParams: OpenRouterModelParams`  
     Initial model parameters for this instance (e.g. temperature).
  5. `timeoutMs?: number`  
     Request timeout in milliseconds (e.g. 30_000).

- **Instantiation**
  Service will be instantiated and used in **GenerationService**. `apiKey` needed to be passed to the constructor will be read from `OPENROUTER_API_KEY` from `import.meta.env`.

## 3. Public methods and fields

Design the public API to be minimal but expressive and aligned with how you will use LLMs in the app.

### 3.1. Public fields

1. **`model: string`**
   - Exposed as read-only (getter) so other parts of the system know which model is currently configured for this instance.

2. **`modelParams: OpenRouterModelParams`**
   - Exposed as read-only (getter) describing the current model parameters configured for this instance.

### 3.3. Public methods

1. **`chat(options: OpenRouterChatOptions): Promise<OpenRouterChatResult>`**
   - Main entry point for single-response, non-streaming chat.
   - Responsibilities:
     1. Validate `options` (presence of non-empty `userMessage`).
     2. Build the OpenRouter-compatible messages array using the instance-level system message (if set) and the provided `userMessage`.
     3. Construct request payload, including model, parameters and `response_format` from the instance-level setting.
     4. Perform HTTP request using `fetch` with timeout.
     5. Handle HTTP status codes and error payloads.
     6. Extract text output and, if `response_format` is JSON schema, parse JSON.

2. **`setSystemMessage(systemMessage: string | null): void`**
   - Sets or clears the system message used for all subsequent `chat()` calls on this instance.
   - Passing `null` clears the system message so only user messages are sent.

3. **`setResponseFormat(responseFormat: OpenRouterResponseFormat | null): void`**
   - Sets or clears the `response_format` used for all subsequent `chat()` calls on this instance.
   - Passing `null` disables structured JSON responses so the raw text is returned.

4. **`configureModel(config: { model?: string; params?: OpenRouterModelParams }): void`**
   - Updates the model and/or model parameters for this instance.
   - If `config.model` is provided, the instance will use that model for all subsequent `chat()` calls.
   - If `config.params` is provided, the instance will use those parameters for all subsequent `chat()` calls.
   - Validation should be performed with Zod to ensure that provided values are well-formed.

## 4. Private methods and fields

Private members are used internally to keep the public API small and maintainable.

### 4.1. Private fields

1. **`#apiKey: string`**
   - Raw API key, never exposed.

2. **`#apiUrl: string`**
   - Base URL for OpenRouter API, defaulting to `"https://openrouter.ai/api"`.

3. **`#timeoutMs: number`**
   - Default request timeout.

4. **`#systemMessage: string | null`**
   - System message applied to all chats for this instance; configured via `setSystemMessage`.

5. **`#responseFormat: OpenRouterResponseFormat | null`**
   - Structured output configuration applied to all chats for this instance; configured via `setResponseFormat`.

6. **`#logger: Logger`**
   - Internal logger instance with minimal methods (e.g. `debug`, `info`, `warn`, `error`) implemented specifically for this service (e.g. thin wrapper over `console`).

7. **`#model: string`**
   - Currently configured model for this instance.

8. **`#modelParams: OpenRouterModelParams`**
   - Currently configured model parameters for this instance.

### 4.2. Private methods

1. **`buildMessages(userMessage: string): OpenRouterChatMessage[]`**
   - **Functionality**:
     1. Start with an empty array.
     2. If `#systemMessage` is set, push `{ role: 'system', content: this.#systemMessage }`.
     3. Push the main user message: `{ role: 'user', content: userMessage }`.
   - **Challenges**:
     1. Ensuring correct order of messages.
     2. Avoiding empty or redundant messages.
   - **Solutions**:
     1. Enforce ordering in code (system → user).
     2. Filter out messages with empty `content` or invalid roles early.

2. **`buildRequestBody(messages: OpenRouterChatMessage[]): unknown`**
   - **Functionality**:
     1. Determine the model from the instance: `this.model`.
     2. Use model params from the instance: `this.modelParams`.
     3. Construct object containing:
        - `model`
        - `messages`
        - model parameters
        - `response_format` if `#responseFormat` is set.
   - **Challenges**:
     1. Matching OpenRouter API fields and allowed parameters.
     2. Avoiding sending undefined/invalid params.
   - **Solutions**:
     1. Whitelist allowed parameter names in `OpenRouterModelParams`.
     2. Explicitly omit `undefined` values when building the payload.

3. **`callApi(body: unknown, abortController?: AbortController): Promise<unknown>`**
   - **Functionality**:
     1. Serialize `body` as JSON.
     2. Issue a POST request to `"/chat/completions"` or the relevant OpenRouter endpoint.
     3. Set headers:
        - `Authorization: Bearer <apiKey>`
        - `Content-Type: application/json`
        - Any OpenRouter-required headers.
     4. Enforce timeout using the provided `abortController` (if any) or an internally created `AbortController` when none is provided.
   - **Challenges**:
     1. Handling timeouts and aborts carefully.
     2. Distinguishing between network errors, timeouts, and HTTP error statuses.
   - **Solutions**:
     1. Wrap `fetch` in a timeout helper.
     2. Normalize errors into `OpenRouterServiceError` with appropriate codes.

4. **`parseChatResponse(raw: unknown): OpenRouterChatResult`**
   - **Functionality**:
     1. Confirm that `raw` has the expected chat completion structure.
     2. Extract the assistant message text (e.g., `choices[0].message.content`).
     3. Return `OpenRouterChatResult` with `rawText` and `rawResponse`.
   - **Challenges**:
     1. Coping with incomplete or unexpected upstream responses.
   - **Solutions**:
     1. Use safe property access with guards.
     2. Throw `OpenRouterServiceError` with `BAD_RESPONSE` when structure is invalid.

5. **`parseJsonIfNeeded(result: OpenRouterChatResult, responseFormat?: OpenRouterResponseFormat): OpenRouterChatResult`**
   - **Functionality**:
     1. If `responseFormat` is not provided, return result as-is.
     2. If provided, attempt to `JSON.parse(result.rawText)`.
     3. If parse succeeds, attach parsed object to `parsedJson`.
   - **Challenges**:
     1. Models sometimes return trailing commas or extra text around JSON.
   - **Solutions**:
     1. Instruct the model strictly in the prompt to return **only** JSON.
     2. Optionally add pre/post-trimming heuristics, but keep them minimal.

## 5 Types (in file: openrouter.types.ts)

1. **`OpenRouterMessageRole`**
   - Union type: `'system' | 'user' | 'assistant'` (extend if needed for tools).

2. **`OpenRouterChatMessage`**
   - Shape compatible with OpenRouter chat messages:
     - `role: OpenRouterMessageRole`
     - `content: string`

3. **`OpenRouterResponseFormat`**
   - Representation of the `response_format` field for structured outputs:
     - `{ type: 'json_schema'; json_schema: { name: string; strict: true; schema: unknown } }`

4. **`OpenRouterModelParams`**
   - Optional model parameters, e.g.:
     - `temperature?: number`
     - `max_tokens?: number`
     - `top_p?: number`
     - `presence_penalty?: number`
     - `frequency_penalty?: number`
     - Keep it minimal for now.

5. **`OpenRouterChatOptions`**
   - Input to `chat()` method:
     1. `userMessage: string`
     2. `abortController?: AbortController`

6. **`OpenRouterChatResult`**
   - Normalized response from `chat()`:
     1. `rawText: string`
     2. `rawResponse: unknown` (full JSON for debugging)
     3. `parsedJson?: unknown` (if using `response_format` and JSON parse succeeds).

7. **`OpenRouterServiceError`**
   - Custom error class with fields:
     1. `code: OpenRouterErrorCode`
     2. `message: string`
     3. `status?: number`
     4. `details?: unknown`.

8. **`OpenRouterErrorCode`**
   - Error code union, e.g.:
     - `'CONFIG_ERROR' | 'VALIDATION_ERROR' | 'AUTH_ERROR' | 'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'BAD_RESPONSE' | 'UPSTREAM_ERROR' | 'UNKNOWN'`.

9. **`OpenRouterServiceConfig`**
   - Configuration object used to construct `OpenRouterService`:
     1. `apiKey: string` – required OpenRouter API key.
     2. `apiUrl?: string` – optional base URL for the API (defaults to `"https://openrouter.ai/api"`).
     3. `model: string` – required initial model name for this instance, e.g. `"openai/gpt-4.1"`.
     4. `modelParams: OpenRouterModelParams` – required initial model parameters for this instance (e.g. `{ temperature: 0.2 }`).
     5. `timeoutMs?: number` – optional request timeout in milliseconds.

10. **`Logger`**
    - Interface describing the internal logger used by `OpenRouterService`:
      1. `debug(message: string, meta?: unknown): void`
      2. `info(message: string, meta?: unknown): void`
      3. `warn(message: string, meta?: unknown): void`
      4. `error(message: string, meta?: unknown): void`

## 6. Error handling

### 6.1. Error scenarios (numbered)

1. **Configuration errors**
   - Missing/empty `apiKey`, `model`, `modelParams` when constructing the service.

2. **Input validation errors**
   - Empty or missing `userMessage`.
   - Invalid `responseFormat` (e.g. missing `json_schema.name`).

3. **Authentication errors**
   - Invalid or revoked API key (HTTP 401/403).

4. **Rate limiting**
   - Too many requests (HTTP 429).

5. **Timeouts**
   - OpenRouter not responding within `timeoutMs`.

6. **Network errors**
   - DNS issues, connection resets, etc.

7. **Upstream HTTP errors**
   - 4xx/5xx responses with an error payload from OpenRouter.

8. **Malformed responses**
   - Missing expected fields in the chat completion JSON.

9. **JSON parse errors**
   - `response_format` indicates JSON, but the model returns invalid JSON.

10. **Schema validation errors (optional)**
    - Parsed JSON does not conform to the expected Zod schema.

### 6.2. Handling strategy

For each scenario:

1. **Configuration errors → `CONFIG_ERROR`**
   - Throw `OpenRouterServiceError` at construction time: if required fields are missing or empty or if data types of fields are invalid.

2. **Input validation errors → `VALIDATION_ERROR`**
   - Validate public methods parameters at the start of the method.
   - Throw `OpenRouterServiceError` with a human-readable message.

3. **Authentication errors → `AUTH_ERROR`**
   - On HTTP 401/403, throw `OpenRouterServiceError` with `status`, `code`, and upstream error body.

4. **Rate limiting → `RATE_LIMITED`**
   - On HTTP 429, throw `OpenRouterServiceError` with retry-after (if provided).

5. **Timeouts → `TIMEOUT`**
   - On `AbortError` or custom timeout, throw `OpenRouterServiceError` with `code: 'TIMEOUT'`.

6. **Network errors → `NETWORK_ERROR`**
   - Wrap any low-level network error into `OpenRouterServiceError` with `details`.

7. **Malformed responses → `BAD_RESPONSE`**
   - If expected fields are missing, throw `OpenRouterServiceError` with `code: 'BAD_RESPONSE'` and log payload.

8. **JSON parse errors → `BAD_RESPONSE`**
   - Attach parse error details; caller can decide whether to fall back to raw text.

9. **Upstream HTTP errors → `UPSTREAM_ERROR`**
   - For errors from OpenRouter not covered above, include `status` and upstream payload.

10. **Schema validation errors → `VALIDATION_ERROR`**
    - If using Zod, transform parse result into a friendly message and throw.

Implement all throws using the `OpenRouterServiceError` custom class so consumers can switch on `code`.

## 7. Security considerations

1. **API key handling**
   - Read `OPENROUTER_API_KEY` only on the server.
   - Never expose it to the client or inject into browser JavaScript.

2. **Environment configuration**
   - Use `import.meta.env` (and Astro’s server-side env mechanisms) to get `OPENROUTER_API_KEY` to be passed to the `OpenRouterService` constructor.

3. **Logging**
   - Never log full prompts or user PII in production logs.
   - Remove API keys from any log output.
   - Log only high-level error codes and minimal metadata.

4. **Rate limiting and abuse**
   - For future: Implement rate limiting in your Astro API route (separate concern) to avoid hitting OpenRouter limits.

5. **Input sanitization**
   - Validate and constrain user inputs before feeding them to the model (e.g. truncate very long prompts).

6. **Timeouts and resource control**
   - Enforce sensible `timeoutMs` and `max_tokens` defaults.

## 8. Step-by-step implementation plan

### 8.1. Define shared types

1. **Add basic OpenRouter types**
   - In a dedicated file such as `src/lib/services/openrouter.types.ts` (or `src/types.ts` if they should be reused across the app), define:
     1. `OpenRouterMessageRole`
     2. `OpenRouterChatMessage`
     3. `OpenRouterResponseFormat`
     4. `OpenRouterModelParams`
     5. `OpenRouterChatOptions`
     6. `OpenRouterChatResult`
     7. `OpenRouterErrorCode`
     8. `Logger` interface (minimal set of methods such as `debug`, `info`, `warn`, `error`).

2. **Define custom error class**
   - Implement `OpenRouterServiceError` extending `Error` with fields `code`, `message`, `status`, `details`.

### 8.2. Implement the `OpenRouterService` class

1. **Constructor**
   - Accept `OpenRouterServiceConfig` and:
     1. Validate with Zod that passed config is valid (non-empty required fields, data types, etc).
     2. Initialize private fields (`#apiKey`, `#apiUrl`, `#timeoutMs`, `#logger`, `#systemMessage`, `#responseFormat`, `#model`, `#modelParams`).

2. **Public getters**
   - Implement `get model()` and `get modelParams()` that return the currently configured model and parameters.

3. **`chat()` method**
   - Steps inside `chat()`:
     1. Validate passed `options` with Zod.
     2. Build messages via `buildMessages(options.userMessage)` using the instance-level system message (if set).
     3. Build request body via `buildRequestBody(messages)` using the instance-level model, parameters, and response format.
     4. Call `callApi(body, options.abortController)`.
     5. Parse response using `parseChatResponse(raw)`.
     6. Call `parseJsonIfNeeded(result)` and return.

4. **`setSystemMessage()` method**
   - Implement `setSystemMessage(systemMessage: string | null)` to:
     1. Validate the provided `systemMessage` with Zod (types).
     2. Assign the value to `#systemMessage` (or `null` to clear it).
     3. Return `void`.

5. **`setResponseFormat()` method**
   - Implement `setResponseFormat(responseFormat: OpenRouterResponseFormat | null)` to:
     1. Validate the basic structure of `responseFormat` with Zod (required `name`, `schema`).
     2. Assign the value to `#responseFormat` (or `null` to clear it).
     3. Return `void`.

6. **`configureModel()` method**
   - Implement `configureModel(config: { model?: string; params?: OpenRouterModelParams })` to:
     1. Validate `config` with Zod (optional `model` as non-empty string, optional `params` object matching `OpenRouterModelParams`).
     2. If `config.model` is provided, update `#model` accordingly.
     3. If `config.params` is provided, update `#modelParams` accordingly.
     4. Return `void`.

7. **Logger implementation**
   - Implement a simple `Logger` class (e.g. `OpenRouterLogger`) in `openrouter.service.ts` or a small utility module that:
     1. Satisfies the `Logger` interface defined in `openrouter.types.ts`.
     2. Delegates to `console` in development (e.g. `console.debug`, `console.error`).
     3. Can be easily adapted later if you introduce a more advanced logging solution.
   - Instantiate this logger inside the `OpenRouterService` constructor and assign it to `#logger`.

### 8.3. Configure system message, user message, response_format, model name, and model parameters

#### 8.3.1. System message

- **Purpose**: Provide high-level instructions or persona to the model.
- **Implementation**:
  1. In the consumer service (e.g. `generation.service.ts`), call `setSystemMessage` on the `OpenRouterService` instance once during initialization or per logical use-case.
  2. `buildMessages()` will automatically include the configured system message for each `chat()` call.

#### 8.3.2. User message

- **Purpose**: Carry the concrete task the model should perform for the current request.
- **Implementation**:
  1. In your HTTP handler (e.g. `GenerationService` entrypoint), extract the main prompt from the incoming payload.
  2. Validate this prompt according to your specific rules but for sure it should be a non-empty string.
  3. Map the validated prompt directly to `userMessage` in `OpenRouterChatOptions` passed to `chat()`.

#### 8.3.3. Structured responses via `response_format` (JSON schema)

- **Purpose**: Enforce that the model responds with a JSON object/array conforming to a schema so the backend can parse and safely use it.

- **Implementation steps**:
  1. Define a JSON schema object that describes the expected structure.
  2. Construct `responseFormat` using the required pattern:  
     `{ type: 'json_schema', json_schema: { name: [schema-name], strict: true, schema: [schema-obj] } }`.
  3. Call `setResponseFormat(responseFormat)` on the `OpenRouterService` instance.
  4. In `chat()`, the configured `response_format` will automatically be included in the request payload.
  5. After receiving the response, `parseJsonIfNeeded` will parse `rawText` as JSON and optionally validate it.

- **Example 3 – Correct `response_format` for flashcards**
  1. **Schema object (conceptual)**:
     - `schema = {`
       - `type: 'object',`
       - `properties: {`
         - `flashcards: {`
           - `type: 'array',`
           - `items: {`
             - `type: 'object',`
             - `properties: {`
               - `question: { type: 'string' },`
               - `answer: { type: 'string' }`
             - `},`
             - `required: ['question', 'answer']`
           - `}`
         - `}`
       - `},`
       - `required: ['flashcards']`
     - `}`

  2. **`response_format` object**:
     - `responseFormat = {`
       - `type: 'json_schema',`
       - `json_schema: {`
         - `name: 'flashcards_response',`
         - `strict: true,`
         - `schema`
       - `}`
     - `}`

  3. **Usage**:
     - `openRouterService.setResponseFormat(responseFormat);`
     - `openRouterService.chat({ userMessage });`

#### 8.3.4. Model name

- **Purpose**: Select the specific model (and provider) to use via OpenRouter.

- **Implementation**:
  1. Pass this value into `OpenRouterService` constructor via `model`.
  2. When you need to adjust the model (e.g. for a different feature or A/B test), call `configureModel({ model: 'anthropic/claude-3.5-sonnet' })` on the existing instance rather than creating a new one, unless you explicitly want separate instances.

#### 8.3.5. Model parameters

- **Purpose**: Control generation behavior (creativity, length, etc.).

- **Implementation**:
  1. Pass this value into `OpenRouterService` constructor via `modelParams`. e.g. `{ temperature: 0.2 }`.
  2. When you need to adjust parameters, call `configureModel({ params: { ... } })` on the existing instance (no per-request override through `chat()` options).
  3. In `buildRequestBody()`, send only supported params and omit `undefined`.

#### 8.4. **Testing** (for the future)

1.  Unit-test `OpenRouterService` by mocking `fetch` (e.g. with a test helper) and asserting on request bodies and error handling.
2.  Add integration tests for the API route using a mocked `OpenRouterService` instance.

This guide defines the structure, methods, error handling, and integration points required to implement a robust OpenRouter service tailored to your Astro + TypeScript stack.
