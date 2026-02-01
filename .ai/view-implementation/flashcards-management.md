# View Implementation Plan – Flashcards Management

## 1. Overview

The **Flashcards Management** view (`/flashcards`) lets a logged-in user browse their saved flashcards, create new manual flashcards, edit existing ones, and delete those they no longer need. The view presents a responsive, paginated grid of flashcards, supports modal-based creation and editing with strict validation, and uses a confirmation dialog for destructive delete actions. A loader overlay blocks interaction during key async operations, inline messages indicate validation issues, and toast notifications surface errors from backend API calls.

Search/filtering is part of the broader product vision but **will not be implemented in the first iteration** of this view. It is explicitly planned as a future enhancement.

## 2. View Routing

- **Path**: `/flashcards`
- **Guard**: authenticated route middleware (e.g. `requireAuth`) so only logged-in users can access the page.
- **Astro page file**: `src/pages/flashcards.astro`
  - Renders the React view inside the main authenticated layout.

## 3. Component Structure

```text
/flashcards (FlashcardsPage.astro)
 └─ <RootAuthenticatedLayout>
     └─ <FlashcardsManagementView client:load>
         ├─ <LoadingOverlay />                       // blocks UI during list (re)load or global mutations
         ├─ <FlashcardsToolbar>
         │   ├─ heading / description
         │   ├─ (future) <FlashcardsSearchInput />   // search planned for later iteration
         │   └─ "Create flashcard" button
         ├─ <UserFlashcardsList>
         │   ├─ <UserFlashcardListItem>* (1..n)
         │   └─ Empty state message when no cards
         ├─ <PaginationControls />
         ├─ <FlashcardEditModal />                   // used for both create and edit - component already exists, adjust and reuse
         └─ <DeleteFlashcardDialog />                // confirmation dialog for deletions
```

Global UI roots (for toasts) are provided by the app shell, consistent with the flashcards-generation view.

## 4. Component Details

### FlashcardsPage (Astro page)

- **Component description**
  - Route-level Astro file responsible for rendering the flashcards management UI inside the authenticated layout.
  - Ensures only authenticated users can access the view (via middleware).
- **Main elements / children**
  - `<RootAuthenticatedLayout>`
    - `<FlashcardsManagementView client:load />`
- **Handled interactions**
  - None (static shell); interaction is delegated to the React child.
- **Handled validation**
  - Route-level guard ensures user is authenticated.
- **Types**
  - None specific to this component.
- **Props**
  - None.

### FlashcardsManagementView (React, client:load)

- **Component description**
  - Top-level interactive container for the `/flashcards` view.
  - Orchestrates fetching the list, pagination, manual creation, editing, and deletion.
  - Owns the main view state and wires it into child components.
- **Main elements / children**
  - Wraps:
    - `<LoadingOverlay />` (conditional)
    - `<FlashcardsToolbar />`
    - `<UserFlashcardsList />`
    - `<PaginationControls />`
    - `<FlashcardEditModal />` (controlled visibility)
    - `<DeleteFlashcardDialog />` (controlled visibility)
- **Handled interactions**
  - On mount: triggers initial GET `/flashcards` call.
  - Pagination: `onPageChange(page)` updates query and refetches list.
  - Toolbar:
    - `onCreateClick()` → opens `FlashcardEditModal` in "create" mode.
  - Card actions:
    - `onEditClick(id)` → opens `FlashcardEditModal` in "edit" mode with prefilled values.
    - `onDeleteClick(id)` → opens `DeleteFlashcardDialog` for the selected card.
  - Create/update modal:
    - `onSubmitCreate(values)` → POST `/flashcards` (manual creation) then update list.
    - `onSubmitEdit(id, values)` → PATCH `/flashcards/:id` then update list item.
    - `onCancel()` → closes modal.
  - Delete dialog:
    - `onConfirm(id)` → DELETE `/flashcards/:id` then remove from list.
    - `onCancel()` → closes dialog.
