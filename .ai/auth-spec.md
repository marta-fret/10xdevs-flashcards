# Authentication Architecture Specification

AI Flashcards – detailed architecture for registration, login, logout, password change, and account deletion, aligned with:

- PRD F-01 and US-001–US-005
- UI architecture plan (Authentication, User Panel, Layout & Navigation)
- Tech stack (Astro 5, React 19, TypeScript 5, Tailwind 4, shadcn/ui, Supabase Auth)

The goal is to gate all non-auth views behind authentication without breaking the existing route structure and user journeys for flashcards generation, management, and learning.

---

## 1. User Interface Architecture

### 1.1 High-level Structure

- **Public area**
  - Route: `/login`
  - Layout: `RootPublicLayout.astro`
  - Content: authentication view with `LoginForm` and `SignUpForm`
- **Authenticated area** (guarded)
  - Routes: `/generate`, `/flashcards`, `/learn`, `/user` (and future authenticated views)
  - Layout: `RootAuthenticatedLayout.astro`
  - Guard: server-side AuthGuard pattern (see 3.3) enforced in each authenticated page’s `GET` handler.
  - Shared UI: `TopNavBar`, `GlobalToastZone`, optional `AlertBanner`, main content outlet.

All views remain Astro pages that embed React components where interactivity is required, as per the UI plan.

#### 1.1.1 Layouts and Navigation

- **`src/layouts/RootPublicLayout.astro`**
  - Purpose: Wrap `/login` with a centered container for auth forms.
  - Responsibilities:
    - Render basic shell (logo/title, short description) and a content slot.
    - Optionally display global-level error messages (e.g. system-wide outage) via a slim banner.
  - Auth behavior:
    - `/login` page uses server-side logic to redirect authenticated users to `/generate` (no client-side flicker).

- **`src/layouts/RootAuthenticatedLayout.astro`**
  - Purpose: Shared shell for authenticated pages (`/generate`, `/flashcards`, `/learn`, `/user`).
  - Responsibilities:
    - Render `TopNavBar` with links: Generate, Flashcards, Learn, User Panel, and a Logout button.
    - Provide `MainOutlet` for the active view.
    - Render global feedback zones: `GlobalToastZone` (for success/error toasts) and optional `AlertBanner` for persistent page-level issues.
  - Inputs:
    - Receives current user summary (email, created_at) as props from the Astro page, for display in the nav or user menu.
  - Behavior:
    - Only used after the AuthGuard has already confirmed the user session.

- **`TopNavBar` React component**
  - Location: `src/components/navigation/TopNavBar.tsx`
  - Responsibilities:
    - Render navigation links using shadcn/ui `NavigationMenu` or similar.
    - Visual differentiation of the active route (e.g. `aria-current="page"`).
    - Display a `LogoutButton` (see 1.3.3).
  - Inputs:
    - `currentPath` (string) – for highlighting active nav item.
    - `userEmail` (optional) – for showing logged-in user identity (e.g. in a small label or menu).
  - Behavior:
    - Collapses into a hamburger menu on small screens.
    - The menu content is set `aria-hidden="true"` while any modal/dialog is open (per UI plan).

### 1.2 Authentication View (`/login`)

- **Astro page**: `src/pages/login.astro`
  - Layout: `RootPublicLayout.astro`
  - Server responsibilities:
    - **Auth redirect**: On `GET`, check `context.locals.supabase.auth.getUser()`:
      - If authenticated → redirect to `/generate` (per UI plan step 3).
      - If not → render page.
    - `export const prerender = false;` to ensure the page is always rendered with current auth state.
  - Client responsibilities:
    - Render `LoginForm` and `SignUpForm` React components stacked vertically.

- **`LoginForm` React component**
  - Location: `src/components/auth/LoginForm.tsx`
  - Fields:
    - `email` (type email, required)
    - `password` (type password, required, masked)
  - Responsibilities:
    - Client-side validation:
      - Email is non-empty and matches a basic email pattern.
      - Password is non-empty.
    - Error handling:
      - Inline field error messages (e.g. "Please enter a valid email address").
      - Non-field error area for backend errors (e.g. "Incorrect email or password").
    - Submit behavior:
      - On submit, call `POST /api/auth/login` (see 2.2.1) via `fetch`.
      - Disable submit button and show loading indicator while request is in flight.
      - On success: redirect to `/generate` (using `window.location.assign` to ensure fresh SSR guard evaluations) and optionally trigger a success toast.
      - On `401` or `400` with `INVALID_CREDENTIALS`/`USER_NOT_FOUND`, display appropriate messages.

