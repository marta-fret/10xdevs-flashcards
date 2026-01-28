# AI Flashcards – Test Plan

## 1. Introduction and Test Objectives

This document defines the overall test strategy and concrete test activities for the AI Flashcards web application built with Astro, React, TypeScript, Tailwind, shadcn/ui, Supabase, and OpenRouter-based AI generation.

The primary objectives are to:

- **Validate core user journeys**: authentication, AI-based flashcard generation, manual flashcard creation, flashcard management, learning sessions, and account management.
- **Ensure data integrity and security**: especially around authentication, authorization (RLS), personal data, and GDPR-related deletion.
- **Verify robustness of AI integration**: correct handling of validation, rate limiting, and upstream errors when using OpenRouter.
- **Provide confidence for iteration**: through repeatable automated tests (unit, integration, E2E) plus structured exploratory testing.

## 2. Test Scope

### 2.1 In Scope

- **Frontend (Astro + React)**
  - Public views: `Authentication` (`/login`).
  - Authenticated views: `Flashcards Generation` (`/generate`), `Flashcards Management` (`/flashcards`), `Learning Session` (`/learn`), `User Panel` (`/user`).
  - Shared layouts: `RootPublicLayout`, `RootAuthenticatedLayout`, navigation, global toast/feedback, loader overlays, forms, and modals.

- **Backend (Astro API Routes + Supabase)**
  - Auth endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout` (and any additional auth-related routes when implemented).
  - Flashcards endpoints: `GET /flashcards`, `POST /flashcards`, `GET /flashcards/:id`, `PATCH /flashcards/:id`, `DELETE /flashcards/:id`.
  - Generation endpoints: `POST /generations`, `GET /generations`, `GET /generations/:id`, `GET /generation-error-logs`.
  - Middleware (`src/middleware/index.ts`) enforcing authentication and injecting `locals.user` and `locals.supabase`.
  - Supabase integration: DB schema for `flashcards`, `generations`, `generation_error_logs`, and RLS policies.

- **AI integration**
  - Interaction with OpenRouter API via server-side services.
  - Logging to `generations` and `generation_error_logs` tables.

- **Learning module (planned/partially implemented)**
  - Learning session flow, spaced repetition behavior (at least at API and state-machine level).

- **Non-functional aspects**
  - Basic performance (response time, perceived UI responsiveness).
  - Security (authentication, authorization, secret handling, RLS coverage).
  - Accessibility and usability of Shadcn/Tailwind-based UI.

## 3. Test Types and Strategy

### 3.1 Unit Tests

- **Scope**
  - Pure functions and utilities in `src/lib` (e.g., validation helpers, mappers, hash/length calculations for `source_text`).
  - DTO and command model transformations defined in `src/types.ts`.
  - Custom hooks in `src/components/hooks` (e.g., form logic, UI state machines).
  - Simple UI components with logic (e.g., character counters, button enable/disable based on validation).

- **Strategy**
  - Use a TypeScript-compatible test runner: Vitest with React Testing Library for component-level tests.
  - Aim for high coverage of validation rules and branching logic, especially around:
    - `CreateGenerationCommand` validation (length 1,000–10,000).
    - Flashcard field limits (front 200 chars, back 500 chars).
    - Error code mapping to `ApiErrorResponse` types.

### 3.2 API / Integration Tests (Backend)

- **Scope**
  - Astro API routes under `src/pages/api`:
    - Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`.
    - Flashcards: `/flashcards` (CRUD operations).
    - Generations: `/generations`, `/generations/:id`, `/generation-error-logs`.
  - Middleware (`onRequest`) interactions with `locals.supabase` and `locals.user`.
  - Supabase DB operations and RLS behavior.

- **Strategy**
  - Run tests against a Supabase **test project** (or schema) with RLS and sample data.
  - Use a test client (e.g., supertest or direct fetch against a test instance) to call Astro endpoints.
  - For AI calls (OpenRouter), use **mocked/stubbed HTTP clients** to:
    - Simulate successful generations.
    - Simulate upstream errors (timeouts, 4xx, 5xx) and verify error logs in `generation_error_logs`.
  - Verify that:
    - `user_id` is always derived from authenticated context, not request body.
    - RLS rules prevent cross-user access to `flashcards`, `generations`, and `generation_error_logs`.

### 3.3 Component / UI Integration Tests (Frontend)

- **Scope**
  - React components for forms, modals, learning session, proposal lists, flashcards list, etc.