- **Handled validation**
  - Prevents interactions while async operations are in progress:
    - Disables toolbar button(s) and pagination during initial load.
    - Disables form submission while create/edit in progress.
    - Disables delete confirmation while delete in progress.
  - Ensures pagination query values stay valid:
    - `page` is clamped to `[1, total_pages]` (when known).
    - `limit` fixed inside allowed server range (≤100).
    - `sort` and `order` restricted to allowed values.
  - Verifies that edit operations only proceed when there is an existing item with given `id`.
- **Types**
  - Uses DTOs from `src/types.ts`:
    - `FlashcardListItemDto`
    - `FlashcardsListResponseDto`
    - `CreateFlashcardsCommand`
    - `CreateFlashcardsResponseDto`
    - `UpdateFlashcardCommand`
    - `FlashcardDetailResponseDto`
    - `DeleteFlashcardResponseDto`
    - `PaginationMetaDto`
    - `FlashcardsSortField`, `SortOrder`, `FlashcardSource`
  - View-specific:
    - `FlashcardListItemViewModel`
    - `FlashcardsListQueryViewModel`
    - `FlashcardFormValues`
- **Props**
  - None; the view manages its own state and data fetching.

### FlashcardsToolbar

- **Component description**
  - Top-of-page bar providing context and primary actions for the flashcards view.
  - Hosts the "Create flashcard" button and, in future, the search input.
- **Main elements**
  - Heading (`<h1>`) such as "Your flashcards".
  - Right-aligned actions container:
    - Primary Button: "Create flashcard".
    - (Future) Search input field: not present in the first iteration;
- **Handled interactions**
  - `onCreateClick` → fires when user clicks "Create flashcard".
- **Handled validation**
  - Disables the "Create flashcard" button while global loading overlay is active (to avoid interacting during list refresh or global mutations).
- **Types**
  - `FlashcardsToolbarProps` - details below
- **Props**

```ts
interface FlashcardsToolbarProps {
  isDisabled: boolean;
  onCreateClick: () => void;
  // Future: onSearchChange?(value: string): void; // to be implemented later
}
```

### UserFlashcardsList

- **Component description**
  - Displays the user’s flashcards as a responsive grid of cards.
  - Handles the empty state when there are no flashcards.
- **Main elements**
  - Grid container (`<div>` with Tailwind-based CSS grid, 1–4 columns depending on viewport).
  - For each item: one `<UserFlashcardListItem />`.
  - Empty state:
    - Message like "You don't have any flashcards yet." and a hint to use the "Create flashcard" button.
- **Consistency with other views**
  - Styling should be consistent with src/components/generate/FlashcardList.tsx.
- **Handled interactions**
  - Delegates card-level interactions via props to `UserFlashcardListItem`.
- **Handled validation**
  - None beyond ensuring it only attempts to render cards when data is available.
- **Types**
  - `FlashcardListItemViewModel[]`, `UserFlashcardsListProps`.
- **Props**

```ts
interface UserFlashcardsListProps {
  items: FlashcardListItemViewModel[];
  onEditClick: (id: number) => void;
  onDeleteClick: (id: number) => void;
}
```

### UserFlashcardListItem

- **Component description**
  - Visual representation of a single flashcard within the grid.
  - Shows front text, back text and action buttons.
- **Main elements**
  - Container card with:
    - Front text (possibly truncated with ellipsis - full content accessible via edit modal).
    - Back text (possibly truncated with ellipsis - full content accessible via edit modal).
    - Footer area with two action buttons:
      - "Edit" button.
      - "Delete" button.
    - Visually hidden labels for screen readers on icon buttons.
- **Consistency with other views**
  - Styling should be consistent with src/components/generate/FlashcardListItem.tsx with two remarks:
    - Applicable for the elements that are present in both components (for example badge for edited state is only in generate/FlashcardListItem.tsx)
    - We can introduce some small improvements like truncating with ellipsis.