- **`SignUpForm` React component**
  - Location: `src/components/auth/SignUpForm.tsx`
  - Fields:
    - `email` (type email, required)
    - `password` (type password, required, masked)
    - `repeatPassword` (type password, required, masked)
  - Responsibilities:
    - Client-side validation (mirroring server-side Zod schema):
      - Email: required & valid format.
      - Password: minimum length (e.g. ≥ 8 chars) and optional additional rules (mixed-case, number, etc.).
      - Repeat password: must match `password`.
    - Error handling:
      - Inline field error messages.
      - Non-field error for backend issues (e.g. `EMAIL_ALREADY_REGISTERED`).
      - Helper text describing password rules.
    - Submit behavior:
      - On submit, call `POST /api/auth/signup`.
      - Disable submit button and show loading state.
      - On success: automatically log the user in (via backend), then redirect to `/generate`.
      - On Supabase `UserAlreadyExists`-type errors, show: "This email is already registered. Try logging in instead.".

#### 1.2.1 Validation Cases & Error Messages (Login/Sign-up)

- **Form-level validation cases**:
  - Empty fields → "This field is required".
  - Invalid email format → "Enter a valid email address".
  - Password too short → "Password must be at least 8 characters" (configurable rule).
  - Repeat password mismatch → "Passwords do not match".
- **Backend error mapping**:
  - `INVALID_CREDENTIALS` or Supabase `Invalid login credentials` → "Incorrect email or password".
  - `EMAIL_ALREADY_REGISTERED` → "This email is already registered".
  - `RATE_LIMITED` or generic 429 → "Too many attempts. Please try again later.".
  - Unexpected 5xx → "Something went wrong on our side. Please try again.".

### 1.3 User Panel View (`/user`)

- **Astro page**: `src/pages/user.astro`
  - Layout: `RootAuthenticatedLayout.astro`
  - Server responsibilities:
    - Enforce AuthGuard (redirect unauthenticated to `/login`).
    - Supply current user info (email, created_at) to the page.
  - Client content sections:
    - Account summary (email, registration date).
    - `PasswordChangeForm` React component.
    - `AccountDeletionSection` React component (with confirmation dialog).
    - Optional `LogoutButton` (or rely on global nav logout).

- **`PasswordChangeForm` React component**
  - Location: `src/components/user/PasswordChangeForm.tsx`
  - Fields:
    - `currentPassword` (type password, required, masked).
    - `newPassword` (type password, required, masked).
    - `repeatNewPassword` (type password, required, masked).
  - Responsibilities:
    - Client-side validation:
      - All fields required.
      - New password satisfies the same password strength rules as registration.
      - New password and repeat match.
    - Error handling:
      - Inline field errors.
      - Top-level message area for backend errors (e.g. current password invalid).
    - Submit behavior:
      - Call `POST /api/auth/change-password`.
      - Disable submit button while pending.
      - On success:
        - Clear form.
        - Show success toast: "Password updated successfully".
      - On Supabase `invalid password` or custom `INVALID_CURRENT_PASSWORD`, show: "Current password is incorrect".

- **`AccountDeletionSection` React component**
  - Location: `src/components/user/AccountDeletionSection.tsx`
  - Elements:
    - Static warning text clearly explaining irreversibility and that flashcards will be deleted (PRD US-005).
    - A primary destructive button `Delete account`.
    - Confirmation dialog (modal) requiring explicit confirmation.
      - Optionally require typing the word `DELETE` or re-entering the account email.
  - Behavior:
    - On clicking `Delete account`, open confirmation dialog.
    - On confirm:
      - Call `POST /api/auth/delete-account`.
      - Disable dialog actions while pending.
      - On success:
        - Backend performs account deletion and logs the user out.
        - Frontend receives success response, clears any local state, then redirects to `/login`.
        - Show success toast on `/login`: "Your account has been deleted. We’re sorry to see you go.".
      - On error:
        - Display error message: generic or more specific (e.g. "We couldn’t delete your account. Please try again or contact support.").

- **`LogoutButton` React component**
  - Location: `src/components/auth/LogoutButton.tsx`
  - Responsibilities:
    - Call `POST /api/auth/logout` on click.
    - Show a brief loading state (spinner on button icon/text).
    - On success:
      - Redirect to `/login`.
    - On error:
      - Show toast: "Failed to log out. Please try again." but still attempt to redirect or clear cookies in backend.

### 1.4 Integration with Other Views

- **Flashcards Generation (`/generate`)**
  - No UI change required apart from being behind AuthGuard.
  - After login/sign-up, successful redirects land here.

