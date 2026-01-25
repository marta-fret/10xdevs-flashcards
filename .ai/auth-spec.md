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
  - Shared UI: `TopNavBar`, `GlobalToastZone`, main content outlet.

All views remain Astro pages that embed React components where interactivity is required, as per the UI plan.

#### 1.1.1 Layouts and Navigation

- **`src/layouts/RootPublicLayout.astro`**
  - Purpose: Wrap `/login` with a centered container for auth forms.
  - Responsibilities:
    - Render basic shell (logo/title, short description) and a content slot.
    - Optionally display global-level error messages (e.g. system-wide outage) via a toast.
  - Auth behavior:
    - `/login` page uses server-side logic to redirect authenticated users to `/generate` (no client-side flicker).

- **`src/layouts/RootAuthenticatedLayout.astro`**
  - Purpose: Shared shell for authenticated pages (`/generate`, `/flashcards`, `/learn`, `/user`).
  - Responsibilities:
    - Render `TopNavBar` with links: Generate, Flashcards, Learn, User Panel, and a Logout button.
    - Provide `MainOutlet` for the active view.
    - Render global feedback zones: `GlobalToastZone` (for success/error toasts) for persistent page-level issues.
  - Inputs:
    - Receives current user data via prop from the Astro page (data taken from Astro.locals), for display in the nav or user menu.
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
      - For backend errors (e.g. "Incorrect email or password") use global feedback zones to show a toast.
    - Submit behavior:
      - On submit, call `POST /api/auth/login` (see 2.2.1) via `fetch`.
      - Disable submit button and show LoadingOverlay while request is in flight.
      - On success: redirect to `/generate` (using `window.location.assign` to ensure fresh SSR guard evaluations).
      - On `401` with `INVALID_CREDENTIALS`, display appropriate message.

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
      - Inline field error messages for frontend validation.
      - For backend issues (e.g. `EMAIL_ALREADY_REGISTERED`) use global feedback zones to show a toast.
      - Helper text describing password rules.
    - Submit behavior:
      - On submit, call `POST /api/auth/signup`.
      - Disable submit button and show LoadingOverlay while request is in flight.
      - On success: automatically log the user in (via backend), then redirect to `/generate`.
      - On Supabase `UserAlreadyExists`-type errors, show: "This email is already registered. Try logging in instead.".

#### 1.2.1 Validation Cases & Error Messages (Login/Sign-up)

- **Form-level validation cases**:
  - Empty fields → "This field is required".
  - Invalid email format → "Enter a valid email address".
  - Password too short → "Password must be at least 8 characters" (configurable rule).
  - Repeat password mismatch → "Passwords do not match".
- **Backend error mapping**:
  - `INVALID_CREDENTIALS` or Supabase `Invalid login credentials` → "Incorrect credentials".
  - `EMAIL_ALREADY_REGISTERED` → "This email is already registered".
  - Unexpected 5xx → "Something went wrong on our side. Please try again.".

### 1.3 User Panel View (`/user`)

- **Astro page**: `src/pages/user.astro`
  - Layout: `RootAuthenticatedLayout.astro`
  - Server responsibilities:
    - Enforce AuthGuard (redirect unauthenticated to `/login`).
    - Supply current user to the page (from Astro.locals).
  - Client content sections:
    - Account summary (email, registration date).
    - `PasswordChangeForm` React component.
    - `AccountDeletionSection` React component (with confirmation dialog).
    - `LogoutButton` .

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
      - Inline field for frontend validation errors.
      - For backend errors (e.g. current password invalid) use global feedback zones to show a toast.
    - Submit behavior:
      - Call `POST /api/auth/change-password`.
      - Disable submit button and show LoadingOverlay while pending.
      - On success:
        - Clear form.
        - Show success toast: "Password updated successfully".
      - On `INVALID_CURRENT_PASSWORD`, show: "Current password is incorrect".
      - On `VALIDATION_ERROR`, show: "Invalid form data".