- **Strategy**
  - Use React Testing Library to mount components with mocked network calls (fetch) and context providers.
  - Test combinations of:
    - Form validation (client-side) and error message rendering.
    - Interaction flows (clicks, keyboard navigation, focus management).
    - Global elements: loader overlays, toasts, navigation.

### 3.4 End-to-End (E2E) Tests

- **Scope**
  - Full user journeys from browser to backend and DB.

- **Strategy**
  - Use Playwright, a browser automation tool, running against a deployed test environment.
  - Automate critical happy paths and selected edge/error paths for:
    - Sign up → login → generate flashcards → review → save → manage flashcards → start learning session → logout.
    - Manual flashcard creation, editing, deletion.
    - Account deletion and data removal.

### 3.5 Non-Functional Tests

- **Performance**
  - Measure average response time for key endpoints (`/generations`, `/flashcards`) under typical load.
  - Verify that loader overlays are displayed for long-running actions (generation, save) and that UI stays responsive.

- **Security**
  - Verify authentication guard behavior for authenticated-only routes.
  - Test session expiry, logout, and cookie handling.
  - Spot-check OWASP-style issues (basic XSS, CSRF considerations, input sanitation at API level).

- **Accessibility & Usability**
  - Use automated accessibility scans (e.g., axe) and manual keyboard-only navigation testing.
  - Check ARIA roles, labels, `aria-expanded`, `aria-controls`, and `aria-hidden` on custom UI controls and dialogs.

## 4. Test Scenarios for Key Functionalities

Below are high-level scenarios; each will be elaborated into detailed test cases with preconditions, steps, expected results, and priority.

### 4.1 Authentication (`/login` and middleware)

- **Signup – happy path (High)**
  - New email, valid password, matching repeat password.
  - Auto-login upon success, redirect to `/generate`.

- **Signup – validation errors (High)**
  - Invalid email format, too short password, mismatched passwords.
  - Appropriate inline error messages and prevented submission.

- **Signup – email already registered (High)**
  - Server-side `EMAIL_ALREADY_REGISTERED` error surfaced as a user-friendly message.

- **Login – happy path (High)**
  - Correct credentials, redirect to `/generate`.

- **Login – invalid credentials (High)**
  - `INVALID_CREDENTIALS` error displayed; no session created.

- **Logout (High)**
  - Clicking logout clears session, redirects to `/login`, protected routes become inaccessible.

- **AuthGuard & middleware (Critical)**
  - Unauthenticated access to `/generate`, `/flashcards`, `/learn`, `/user` redirects to `/login`.
  - Authenticated access to `/login` redirects to `/generate`.

### 4.2 AI Flashcards Generation (`/generate`, `POST /generations`, `POST /flashcards`)

- **Valid generation request (Critical)**
  - Source text within 1,000–10,000 characters.
  - `POST /generations` returns proposals, `generation_id`, `generated_count`.
  - UI displays proposals grid; `Generate` button disabled during request.

- **Source text outside allowed range (High)**
  - <1000 characters and >10000 characters both produce client-side validation and/or `400 Bad Request`.
  - UI: character counter shows red; `Generate` button disabled for invalid range.

- **Upstream AI error handling (Critical)**
  - Simulated timeout or 5xx from OpenRouter.
  - Application:
    - Returns appropriate API error code (e.g., `upstream_error` / `service_unavailable`).
    - Logs entry in `generation_error_logs` with correct metadata.
    - Shows clear inline error/toast to the user.

- **Rate limiting behavior (Medium)**
  - Simulate 429 from rate limiter for generation endpoint.
  - Verify `Retry-After` handling and user-facing message.

- **Review and accept/edit/reject (Critical)**
  - Accepting proposals marks them as to-be-saved.
  - Editing opens modal, allows changes, and results in `ai-edited` source when saved.
  - Rejecting hides proposal from save set.

- **Saving accepted / all proposals (Critical)**
  - `Save accepted` sends correct payload to `POST /flashcards` with `generation_id` and appropriate `source` values.
  - `Save all` includes all non-rejected proposals.
  - On success, redirect to `/flashcards`; new flashcards visible and consistent with proposals.

- **Error on saving flashcards (High)**
  - Simulate API error (e.g., DB failure, validation error) and verify UI handles it with toasts and without duplicating saves.

### 4.3 Manual Flashcard Creation and Management (`/flashcards`, flashcards endpoints)

- **View flashcards list – empty & non-empty (High)**
  - Initially empty state message.
  - Non-empty state with correct card data for logged-in user only.