- **Flashcards Management (`/flashcards`)** & **Learning Session (`/learn`)**
  - Behavior unchanged, but always assume an authenticated user.
  - All flashcard-related API calls must use the authenticated Supabase user ID instead of a hard-coded default.

### 1.5 Key Scenarios (UI Level)

- **Sign-up success**:
  - New user fills in email + password + repeat.
  - Client validates; POST `/api/auth/signup`.
  - Backend creates user, starts session, returns 201.
  - UI redirects to `/generate` with a welcome toast.

- **Login failure (wrong password)**:
  - POST `/api/auth/login` returns 401 with `INVALID_CREDENTIALS`.
  - `LoginForm` renders inline error above the form.

- **Unauthorized access to `/generate`**:
  - User hits `/generate` without auth cookie.
  - AuthGuard in page `GET` detects missing/invalid session.
  - Redirects to `/login` (HTTP 302). No partial content is rendered.

- **Logout from TopNavBar**:
  - User clicks `Logout`.
  - `LogoutButton` POSTs `/api/auth/logout`.
  - Backend clears Supabase session cookies.
  - Frontend redirects to `/login` and optionally shows a toast.

- **Password change with bad current password**:
  - POST `/api/auth/change-password` returns 400 with `INVALID_CURRENT_PASSWORD`.
  - UI displays inline error and does not clear the form.

- **Account deletion**:
  - User confirms in the dialog.
  - Backend deletes all user-owned data + Supabase user.
  - Session is invalidated.
  - Response indicates success; UI redirects to `/login` with success toast.

---

## 2. Backend Logic

### 2.1 API Endpoint Structure

All endpoints reside under `src/pages/api/auth/` as Astro server routes. They are accessed via `fetch` from the React components.

Shared characteristics:

- HTTP method: `POST` for all mutating operations (login, signup, logout, password change, delete account).
- `export const prerender = false;` to ensure runtime execution and access to cookies.
- Use `context.locals.supabase` (server-side client) for all Supabase interactions.
- Request/response bodies are JSON with a small, consistent envelope:
  - On success: `{ data: <payload> }` or `{ data: null }` for 204-like responses.
  - On error: `{ error: { code: string; message: string; fieldErrors?: Record<string, string> } }`.

#### 2.2.1 `POST /api/auth/signup`

- Input JSON:
  - `{ email: string; password: string; repeatPassword: string }`.
- Validation:
  - Zod schema `SignupCommandSchema` in `src/lib/validation/auth.schemas.ts`.
  - Validate email format, password strength, and password match.
- Behavior:
  - Use `locals.supabase.auth.signUp({ email, password })`.
  - On success:
    - If Supabase returns a session (email/password auth with auto-confirm), session cookies are managed via Supabase helpers.
    - If email confirmation is required and no session is returned (depending on project config), spec can treat this as an extension later; for MVP assume immediate session.
  - Response:
    - `201 Created` with `{ data: { user_id, email } }`.
- Error handling:
  - Email already registered → `409 Conflict`, code `EMAIL_ALREADY_REGISTERED`.
  - Validation errors → `400 Bad Request`, code `VALIDATION_ERROR` plus `fieldErrors`.
  - Supabase or unknown errors → `500 Internal Server Error`, code `INTERNAL_ERROR`.

#### 2.2.2 `POST /api/auth/login`

- Input JSON:
  - `{ email: string; password: string }`.
- Validation:
  - Zod schema `LoginCommandSchema` in `auth.schemas.ts` (simple email & non-empty password).
- Behavior:
  - Call `locals.supabase.auth.signInWithPassword({ email, password })`.
  - On success:
    - Supabase sets session cookies via its SSR helpers (cookie management handled in middleware or helper function).
  - Response:
    - `200 OK` with `{ data: { user_id, email } }`.
- Error handling:
  - Invalid credentials → `401 Unauthorized`, code `INVALID_CREDENTIALS`.
  - Validation issues → `400 Bad Request`, code `VALIDATION_ERROR`.
  - Unknown errors → `500` with generic message.

#### 2.2.3 `POST /api/auth/logout`

- Input: none or empty JSON body.
- Behavior:
  - Use `locals.supabase.auth.signOut()`.
  - Clear auth-related cookies.
- Response:
  - `200 OK` or `204 No Content` with `{ data: null }`.
- Error handling:
  - If sign-out fails, still attempt to clear cookies; return `200` with warning message, or `500` if fully failed.

#### 2.2.4 `POST /api/auth/change-password`

- Input JSON:
  - `{ currentPassword: string; newPassword: string; repeatNewPassword: string }`.
