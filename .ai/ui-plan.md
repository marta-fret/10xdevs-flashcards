# UI Architecture for AI Flashcards

## 1. UI Structure Overview

There are 5 main views in the application: 'Authentication', 'Flashcards Generation', 'Flashcards Management', 'Learning Session', and 'User Panel'. The application separates unauthenticated and authenticated areas with an `AuthGuard`. Authenticated pages share a common layout containing a top-bar navigation menu, global feedback zones (toast area, alert banner), and a main content outlet. Each view is implemented as an Astro page that renders React components where interactivity is required. Views are build with shadcn/ui components and Tailwind CSS for styling. Front-end state is handled with React Context and hooks local to features; server communication uses simple `fetch` calls to the REST API.

Route map:

- `/login` → public Authentication view (login, sign-up)
- `/generate` → Flashcards generation view (default after login)
- `/flashcards` → Flashcards management view
- `/learn` → Learning session view
- `/user` → User panel (account settings & deletion)

## 2. Views List

### 2.1 Authentication

- **Path**: `/login`
- **Purpose**: Login, sign-up.
- **Key info**: Allows entering email and password to authenticate; displays password rules and inline validation errors.
- **Key components**: Login/register form with email and password fields, submit button, validation error messages, validation rules.
- **UX / accessibility / security**:
  - Password field masked.
  - Validation errors displayed inline.
  - Handling keyboard navigation (tab/enter).
  - Redirect authenticated users away to `/generate`.
- **Mapped requirements**: F-01, US-001–US-003.

### 2.2 Flashcards Generation

- **Path**: `/generate`
- **Purpose**: Accept source text and generate AI flashcard proposals. Then allows for reviewing generated proposals and saving accepted ones as flashcards.
- **Key info**: allows to input a source text for flashcard generation, lists generated flashcard proposals (front/back pairs) for review.
- **Key components**: Source text `textarea` with live counter (green 1000-10000, red otherwise), `Generate` button, the list of proposal cards each with `Accept`, `Edit`, `Reject` buttons, modal dialog for editing a proposal, a control bar with `Save accepted`, `Save all` (all non-rejected), and `Reset` (discards proposals, resets the view) buttons, blocking loading overlay during generation or save operations, inline error messagges for generating or saving errors.
- **UX / accessibility / security**:
  - Disable Generate button until valid 1000–10000 char range in textarea.
  - Loader overlay blocks interactivity during generation or save operations.
  - Clear inline error messages for mentioned async operations.
  - List of proposal cards follow responsive grid (1–4 cols).
  - On successful save redirect to `/flashcards`.
- **Mapped requirements**: F-02, US-006–US-007.

### 2.3 Flashcards Management

- **Path**: `/flashcards`
- **Purpose**: View, search, edit, delete, and manually create flashcards.
- **Key info**: Displays saved flashcards with front/back data.
- **Key components**: Responsive paginated grid of flashcard cards each with Edit / Delete buttons, a button for manual flashcard creation, modals for editing and creating a flashcard (fields: front text, back text; buttons: Save, Cancel; validation), deletion confirmation dialog, search field for filtering flashcards.
- **UX / accessibility / security**:
  - Grid adapts 1–4 cols (xs→lg).
  - Card action buttons have visually hidden labels for screen readers.
  - Destructive actions require confirmation dialog.
  - Data validation before flashcard creation and update operations.
- **Mapped requirements**: F-03–F-04, US-008–US-012.

### 2.4 Learning Session

- **Path**: `/learn`
- **Purpose**: Study flashcards with spaced repetition flow.
- **Key info**: Shows the front of the current flashcard, allows revealing the back, and collects self-assessment feedback.
- **Key components**: Flashcard display panel toggling front/back, Reveal button, set of self-assessment option buttons, and session progress indicator.
- **UX / accessibility / security**:
  - Intuitive flow with clear visual feedback.
  - Prevent accidental page leave with `beforeunload` if session in progress.
- **Mapped requirements**: F-05, US-013–US-015.

### 2.5 User Panel

- **Path**: `/user`
- **Purpose**: Account management (logout, password change, account deletion).
- **Key info**: Presents forms to change password and to permanently delete the account, along with explanatory warnings.
- **Key components**: Logout button, password change form with current and new password inputs, account delete section with irreversible action warning and confirmation dialog, appropriate inline error message if any of these operations fails.
- **UX / accessibility / security**:
  - After logout: redirect to /login.
  - After account deletion: auto-logout, redirect to /login, show success toast.
  - Password fields masked.
  - Forms enforce strong password rules.
- **Mapped requirements**: F-01 (change/delete), US-004–US-005.

## 3. User Journey Map

1. **Unauthenticated** → visits `/login`.
2. Completes sign-up or login → redirected to `/generate`.
3. Pastes source text for flashcards proposals generation, clicks **Generate**.
4. Loader overlay; on success proposals grid appears.
5. User reviews proposals:
   - Accept / Edit / Reject.
6. Chooses **Save accepted** (or Save all) → backend batch save; success → redirect to `/flashcards`.
7. In Flashcards management view, can browse, search, edit or delete, as well as create flashcard manually.
8. Starts learning session after navigating to `/learn`.
9. Visits **User panel** to logout, change password or delete account.

## 4. Layout and Navigation Structure

- **RootAuthenticatedLayout**: includes
  - `TopNavBar` (shadcn/ui `NavigationMenu`)
    - Links: Generate, Flashcards, Learn, User Panel, Logout button.
    - Collapses into hamburger on small screens; hidden (`aria-hidden="true"`) while any modal/dialog is open.
  - `MainOutlet` (renders active view)
  - `GlobalToastZone` and optional `AlertBanner` for page-level errors.
- **RootPublicLayout**: simple centered container for auth forms.
- **Routing Rules**:
  - `AuthGuard` wraps all authenticated routes; redirects unauth users to `/login` and redirects authenticated users to `/flashcards`.

## 5. Key Components

- Authentication forms for login and registration with validation feedback.
- Global navigation bar linking generation, flashcards management, learning session, and user panel views.
- Source text input area with live character counter for AI flashcard generation.
- Flashcard proposals list where each proposal can be accepted, edited, or rejected.
- Flashcards list with pagination, search, and actions to edit or delete individual cards.
- Modal dialogs for creating or editing flashcards.
- Modal dialogs for confirming destructive actions.
- Learning session card presenter that shows front/back sides and captures self-assessment feedback.
- Full-page loader overlay displayed during long-running operations (generation, save, etc.).
- Toast and alert messages to communicate success or error states to the user.

---

This UI architecture maps all PRD functional requirements and user stories to concrete views and reusable components, ensuring alignment with the defined REST API and the planning session decisions.