- **`AccountDeletionSection` React component**
  - Location: `src/components/user/AccountDeletionSection.tsx`
  - Elements:
    - Static warning text clearly explaining irreversibility and that flashcards will be deleted (PRD US-005).
    - A primary destructive button `Delete account`.
    - Confirmation dialog (modal) requiring explicit confirmation.
  - Behavior:
    - On clicking `Delete account`, open confirmation dialog.
    - On confirm:
      - Call `POST /api/auth/delete-account`.
      - While pending disable dialog actions and show a loader on confirmation button.
      - On success:
        - Backend performs account deletion and logs the user out.
        - Frontend receives success response, clears any local state, then redirects to `/login`.
        - Show success toast on `/login`: "Your account has been deleted. But you can always create a new one :-D".
      - On error:
        - Display error message: generic, e.g. "We couldn’t delete your account. Please try again or contact support.".

- **`LogoutButton` React component**
  - Location: `src/components/auth/LogoutButton.tsx`
  - Responsibilities:
    - Call `POST /api/auth/logout` on click.
    - Disable button and show LoadingOverlay while request is in flight.
    - On success:
      - Redirect to `/login`.
    - On error:
      - Show toast: "Failed to log out. Please try again." .

### 1.4 Integration with Other Views

- **Flashcards Generation (`/generate`)**, **Flashcards Management (`/flashcards`)**, **Learning Session (`/learn`)**
  - Must be protected by AuthGuard, needs to use `RootAuthenticatedLayout.astro`.
  - All API calls must use the authenticated Supabase user ID instead of a hard-coded default.

### 1.5 Key Scenarios (UI Level)

- **Sign-up success**:
  - New user fills in email + password + repeat.
  - Client validates; POST `/api/auth/signup`.
  - Backend creates user, starts session, returns 201.
  - UI redirects to `/generate`.

- **Login failure (wrong password)**:
  - POST `/api/auth/login` returns 401 with `INVALID_CREDENTIALS`.
  - `LoginForm` renders an appropriate global toast.

- **Unauthorized access to `/generate`**:
  - User hits `/generate` without being authenticated.
  - AuthGuard in page `GET` detects missing/invalid session.
  - Redirects to `/login` (HTTP 302). No partial content is rendered.

- **Logout from TopNavBar**:
  - User clicks `Logout`.
  - `LogoutButton` POSTs `/api/auth/logout`.
  - Backend clears Supabase session cookies.
  - Frontend redirects to `/login`.

- **Password change with bad current password**:
  - POST `/api/auth/change-password` returns 400 with `INVALID_CURRENT_PASSWORD`.
  - UI displays an appropriate global toast and does not clear the form.

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
  - On error: `{ error: { code: string; message: string; } }`.

#### 2.2.1 `POST /api/auth/signup`

- Input JSON:
  - `{ email: string; password: string; repeatPassword: string }`.
- Validation:
  - Zod schema `SignupCommandSchema`.
  - Validate email format, password strength, and password match.
- Behavior:
  - Use `locals.supabase.auth.signUp({ email, password })`.
  - On success:
    - Supabase returns a session (email/password auth with auto-confirm), session cookies are managed via Supabase helpers.
  - Response:
    - `201 Created` with `{ data: { user_id, email } }`.
- Error handling:
  - Email already registered → `409 Conflict`, code `EMAIL_ALREADY_REGISTERED`.
  - Validation errors → `400 Bad Request`, code `VALIDATION_ERROR` .
  - Supabase or unknown errors → `500 Internal Server Error`, code `INTERNAL_ERROR`.

#### 2.2.2 `POST /api/auth/login`

- Input JSON:
  - `{ email: string; password: string }`.
- Validation:
  - Zod schema `LoginCommandSchema` .
- Behavior:
  - Call `locals.supabase.auth.signInWithPassword({ email, password })`.
  - On success:
    - Supabase sets session cookies via its SSR helpers (cookie management handled in middleware or helper function).
  - Response:
    - `200 OK` with `{ data: { user_id, email } }`.
- Error handling:
  - Invalid credentials or validation issues → `401 Unauthorized`, code `INVALID_CREDENTIALS`.
  - Unknown errors → `500` with generic message.

#### 2.2.3 `POST /api/auth/logout`

- Input: none or empty JSON body.
- Behavior:
  - Use `locals.supabase.auth.signOut()`.
  - Clear auth-related cookies.
- Response:
  - `200 OK` or `204 No Content` with `{ data: null }`.
- Error handling:
  - If sign-out fails, still attempt to clear cookies; return `500` .

#### 2.2.4 `POST /api/auth/change-password`

- Input JSON:
  - `{ currentPassword: string; newPassword: string; repeatNewPassword: string }`.
