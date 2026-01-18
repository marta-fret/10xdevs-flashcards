# UI Architecture for AI Flashcards

## 1. UI Structure Overview

The application separates unauthenticated and authenticated areas with an `AuthGuard`. Authenticated pages share a common layout containing a top-bar navigation menu, global feedback zones (toast area, alert banner), and a main content outlet. Each view is implemented as an Astro page that renders React components where interactivity is required. Front-end state is handled with React Context and hooks local to features; server communication uses simple `fetch` calls to the REST API.

Route map:

- `/auth` → public authentication layout (login, sign-up, password reset)
- `/` (alias of `/generate`) → Flashcards generation view (default after login)
- `/flashcards` → Flashcards management view
- `/learn` → Learning session view
- `/user` → User panel (account settings & deletion)

## 2. View List

### 2.1 Authentication

- **Path**: `/auth`
- **Purpose**: Login, sign-up, password reset.
- **Key info**: Forms for email/password; inline validation & error messages.
- **Key components**: `AuthForm`, `FormField`, `PasswordStrengthMeter`, `RedirectLink`.
- **UX / accessibility / security**:
  - Focus first invalid field on submit; password fields masked.
  - CSRF-safe form submission; Supabase session stored in HttpOnly cookie.
  - Redirect authenticated users away to `/generate`.
- **Mapped requirements**: F-01, US-001–US-003.

### 2.2 Flashcards Generation

- **Path**: `/generate`
- **Purpose**: Accept study text and generate AI flashcard proposals.
- **Key info**: Textarea (max 12 000 chars) with live counter; list of proposal cards returned by API.
- **Key components**: `SourceTextArea`, `CharacterCounter`, `GenerateButton`, `ProposalCard`, `ProposalEditDialog`, `LoaderOverlay`, `ControlBar` (Save accepted / Save all / Reset).
- **UX / accessibility / security**:
  - Disable Generate until 1000–10 000 char range.
  - Loader overlay blocks input during `POST /generations`.
  - Proposal cards follow responsive grid (1–4 cols) with keyboard navigation.
  - Reject state dims card & exposes Restore button (WCAG contrast maintained).
  - Batch save via `POST /flashcards` then redirect to `/flashcards`.
- **Mapped requirements**: F-02, US-006–US-007, decisions 3–5.

### 2.3 Flashcards Management

- **Path**: `/flashcards`
- **Purpose**: List, search, edit, delete, and manually create flashcards.
- **Key info**: Paginated grid, search input, per-card actions.
- **Key components**: `FlashcardCard`, `SearchInput`, `Pagination`, `ManualCreateDialog`, `EditDialog`, `DeleteConfirmDialog`.
- **UX / accessibility / security**:
  - Grid adapts 1–4 cols (xs→lg).
  - Card action buttons have visually hidden labels for screen readers.
  - Destructive actions require confirmation dialog.
  - Query params `page`, `q` kept in URL to allow deep-links.
- **Mapped requirements**: F-03–F-04, US-008–US-012.

### 2.4 Learning Session

- **Path**: `/learn`
- **Purpose**: Study flashcards with spaced repetition flow.
- **Key info**: Presents card front, reveal back, self-assessment buttons.
- **Key components**: `LearningCard`, `RevealButton`, `SelfAssessmentButtons`, `SessionProgressBar`.
- **UX / accessibility / security**:
  - Keyboard shortcuts (Space to reveal, 1-4 for assessments).
  - Announce state changes via `aria-live` region.
  - Prevent accidental page leave with `beforeunload` if session in progress.
- **Mapped requirements**: F-05, US-013–US-015.

### 2.5 User Panel

- **Path**: `/user`
- **Purpose**: Account management (password change, account deletion).
- **Key info**: Password change form, delete account section.
- **Key components**: `PasswordChangeForm`, `AccountDeleteSection`, `DeleteConfirmDialog`, `Toast` (success).
- **UX / accessibility / security**:
  - After account deletion, show success toast then auto-logout.
  - Forms enforce strong password rules; all mutations use Supabase Auth APIs via secure calls.
- **Mapped requirements**: F-01 (change/delete), US-004–US-005.

## 3. User Journey Map

1. **Unauthenticated** → visits `/auth`.
2. Completes sign-up or login → redirected to `/generate`.
3. Pastes study text, character counter turns green; clicks **Generate**.
4. Loader overlay; on success proposals grid appears.
5. User reviews proposals:
   - Accept / Edit / Reject.
6. Chooses **Save accepted** (or Save all) → backend batch save; success → redirect to `/flashcards`.
7. In management view, can search, paginate, edit or delete, or **Create flashcard** manually.
8. Starts learning session via nav item → `/learn` → studies cards.
9. Visits **User panel** to change password or delete account (toast + logout).
10. Logs out via top-bar menu → returns to `/auth`.

## 4. Layout and Navigation Structure

- **RootAuthenticatedLayout**: includes
  - `TopNavBar` (shadcn/ui `NavigationMenu`)
    - Links: Generate, Flashcards, Learn, User Panel, Logout button.
    - Collapses into hamburger on small screens; hidden (`aria-hidden="true"`) while any modal/dialog is open.
  - `MainOutlet` (renders active view)
  - `GlobalToastZone` and optional `AlertBanner` for page-level errors.
- **RootPublicLayout**: simple centered container for auth forms.
- **Routing Rules**:
  - `AuthGuard` wraps all authenticated routes; redirects unauth users to `/auth` and redirects authenticated users away from `/auth`.

## 5. Key Components (shared)

- **AuthGuard**: route wrapper performing Supabase session check.
- **TopNavBar**: primary navigation menu with responsive behaviour.
- **FlashcardCard**: generic card for displaying a saved flashcard.
- **ProposalCard**: variant used in generation view with Accept/Edit/Reject/Restore controls.
- **ModalDialog**: shadcn/ui `Dialog` used for edit, delete confirm, manual create.
- **LoaderOverlay**: full-page blocking overlay shown during async calls.
- **Toast**: shadcn/ui `Toast` component for success notifications.
- **AlertBanner**: shadcn/ui `Alert` used for generic page-level errors.
- **Pagination**: numeric paginator component.
- **SearchInput**: debounced search field with `aria-label`.
- **CharacterCounter**: live counter tied to textarea value.
- **SelfAssessmentButtons**: button group (Again/Hard/Good/Easy) with colour cues and accessible labels.

These components enforce consistent styling (Tailwind + shadcn/ui), accessibility (WCAG AA), and integrate validation & error feedback inline where possible.

---

This UI architecture maps all PRD functional requirements and user stories to concrete views and reusable components, ensuring alignment with the defined REST API and the planning session decisions.