- **Handled interactions**
  - `onEditClick(id)` when Edit is pressed.
  - `onDeleteClick(id)` when Delete is pressed.
- **Types**
  - Uses `FlashcardListItemViewModel` for the card data.
- **Props**

```ts
interface UserFlashcardListItemProps {
  item: FlashcardListItemViewModel;
  onEditClick: (id: number) => void;
  onDeleteClick: (id: number) => void;
}
```

### PaginationControls

- **Component description**
  - Displays current page, total pages, and allows the user to move between pages.
- **Main elements**
  - Buttons: "Previous", "Next".
  - current/total page number indicator (e.g. "Page 2 of 5").
- **Handled interactions**
  - `onPageChange(page)` fired when user goes to a different page.
- **Handled validation**
  - Disables "Previous" when `page <= 1`.
  - Disables "Next" when `page >= total_pages`.
  - Disables all controls while list is loading (`isDisabled` flag from parent) to avoid concurrent loads.
- **Types**
  - Uses `PaginationMetaDto`.
- **Props**

```ts
interface PaginationControlsProps {
  pagination: PaginationMetaDto | null;
  isDisabled: boolean;
  onPageChange: (page: number) => void;
}
```

### FlashcardEditModal

- **Component description**
  - Modal dialog used for both creating new manual flashcards and editing existing ones.
  - Uses src/components/ui/dialog.tsx and `react-hook-form` with a `zod` schema to enforce API validation rules.
  - **IMPORTANT**: `FlashcardEditModal` was already created for "Flashcards generation" view: src/components/generate/FlashcardEditModal.tsx. The best would be to extend/adjust it also for this use case - then also please move the file to src/components/shared/FlashcardEditModal.tsx. If too complicated, create a new component but try to keep maximum consistency with src/components/generate/FlashcardEditModal.tsx.
- **Main elements**
  - Dialog overlay and content.
  - Title:
    - "Create flashcard" in create mode.
    - "Edit flashcard" in edit mode.
  - Form fields:
    - Textarea for `front`.
    - Textarea for `back`.
  - Field-level inline validation error messages below each input.
  - Action buttons:
    - Primary: "Confirm".
    - Secondary: "Cancel".
- **Handled interactions**
  - Typing into fields; validation runs on change and on submit.
  - `onSubmit(id, values)` calls parent handler (create or edit) when form is valid.
  - `onCancel()` closes modal without changes.
- **Handled validation**
  - Zod schema enforcing:
    - `front` is required and has `front.length <= 200`.
    - `back` is required and has `back.length <= 500`.
  - Form submit is disabled when:
    - Form is invalid.
    - confirmation is in progress.
- **Types**
  - `FlashcardFormValues`.
  - union for mode:

```ts
type FlashcardFormMode = "create" | "edit";
```

- **Props**

```ts
interface FlashcardEditModalProps {
  mode: FlashcardFormMode;
  initialValues: FlashcardFormValues; // will be empty object in create mode
  id?: string; // optional for create, required for edit
  isSubmitting?: boolean; // to disable submit button during async call
  onSubmit: (id: string | undefined, values: FlashcardFormValues) => void;
  onClose: () => void;
}
```

### DeleteFlashcardDialog

- **Component description**
  - Confirmation dialog for deleting a flashcard.
  - Uses Shadcn `AlertDialog` to ensure proper accessibility and focus management.
- **Main elements**
  - Modal with title and description explaining that deletion is permanent.
  - Buttons:
    - Destructive "Delete".
    - Secondary "Cancel".
- **Handled interactions**
  - `onConfirm()` → parent triggers DELETE `/flashcards/:id`.
  - `onCancel()` → closes dialog.
- **Handled validation**
  - Disables the Delete button while delete request is in progress.
- **Types**
  - Stateless beyond simple props.
- **Props**