- Validation:
  - Zod schema `ChangePasswordCommandSchema`.
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

- Input: none or empty JSON body.
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
  - `500` on DB errors.

### 2.3 Data Models and Types

- **Auth DTOs and types** (TypeScript interfaces) - keeping consistency with existing type organization:
  - Shared lives in `src/types.ts`.
  - Service-related in `<name>.service.types.ts`.
- **Supabase client type**:
  - Continue using `SupabaseClient` type exported from `src/db/supabase.client.ts` as the canonical type for both client and server flavors.

### 2.4 Input Validation Mechanism

- **Zod-based validation** (backend):
  - Pattern:
    - Parse and validate `await request.json()`.
    - On `ZodError`, respond with `400` (except for the login endpoint, which always responds with `401 INVALID_CREDENTIALS` for any invalid or missing credentials).
- **Client-side mirroring**:
  - React forms use equivalent schemas or a simplified validation layer to provide immediate feedback.
  - Server remains the single source of truth; client validation is an optimization.

### 2.5 Exception Handling

- Services errors utilities in `<name>.service.error.ts`:
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
  - Server-side Supabase client wired into `context.locals` via Astro middleware.

### 3.2 Astro Middleware and Locals

- File: `src/middleware/index.ts` (as per project structure guidelines).
- Responsibilities:
  - Initialize a **server-side Supabase client** per request using the incoming cookies.
  - Attach it to `context.locals.supabase` (typed as `SupabaseClient`).
  - Ensure that any session changes (login, logout, refresh) are reflected by updating response cookies.
- All Astro routes and API endpoints use `context.locals.supabase` instead of importing `supabaseClient` directly.

### 3.3 AuthGuard Pattern

- Implemented as reusable server-side helpers, not a client-only guard.
- Helper functions (e.g., in `src/lib/utils/auth.ts`):
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

### 3.5 Integration with Existing Features

- **Flashcards generation, management, learning**:
  - Whenever flashcard or generation data is persisted, queries must filter by `user_id = currentUser.id`.
  - Existing usage of a hardcoded `DEFAULT_USER_ID` should be replaced with real `user_id` from Supabase Auth. A `DEV_DEFAULT_USER_ID` env variable may be used as a fallback only in local development environments and must never be relied on in production or to bypass the AuthGuard.
- **GDPR compliance (F-01)**:
  - Account deletion endpoint deletes all personal data and learning data owned by the user.
  - Because Supabase stores user profiles and Auth users, both must be removed.

### 3.6 Security Considerations

- **Transport**:
  - Assume HTTPS in production so auth cookies are secure.
- **Cookies**:
  - Use `Secure`, `HttpOnly`, and `SameSite` settings appropriate for the deployment environment.
- **Password handling**:
  - Plain passwords are never stored or logged.
  - Supabase handles hashing and storage.

---

## 4. Summary of Contracts

### 4.1 Frontend → Backend Contracts

- `POST /api/auth/signup`
  - Request: `{ email, password, repeatPassword }`.
  - Responses:
    - `201`: `{ data: { user_id, email } }`.
    - `400`: `{ error: { code: "VALIDATION_ERROR",  message } }`.
    - `409`: `{ error: { code: "EMAIL_ALREADY_REGISTERED", message } }`.

- `POST /api/auth/login`
  - Request: `{ email, password }`.
  - Responses:
    - `200`: `{ data: { user_id, email } }`.
    - `401`: `{ error: { code: "INVALID_CREDENTIALS" , message } }`.

- `POST /api/auth/logout`
  - Request: empty.
  - Responses:
    - `200`/`204`: `{ data: null }`.

- `POST /api/auth/change-password`
  - Request: `{ currentPassword, newPassword, repeatNewPassword }`.
  - Responses:
    - `200`: `{ data: null }`.
    - `400`: codes `VALIDATION_ERROR` or `INVALID_CURRENT_PASSWORD`.
    - `401`: `UNAUTHENTICATED`.

- `POST /api/auth/delete-account`
  - Request: empty.
  - Responses:
    - `200`: `{ data: null }`.
    - `401`: `UNAUTHENTICATED`.

This specification provides the contracts and structure needed to implement a robust, Supabase-backed authentication system without breaking the existing flashcard generation, management, and learning flows.