- **Pagination (Medium)**
  - `page` and `limit` parameters respected.
  - Navigation between pages; boundaries (first/last page).

- **Search (High)**
  - Search input filters by `front` and `back` fields using `q` parameter.
  - Empty search resets list.

- **Manual creation – happy path (High)**
  - Create flashcard via modal, respecting length limits.
  - New card visible in list; `source = manual`.

- **Manual creation – validation errors (High)**
  - Front or back exceeding allowed length; empty fields.
  - Client and server validation; friendly messages.

- **Edit flashcard (High)**
  - Modal pre-populated with current content.
  - Saving updates DB and UI; if `source` was `ai-full`, ensure it becomes `ai-edited`.

- **Delete flashcard with confirmation (High)**
  - Delete dialog; cancel preserves card, confirm removes it.
  - Verify card no longer accessible via list or `GET /flashcards/:id`.

- **Authorization and RLS (Critical)**
  - Attempt to access another user's flashcard by ID or list; must not be visible (404 due to RLS).

### 4.4 Learning Module (`/learn`)

- **Start learning session (High)**
  - With sufficient flashcards: navigates to `/learn` and loads first card.
  - With no flashcards: displays appropriate message.

- **Reveal answer flow (High)**
  - Front shown initially; `Reveal` button toggles view to show back.
  - Keyboard accessibility (Enter/Space) for reveal.

- **Self-assessment (High)**
  - After reveal, self-assessment buttons appear.
  - Feedback sent to spaced repetition algorithm; next card selection obeys algorithm rules (at least at a basic level).

- **Session interruption (Medium)**
  - Navigating away or closing tab mid-session; confirm prompt or `beforeunload` handling where configured.

### 4.5 User Panel (`/user` – account and password management)

- **Password change (High)**
  - Valid current password, valid new password, matching confirmation.
  - Session behavior after change (remain logged in or re-authenticate based on design).

- **Password change – error paths (High)**
  - Incorrect current password, weak new password, mismatched confirmation.
  - Appropriate error messages, no change in credentials.

- **Account deletion – happy path (Critical)**
  - Confirm irreversible deletion; user logged out and redirected to `/login`.
  - All user data (flashcards, generations, generation_error_logs) removed or anonymized per GDPR-compliant behavior.

- **Account deletion – error paths (High)**
  - Server error while deleting; user remains informed, no partial deletion.

### 4.6 Navigation, Layout, and Global Feedback

- **Top navigation and layout (High)**
  - Links correctly route to `/generate`, `/flashcards`, `/learn`, `/user`.
  - Active link indication (`aria-current` where appropriate).

- **Global toast and loader overlay (High)**
  - Toasts used for async operations success/failure (auth, generation, saving, deletion).
  - Loader overlays block interaction during critical operations but remain accessible.

- **Responsive design (Medium)**
  - Key views render correctly on common viewport sizes (mobile, tablet, desktop).

### 4.7 Analytics & Logging

- **Generations listing (Medium)**
  - `GET /generations` returns correct `PaginationMetaDto` and items with accurate counts.

- **Generation details (Medium)**
  - `GET /generations/:id` returns associated `GenerationFlashcardDto` items with `source` in `ai-full`/`ai-edited` and non-null `generation_id`.

- **Error logs (Medium)**
  - `GET /generation-error-logs` returns logs limited to the authenticated user or admin as designed.

## 5. Test Environment

- **Application environment**
  - Astro app running in a dedicated **test** environment (staging URL or local environment) with:
    - Separate Supabase project/schema for test data.
    - Test OpenRouter API key with constrained rate limits.
    - Environment variables configured via `.env` or platform-specific settings.
    - Docker and Docker Compose configuration to spin up the application and its dependencies (e.g., Supabase test instance, mock services) for a fully reproducible local and CI test environment.

- **Databases**
  - Test database seeded with:
    - At least two user accounts (standard, admin/analytics if applicable).
    - Sample flashcards, generations, and error logs.
  - RLS and constraints enabled as in production.

- **Browsers**
  - Primary: latest Chrome.
  - Secondary: latest Firefox, Safari (Mac), Edge.
  - Mobile viewport testing via responsive tools and at least one mobile browser.

- **Test data management**
  - Use fixtures and deterministic seeding for repeatable tests.
  - Regular cleanup/reset between test runs (especially for E2E).

## 6. Test Tools