- Validation:
  - Zod schema `ChangePasswordCommandSchema` in `auth.schemas.ts`.
  - New password must meet same rules as in signup.
- Behavior:
  - Authenticate the user with `locals.supabase.auth.getUser()`; if no user → `401`.
  - To validate current password:
    - Option A: re-authenticate with `signInWithPassword` using current email + current password.
    - On success, call `auth.updateUser({ password: newPassword })`.
  - Response:
    - `200 OK` with `{ data: null }`.
- Error handling:
  - Current password invalid → `400 Bad Request` with code `INVALID_CURRENT_PASSWORD`.
  - Validation errors → `400` with `VALIDATION_ERROR`.
  - Auth missing → `401` with `UNAUTHENTICATED`.
  - Unknown errors → `500` with generic message.

#### 2.2.5 `POST /api/auth/delete-account`

- Input JSON:
  - For MVP, simple confirmation: `{ confirm: string }` (e.g. must equal `DELETE`).
  - Alternatively an empty body if confirmation handled all on client side – but schema is prepared to support a confirmation token.
- Validation:
  - Zod schema `DeleteAccountCommandSchema` in `auth.schemas.ts` (ensures `confirm === "DELETE"`, if used).
- Behavior:
  - Get current user via `locals.supabase.auth.getUser()`.
  - If no user → `401`.
  - Within a DB transaction (Supabase/Postgres):
    - Delete all user-owned flashcards and related data (generations, logs, learning history, etc.), respecting DB schema.
  - Delete the Supabase Auth user.
  - Call `auth.signOut()` to invalidate session.
- Response:
  - `200 OK` with `{ data: null }`.
- Error handling:
  - `401` if not authenticated.
  - `400` if confirmation invalid.
  - `500` on DB errors.

### 2.3 Data Models and Types

- **Shared auth DTOs / commands** (TypeScript interfaces):
  - Location: `src/types.ts` or `src/lib/validation/auth.types.ts` (keeping consistency with existing type organization).
  - Types:
    - `SignupCommand`, `LoginCommand`, `ChangePasswordCommand`, `DeleteAccountCommand`.
    - `AuthSuccessResponse` (user id, email) and `ApiError` (code, message, fieldErrors?).
- **Supabase client type**:
  - Continue using `SupabaseClient` type exported from `src/db/supabase.client.ts` as the canonical type for both client and server flavors.

### 2.4 Input Validation Mechanism

- **Zod-based validation** (backend):
  - All auth API routes import schemas from `src/lib/validation/auth.schemas.ts`.
  - Pattern:
    - Parse and validate `await request.json()`.
    - On `ZodError`, respond with `400` and include `fieldErrors` keyed by field name.
- **Client-side mirroring**:
  - React forms use equivalent schemas or a simplified validation layer to provide immediate feedback.
  - Server remains the single source of truth; client validation is an optimization.

### 2.5 Exception Handling

- Centralized error utilities in `src/lib/utils.ts` or `src/lib/services/error.service.ts`:
  - Map Supabase error codes/messages to internal `ApiErrorCode` enum.
  - Format Astro `Response` objects with consistent JSON structure.
- Each endpoint:
  - Wrap Supabase calls in `try/catch`.
  - Log technical error details to server logs.
  - Return user-friendly error messages without leaking sensitive details.

### 2.6 Server-side Rendering & Routing

- **Astro config**:
  - `astro.config.mjs` already uses `output: "server"` and Node adapter in standalone mode – compatible with SSR and cookie-based auth.
- **Page-level SSR rules**:
  - `/login` and all authenticated pages use SSR and must not be statically prerendered.
    - Explicitly set `export const prerender = false;` where needed.
  - AuthGuard logic is implemented in the `GET` handlers for pages:
    - If unauthenticated & page is protected → redirect to `/login`.
    - If authenticated & page is `/login` → redirect to `/generate`.

---

## 3. Authentication System (Supabase + Astro)

### 3.1 Supabase Auth Overview

- Supabase provides email/password authentication and session management via JWT cookies.
- The app uses:
  - Client-side Supabase for potential future UI features (not required for MVP auth flows).
  - Server-side Supabase client wired into `context.locals` via Astro middleware.

### 3.2 Astro Middleware and Locals

- File: `src/middleware/index.ts` (as per project structure guidelines).
- Responsibilities:
  - Initialize a **server-side Supabase client** per request using the incoming cookies and `SUPABASE_URL` + `SUPABASE_KEY`/service key.
  - Attach it to `context.locals.supabase` (typed as `SupabaseClient`).
  - Ensure that any session changes (login, logout, refresh) are reflected by updating response cookies.