```ts
interface DeleteFlashcardDialogProps {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

### Shared components: LoadingOverlay & InlineErrorMessage

These are shared with the flashcards-generation view and should be reused.

- **LoadingOverlay** - Full-screen semi-transparent overlay with centered spinner.

- **InlineErrorMessage** - Small text component for showing inline validation or API errors near relevant controls.

## 5. Types

### 5.1 API types (from `src/types.ts`)

Imported from the shared types module:

- `FlashcardSource = "ai-full" | "ai-edited" | "manual"`
- `FlashcardListItemDto` (alias of `FlashcardDto`):
  - `id: number`
  - `front: string`
  - `back: string`
  - `source: FlashcardSource`
  - `generation_id: number | null`
  - `created_at: string`
  - `updated_at: string`
- `PaginationMetaDto`:
  - `page: number`
  - `limit: number`
  - `total_items: number`
  - `total_pages: number`
- `FlashcardsSortField = "created_at" | "updated_at"`
- `SortOrder = "asc" | "desc"`
- `FlashcardsListQueryCommand` (backend command model for GET query)
- `FlashcardsListResponseDto`:
  - `items: FlashcardListItemDto[]`
  - `pagination: PaginationMetaDto`
- `CreateFlashcardCommandItem`, `CreateFlashcardsCommand`, `CreateFlashcardsResponseDto`
- `UpdateFlashcardCommand`
- `FlashcardDetailResponseDto`
- `DeleteFlashcardResponseDto`
- `FlashcardsApiErrorCode`, `FlashcardsApiPatchErrorCode`, `FlashcardsApiDeleteErrorCode`

### 5.2 ViewModel and UI types

These are view-specific and do not affect the API layer.

```ts
// UI representation of a flashcard list item
export interface FlashcardListItemViewModel {
  id: number;
  front: string;
  back: string;
  source: FlashcardSource;
  generationId: number | null;
  createdAt: string;
  updatedAt: string;
  isUpdating: boolean; // true while an edit is being saved
  isDeleting: boolean; // true while a delete is in progress
}

// Frontend query state for GET /flashcards
export interface FlashcardsListQueryViewModel {
  page: number; // >= 1
  limit: number; // e.g. 12, within [1, 100]
  sort: FlashcardsSortField; // default: "created_at"
  order: SortOrder; // default: "desc"
  // Future (search & filters):
  q?: string;
  source?: FlashcardSource;
}