- **Unit and integration tests**
  - TypeScript-enabled test runner: Vitest.
  - React Testing Library for component tests.

- **API testing**
  - HTTP client tools: Postman/Insomnia for ad-hoc testing.
  - Automated API tests using supertest or similar library.

- **E2E testing**
  - Playwright for browser automation.

- **Static analysis & quality**
  - ESLint (already configured) and TypeScript compiler as part of CI.
  - GitHub Actions workflows that run unit and integration test suites on every pull/merge request, and at least a smoke subset of E2E tests on the main branch or on a nightly schedule.

- **Mocking and stubbing**
  - MSW (Mock Service Worker) for mocking HTTP API calls in unit, integration, and component tests (browser and Node environments).
  - Nock (or a similar HTTP mocking library) for mocking outbound HTTP calls from backend services (e.g., OpenRouter) in Node-based tests.
  - Vitest’s built-in mocking utilities (`vi.mock`, `vi.fn`, `vi.spyOn`) for module- and function-level mocking.

- **Accessibility**
  - axe-core (browser extension or integration in E2E tests).

## 7. Test Schedule

The schedule is indicative and should adapt to implementation progress.

- **Phase 1 – Foundation (before feature freeze)**
  - Set up test frameworks (unit, API, E2E) and test environment.
  - Implement smoke tests for app startup, middleware, and basic navigation.

- **Phase 2 – Core features (Authentication, Generation, Flashcards Management)**
  - Develop unit and API tests for auth and flashcards/generations endpoints.
  - Implement UI integration tests for `/login`, `/generate`, `/flashcards`.
  - Create E2E flows for sign up, login, generation, saving, and management.

- **Phase 3 – Learning Module and User Panel**
  - Add tests for learning session, spaced repetition behavior, and user panel (password change, deletion).
  - Extend E2E coverage for learning sessions and account deletion.

- **Phase 4 – Non-functional & Regression**
  - Run performance, security, and accessibility checks.
  - Establish regression test suite to run on each release candidate.

## 8. Test Acceptance Criteria

- **Functional coverage**
  - 100% of critical paths (authentication, AI generation, save flashcards, learning session start, account deletion) covered by automated tests.
  - 90% of high-priority scenarios covered by automated or documented manual tests.

- **Quality thresholds**
  - Zero open **Critical** or **High** severity defects before production release.
  - All Medium/Low defects reviewed and either fixed or accepted with documented rationale.

- **Stability and performance**
  - No test flakiness in CI across multiple runs.
  - Key endpoints respond within acceptable limits under typical load (exact SLAs to be defined by the team).

- **Security and compliance**
  - RLS rules verified to prevent cross-user data leaks.
  - Account deletion confirmed to remove or anonymize personal data and flashcards.

## 9. Roles and Responsibilities

- **QA Engineer**
  - Owns this test plan and keeps it updated.
  - Designs test cases, maintains automated test suites, and coordinates manual exploratory testing.

- **Backend Developers**
  - Implement and maintain unit/integration tests for API routes and services.
  - Ensure Supabase schema and RLS are testable and documented.

- **Frontend Developers**
  - Implement unit and component tests for UI logic and hooks.
  - Assist with E2E test maintenance.

- **Product Owner / Project Lead**
  - Prioritizes defects and clarifies acceptance criteria.
  - Signs off on readiness for release based on test reports.

- **DevOps / Platform Engineer (if applicable)**
  - Maintains CI/CD pipelines, test environments, and secrets.

## 10. Defect Reporting and Tracking

- **Defect tracking tool**
  - All defects logged in a centralized issue tracker (e.g., GitHub Issues) linked to the repository.

- **Required defect fields**
  - Title and short summary.
  - Environment (dev/staging/prod), app version/commit hash.
  - Steps to reproduce.
  - Expected vs actual results.
  - Screenshots, logs, or HAR files where relevant.
  - Severity (Critical, High, Medium, Low) and priority.
  - Related user story/requirement ID (e.g., US-006, F-02).

- **Severity guidelines**
  - **Critical**: Data loss, security vulnerability, or complete blocker for key user journeys.
  - **High**: Major functional error without simple workaround.
  - **Medium**: Functional issue with acceptable workaround or minor impact.
  - **Low**: Cosmetic issues or minor UX discrepancies.

- **Triage and resolution process**
  - Regular triage sessions including QA, dev, and product owner.
  - Target resolution times based on severity (e.g., Critical within 24–48h on working days).
  - Retesting and closure only after verifying fixes in the appropriate environment.