- All Astro routes and API endpoints use `context.locals.supabase` instead of importing `supabaseClient` directly.

### 3.3 AuthGuard Pattern

- Implemented as reusable server-side helpers, not a client-only guard.
- Helper functions (e.g., in `src/lib/services/auth.service.ts`):
  - `requireUser(context)`:
    - Uses `context.locals.supabase.auth.getUser()`.
    - If no user → returns a redirect `Response` to `/login`.
    - If user exists → returns the user object.
  - `redirectIfAuthenticated(context)` (for `/login`):
    - If user exists → redirect to `/generate`.
- Usage in pages:
  - In `/generate`, `/flashcards`, `/learn`, `/user` `GET` handlers:
    - Call `requireUser(context)`; if it returns a redirect, return that; otherwise pass user to the page.
  - In `/login` `GET` handler:
    - Call `redirectIfAuthenticated(context)`; if redirect present, return; else render login page.

### 3.4 Session Management

- **Login and sign-up**:
  - Supabase’s `signInWithPassword`/`signUp` return a `session` object.
  - The server-side client and middleware cooperate to set/refresh auth cookies.
- **Logout**:
  - `auth.signOut()` invalidates the session and ensures cookies are cleared.
- **Session refresh**:
  - Supabase’s built-in token refresh ensures long-lived sessions.
  - Middleware must be configured to update cookies on refresh as needed.

### 3.5 Integration with Existing Features

- **Flashcards generation, management, learning**:
  - Whenever flashcard or generation data is persisted, queries must filter by `user_id = currentUser.id`.
  - Existing usage of a hardcoded `DEFAULT_USER_ID` is treated as a development placeholder; the production path will always derive `user_id` from Supabase Auth.
- **GDPR compliance (F-01)**:
  - Account deletion endpoint deletes all personal data and learning data owned by the user.
  - Because Supabase stores user profiles and Auth users, both must be removed.
  - Optional future enhancement: add an endpoint for exporting user data before deletion.

### 3.6 Security Considerations

- **Transport**:
  - Assume HTTPS in production so auth cookies are secure.
- **Cookies**:
  - Use `Secure`, `HttpOnly`, and `SameSite` settings appropriate for the deployment environment.
- **Password handling**:
  - Plain passwords are never stored or logged.
  - Supabase handles hashing and storage.
- **Rate limiting** (future enhancement):
  - Add basic rate limiting on `/api/auth/login` and `/api/auth/signup` to mitigate brute force attacks.

---

## 4. Summary of Contracts

### 4.1 Frontend → Backend Contracts

- `POST /api/auth/signup`
  - Request: `{ email, password, repeatPassword }`.
  - Responses:
    - `201`: `{ data: { user_id, email } }`.
    - `400`: `{ error: { code: "VALIDATION_ERROR", fieldErrors, message } }`.
    - `409`: `{ error: { code: "EMAIL_ALREADY_REGISTERED", message } }`.

- `POST /api/auth/login`
  - Request: `{ email, password }`.
  - Responses:
    - `200`: `{ data: { user_id, email } }`.
    - `400`/`401`: `{ error: { code: "INVALID_CREDENTIALS" | "VALIDATION_ERROR", message } }`.

- `POST /api/auth/logout`
  - Request: `{}` (or empty).
  - Responses:
    - `200`/`204`: `{ data: null }`.

- `POST /api/auth/change-password`
  - Request: `{ currentPassword, newPassword, repeatNewPassword }`.
  - Responses:
    - `200`: `{ data: null }`.
    - `400`: codes `VALIDATION_ERROR` or `INVALID_CURRENT_PASSWORD`.
    - `401`: `UNAUTHENTICATED`.

- `POST /api/auth/delete-account`
  - Request: `{ confirm: string }` (e.g. `"DELETE"`).
  - Responses:
    - `200`: `{ data: null }`.
    - `400`: `VALIDATION_ERROR`.
    - `401`: `UNAUTHENTICATED`.

### 4.2 Page-level Behavior Summary

- `/login` (public):
  - Authenticated user → 302 to `/generate`.
  - Unauthenticated → render login & sign-up forms.
- `/generate`, `/flashcards`, `/learn`, `/user` (protected):
  - Unauthenticated → 302 to `/login`.
  - Authenticated → render respective views inside `RootAuthenticatedLayout`.

This specification provides the contracts and structure needed to implement a robust, Supabase-backed authentication system without breaking the existing flashcard generation, management, and learning flows.