// Form values for create/edit modal
export interface FlashcardFormValues {
  front: string; // <= 200 chars
  back: string; // <= 500 chars
}
```

### 5.3 Custom hook state types (conceptual)

At view level:

```ts
interface FlashcardsViewState {
  items: FlashcardListItemViewModel[];
  pagination: PaginationMetaDto | null;
  query: FlashcardsListQueryViewModel;
  isLoading: boolean;
  isGlobalMutating: boolean;
  listError?: string;
  mutationError?: string;
  activeModal: null | { mode: "create" } | { mode: "edit"; flashcardId: number };
  deleteCandidateId: number | null;
}
```

## 6. State Management

### 6.1 Top-level state in FlashcardsManagementView

- **State variables**
  - `items: FlashcardListItemViewModel[]` – current page of flashcards.
  - `pagination: PaginationMetaDto | null` – metadata for controls; null until first successful load.
  - `query: FlashcardsListQueryViewModel` – current GET `/flashcards` query (page, sort, order, limit).
  - `isLoading: boolean` – when data is loadingiincluding refething.
  - `isGlobalMutating: boolean` – true during create/edit/delete; drives `LoadingOverlay`.
  - `listError: string | undefined` – human-readable list load error message.
  - `mutationError: string | undefined` – last error from create/edit/delete; shown as toast and optionally inline.
  - `activeModal: null | { mode: "create" } | { mode: "edit"; flashcardId: number }` – controls `FlashcardEditModal`.
  - `deleteCandidateId: number | null` – ID of card currently pending deletion.

### 6.2 Custom hook: useFlashcardsManagement

A custom hook encapsulating view state and side-effects is recommended.

- **Responsibilities**
  - Perform GET `/flashcards` with current `query`.
  - Map DTOs to `FlashcardListItemViewModel`.
  - Provide handlers for create/edit/delete and pagination.
- **Exposed API (conceptually)**

```ts
interface UseFlashcardsManagementResult {
  state: FlashcardsViewState;
  openCreateModal: () => void;
  openEditModal: (id: number) => void;
  closeModal: () => void;
  submitCreate: (values: FlashcardFormValues) => Promise<void>;
  submitEdit: (values: FlashcardFormValues) => Promise<void>;
  openDeleteDialog: (id: number) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  goToPage: (page: number) => void;
}
```

The hook internally calls smaller API hooks:

- `useFlashcardsList` for GET `/flashcards`.
- `useCreateFlashcard` for POST `/flashcards`.
- `useUpdateFlashcard` for PATCH `/flashcards/:id`.
- `useDeleteFlashcard` for DELETE `/flashcards/:id`.

### 6.3 Local component state

- **FlashcardEditModal**
  - Managed by `react-hook-form` + `zod`:
    - Input values, touched state, and validation errors.
    - `formState.isSubmitting` combined with `isSubmitting` prop from parent to control Confirm button.
- **DeleteFlashcardDialog**
  - No internal state; open/close is controlled by parent.
- **UserFlashcardListItem / UserFlashcardsList / PaginationControls**
- Stateless UI components that rely solely on props.

## 7. API Integration

### 7.1 GET `/flashcards`

- **When called**
  - On initial mount of `FlashcardsManagementView`.
  - Whenever `query.page`, `query.sort`, or `query.order` changes.
  - After successful create/edit/delete, to refresh the list (simplest, most robust approach).

- **Request**
  - Method: `GET`
  - URL: `/flashcards` with query string parameters:
    - `page`: `query.page` (integer, ≥1; default 1).
    - `limit`: `query.limit` (integer, default e.g. 10; ≤100).
    - `sort`: `query.sort` (default `created_at`).
    - `order`: `query.order` (default `desc`).
    - `q` and `source` are **not** used in first iteration; reserved for future search/filtering.

- **Response**
  - Type: `FlashcardsListResponseDto`.
  - On 200 OK: map `items` into `FlashcardListItemViewModel[]` and update `pagination`.

- **Error handling**
  - 400 `invalid_request`: show error toast (developer bug), keep previous data.
  - 401 `unauthorized`: show toast.
  - 500 `internal_error`: show toast and mark `listError`.

### 7.2 POST `/flashcards` (manual creation)

- **When called**
  - On valid submit from `FlashcardEditModal` in create mode.

- **Request**
  - Method: `POST`
  - URL: `/flashcards`
  - Body type: `CreateFlashcardsCommand`.
  - Payload shape for manual creation:

```ts
const body: CreateFlashcardsCommand = {
  flashcards: [
    {
      front: values.front,
      back: values.back,
      source: "manual",
      generation_id: null,
    },
  ],
};
```

- **Response**
  - Type: `CreateFlashcardsResponseDto`.
  - On 201 Created:
    - Close modal.
    - Show success toast (e.g. "Flashcard created").
    - Refetch list via GET `/flashcards` to ensure pagination/pagination meta is consistent.

- **Error handling**
  - 400 `invalid_request`: show toast.
  - 401 `unauthorized`: show toast.
  - 500 `internal_error`: show generic error toast, keep form open so user can retry.

### 7.3 PATCH `/flashcards/:id`

- **When called**
  - On valid submit from `FlashcardEditModal` in edit mode.

- **Request**
  - Method: `PATCH`
  - URL: `/flashcards/${id}` (id from selected flashcard).
  - Body type: `UpdateFlashcardCommand`.
  - Minimal safe shape from form values:

```ts
const body: UpdateFlashcardCommand = {
  front: values.front,
  back: values.back,
};
```

- **Response**
  - Type: `FlashcardDetailResponseDto`.
  - On 200 OK:
    - Update the corresponding `FlashcardListItemViewModel` in `items`.
    - Close modal and show success toast (e.g. "Flashcard updated").

- **Error handling**
  - 400 `invalid_request`: toast; do not close modal.
  - 401 `unauthorized`: toast.
  - 404 `not_found`: toast, close modal, refetch the list.
  - 500 `internal_error`: toast, keep modal open.

### 7.4 DELETE `/flashcards/:id`

- **When called**
  - On confirm in `DeleteFlashcardDialog`.

- **Request**
  - Method: `DELETE`
  - URL: `/flashcards/${id}`.
  - No request body.

- **Response**
  - Type: `DeleteFlashcardResponseDto`.
  - On 200 OK:
    - Refetch the list.
    - Close dialog and show success toast.

- **Error handling**
  - 400 `invalid_request`: show toast.
  - 401 `unauthorized`: toast.
  - 404 `not_found`: toast, refeth list.
  - 500 `internal_error`: toast, keep dialog open but allow retry or cancel.

## 8. User Interactions

- **Initial page load**
  - On entering `/flashcards`, the view shows a loader overlay while calling GET `/flashcards`.
  - On success: overlay hides, grid + pagination controls render.
  - On error: overlay hides, error toast shows.

- **Paginating through flashcards**
  - Clicking "Next" / "Previous" updates `query.page` and triggers a list refetch.
  - While refetching: pagination buttons disabled; LoadingOverlay is shown.

- **Creating a manual flashcard**
  - User clicks "Create flashcard" in `FlashcardsToolbar`.
  - `FlashcardEditModal` opens in create mode with empty values.
  - User fills `front` and `back`:
    - Real-time validation enforces length limits with inline error messages.
  - User clicks "Confirm":
    - If form invalid: show inline error, do not send API request.
    - If valid: show loading state and call POST `/flashcards`.
  - On success: modal closes, toast confirms creation, list refetches.
  - On error: modal stays open, toast inform user.

- **Editing a flashcard**
  - User clicks "Edit" on a given `UserFlashcardListItem`.
  - `FlashcardEditModal` opens in edit mode, prefilled with card’s content.
  - User modifies `front` and/or `back`:
    - Same validation as creation.
  - Confirmation behavior mirrors create:
    - Valid → PATCH `/flashcards/:id`.
    - Success → update card, close modal, show toast.
    - Error → keep modal, show toast.

- **Deleting a flashcard**
  - User clicks "Delete" on a `UserFlashcardListItem`.
  - `DeleteFlashcardDialog` opens, explaining irreversible deletion.
  - User confirms:
    - While DELETE in flight: "Delete" button shows loading, dialog controls disabled.
    - On success: dialog closes, list refetched, success toast shown.
    - Error → keep modal, show toast.
  - User cancels:
    - Dialog closes without API call.

- **Future interaction: search/filter** (not in first iteration)
  - In a future iteration, the toolbar will host a search input.
  - Typing and submitting search will update `query.q` and refetch list via GET `/flashcards`.

## 9. Conditions and Validation

- **Access conditions**
  - User must be authenticated to access `/flashcards`.
  - Enforced at route level via Astro middleware.

- **Form validation (create/edit)**
  - `front`:
    - Required, non-empty.
    - `front.length <= 200`.
  - `back`:
    - Required, non-empty.
    - `back.length <= 500`.
  - Implemented with `zod` schema and `react-hook-form` resolver.
  - Violations produce inline messages and disable submit button.

- **API contract conditions**
  - GET `/flashcards` query values:
    - `page >= 1`.
    - `limit` fixed to a constant (e.g. 12) within `[1, 100]`.
    - `sort` constrained to `"created_at" | "updated_at"`.
    - `order` constrained to `"asc" | "desc"`.
  - PATCH `/flashcards/:id` body:
    - At least one of `front` or `back` should be present and valid.
  - DELETE `/flashcards/:id` path param:
    - ID is a positive integer; always sourced from existing items.

- **UI state conditions**
  - Loader overlay visible when data is fetching or mutating.
  - Toolbar and pagination controls disabled while overlay is active.

- **Search/filter conditions (future)**
  - `q` non-empty string when used.
  - `source` one of `FlashcardSource`.
  - For this iteration, these are documented but not implemented.

## 10. Error Handling

- API calls errors: show toast.
- Validation errors: show `InlineErrorMessage`.
- Details described in previous sections

## 11. Implementation Steps

All steps should follow the requirements and specifications described in this document and reuse existing shared components/helpers where possible.

1. **Page scaffold**
   - Create `src/pages/flashcards.astro` guarded by authentication middleware (e.g. `requireAuth`).
   - Render `<RootAuthenticatedLayout><FlashcardsManagementView client:load /></RootAuthenticatedLayout>`.

2. **Project structure for the view**
   - Create a folder for flashcards management components, e.g. `src/components/flashcards/` containing:
     - `FlashcardsManagementView.tsx`
     - `FlashcardsToolbar.tsx`
     - `UserFlashcardsList.tsx`
     - `UserFlashcardsListItem.tsx`
     - `PaginationControls.tsx`
     - `DeleteFlashcardDialog.tsx`
   - Reuse `InlineErrorMessage` and `LoadingOverlay` from `src/components/ui/` as defined for the flashcards-generation view.

3. **Define this view-specific types in `src/components/flashcards/types.ts`**
   - Create `src/components/flashcards/types.ts` with:
     - `FlashcardListItemViewModel`.
     - `FlashcardsListQueryViewModel`.
     - `FlashcardFormValues`.
   - Ensure imports from `src/types.ts` are used for API DTOs (e.g. `FlashcardListItemDto`, `FlashcardsListResponseDto`).

4. **Implement API hooks**
   - In `src/components/hooks/` or similar, implement:
     - `useFlashcardsList` – wraps GET `/flashcards`, maps response, exposes `{ data, isLoading, error, fetchList }`.
     - `useCreateFlashcard` – wraps POST `/flashcards` for manual creation.
     - `useUpdateFlashcard` – wraps PATCH `/flashcards/:id`.
     - `useDeleteFlashcard` – wraps DELETE `/flashcards/:id`.
   - Use `fetch` or a shared HTTP client, always parsing JSON into the typed DTOs from `src/types.ts`.

5. **Implement useFlashcardsManagement hook**
   - Create `src/components/flashcards/useFlashcardsManagement.ts`:
     - Initialise `query` with defaults (`page = 1`, `limit = 12`, `sort = "created_at"`, `order = "desc"`).
     - Call `useFlashcardsList` on mount and whenever `query` changes.
     - Maintain `items`, `pagination`, loading flags, and error messages.
     - Implement handlers for create, edit, delete, and pagination using the API hooks.
     - Drive `activeModal` and `deleteCandidateId` for the dialogs.

6. **Implement FlashcardsManagementView component**
   - Use `useFlashcardsManagement` and wire its result to child components:
     - Use `isListLoading` and `isGlobalMutating` to pass proper isDisabled value into `FlashcardsToolbar`, `PaginationControls`.
     - Pass appropriate handlers into child components.
   - Integrate toasts for API errors.

7. **Implement FlashcardsToolbar**
   - Render heading and "Create flashcard" button (no search in this iteration).
   - When button clicked, call `onCreateClick`.
   - Disable button when `isDisabled` prop is true.

8. **Implement UserFlashcardsList and UserFlashcardsListItem**
   - `UserFlashcardsList`:
     - If `items` empty, show empty state message.
     - Otherwise, render responsive grid with one `UserFlashcardsListItem` per item.
   - `UserFlashcardsListItem`:
     - All details in previous sections

9. **Implement PaginationControls**
   - On click, call `onPageChange` with `page - 1` or `page + 1` as appropriate.
   - Other details already mentioned in previous sections

10. **Refactor and reuse FlashcardEditModal as a shared component**
    - Start from the existing implementation in `src/components/generate/FlashcardEditModal.tsx`.
    - Extract the generic modal into a shared location, e.g. `src/components/shared/FlashcardEditModal.tsx`, using the `FlashcardEditModalProps` and `FlashcardFormMode` shapes defined in this plan:
      - `mode: "create" | "edit"` determines the title ("Create flashcard" / "Edit flashcard").
      - `initialValues` holds `{ front, back }` for the form.
      - `id?: string` is optional for create mode and required for edit mode.
      - `isSubmitting?: boolean` disables the Confirm button during async calls.
      - `onSubmit(id, values)` is called when the form is valid and the user confirms.
    - Keep the existing validation logic and UI from the generation view:
      - Use `react-hook-form` + `zodResolver` with the schema enforcing `front <= 200`, `back <= 500`, both required.
      - Use `mode: "onChange"` so the Confirm button enables only when the form is valid.
      - Preserve labels, placeholders, helper texts and the "Confirm" / "Cancel" buttons.
    - Adjust the **generation** view to use the shared component:
      - Map `FlashcardProposalUi` / `FlashcardDetailResponseDto` to the shared props:
        - `mode="edit"`.
        - `initialValues = { front: proposal.front, back: proposal.back }`.
        - `id = proposal.temp_id` for proposals, or `String(proposal.id)` for existing flashcards.
        - Take whatever logic you currently have in onConfirm(id, values) for updating proposals and closing the modal, and move/rename it into the new onSubmit(id, values) handler, still keyed on the string id that comes from temp_id or id.toString(). keep the current behavior (update proposal data and close the modal), using the string `id` to distinguish between proposals and saved flashcards.
    - Use the same shared `FlashcardEditModal` in the **flashcards management** view:
      - For **create**:
        - `mode="create"`, `id` omitted, `initialValues` with empty `front` and `back`.
        - `onSubmit(undefined, values)` should trigger POST `/flashcards` and then close the modal / refresh the list.
      - For **edit**:
        - `mode="edit"`, `id = String(flashcard.id)`, `initialValues` from the selected flashcard.
        - `onSubmit(id, values)` should trigger PATCH `/flashcards/:id`, update the list item, and close the modal.
      - Wire `isSubmitting` to the relevant mutation loading state so the Confirm button is disabled while the request is in flight.

11. **Implement DeleteFlashcardDialog**
    - Use Shadcn `AlertDialog`.
    - Show clear warning that deletion is permanent.
    - Disable Delete button while `isDeleting` is true.

12. **Testing and validation** (for future)
    - Add unit tests for:
      - Rendering and basic interactions of `FlashcardsManagementView`.
      - Validation logic of `FlashcardFormModal` (char limits).
      - Correct handling of successful and failed API calls (using MSW in tests if available).
    - Manually verify:
      - Paginated navigation.
      - Manual create (US-008).
      - List view (US-009).
      - Edit (US-011).
      - Delete with confirmation (US-012).

13. **Future work: search & filtering (US-010)**
    - Add `FlashcardsSearchInput` component to `FlashcardsToolbar`.
    - Extend `useFlashcardsManagement` to manage a `searchTerm` and update `query.q`.
    - Pass `q` to GET `/flashcards` via `FlashcardsListQueryViewModel`.
    - Optionally add `source` filter controls and map them to `query.source`.

This plan ensures the `/flashcards` view satisfies the PRD and user stories related to manual creation and management of flashcards, while clearly marking search/filtering as a future enhancement.
