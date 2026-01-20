# View Implementation Plan – Flashcards Generation

## 1. Overview

The **Flashcards Generation** view (`/generate`) lets a logged-in user paste study notes (1 000 – 10 000 chars) and request AI flashcard proposals. The user reviews those proposals, accepts / edits / rejects each, and saves accepted cards to their collection. The screen ensures responsive design, accessibility, strict validation, and clear feedback for loading and error states.

## 2. View Routing

- **Path**: `/generate`
- **Guard**: authenticated route middleware (`requireAuth`).

## 3. Component Structure

```
<GeneratePage>
 ├─ <RootAuthenticatedLayout>
 │   └─ <FlashcardGenerationView>
 │       ├─ <SourceInputSection>
 │       │   ├─ <TextareaWithCounter>
 │       │   └─ button for generating flashcards proposals
 │       │   └─ <InlineErrorMessage />
 │       ├─ <LoadingOverlay />
 │       ├─ <FlashcardList>
 │       │   └─ <FlashcardListItem>*
 │       │       └─ <FlashcardEditModal />
 │       └─ <ControlBar>
 │           ├─ button for saving accepted flashcards
 │           ├─ button for saving all flashcards
 │           └─ button for resetting the form
 │           └─ <InlineErrorMessage />
 └─ Global UI roots (toasts, modals)
```

`*` repeated for each proposal (1 – n) in a responsive CSS grid (1 – 4 cols).

## 4. Component Details

### GeneratePage (Astro page)

- **Description**: Route file (`src/pages/generate.astro`) that renders the interactive view inside an authenticated layout.
- **HTML / Children**: `<RootAuthenticatedLayout><FlashcardGenerationView/></RootAuthenticatedLayout>`.
- **Events**: none (static shell).
- **Validation**: route-level guard ensures the user is authenticated (middleware).
- **Types**: none.
- **Props**: none.

### FlashcardGenerationView (React, client:load)

- **Description**: Top-level interactive container which handles top-level UI logic and state for flashcard generating, reviewing and saving. Orchestrates a set of components dedicated for these tasks.
- **HTML / Children**: wraps `SourceInputSection`, `FlashcardList`, `ControlBar`, `LoadingOverlay`.
- **Events**: delegates callbacks (`onGenerate`, `onAccept`, `onReject`, `onEdit`, `onSave…`, `onReset`).
- **Validation**:
  - Disables actions when state is `generating` or `saving`.
  - Disables generation after first successful generation.
  - ControlBar not shown until flashcards are generated.
- **Types**: `CreateGenerationCommand`, `CreateGenerationResponseDto`, `CreateFlashcardsCommand`, `FlashcardProposalUi`.
- **Props**: none (state created internally).

### SourceInputSection

- **Description**: Collects `sourceText` and triggers generation.
- **HTML / Children**:
  - `<TextareaWithCounter>`:
    - `<label>` with description,
    - `<textarea>`,
    - Live counter coloured via conditional classes.
  - `Generate` button.
  - `<InlineErrorMessage />` to show generation error.
- **Events**:
  - `onChange` (textarea) → `updateSource(text)`.
  - `onClick` (`Generate` button) → `onGenerate()`.
- **Validation**:
  - Char length must be 1 000–10 000 inclusive; counter green if valid otherwise red and `Generate` button disabled.
- **Types**: `sourceText: string` (component local), `CreateGenerationCommand`.
- **Props**:

```ts
interface SourceInputSectionProps {
  onGenerate(sourceText: string): void;
  errorMessage?: string;
  disabled?: boolean;
}
```

### InlineErrorMessage

- **Description**: Small helper component to show an error message inline.
- **HTML**: text component with error icon.
- **Events**: none - purely informational component.
- **Validation**: passed message cannot be empty.
- **Types**: `string`.
- **Props**: {message: string}

### LoadingOverlay

- **Description**: Blocks interaction during async phases.
- **HTML**: overlay with spinner.
- **Events**: none
- **Validation**: none.
- **Types**: stateless.
- **Props**: none

### FlashcardList

- **Description**: Responsive grid that lists flashcards proposal cards.
- **HTML / Children**: grid containing `<FlashcardListItem>`.
- **Events**: propagates `onAccept`, `onReject`, `onEdit`.
- **Validation**: none
- **Types**: `FlashcardProposalUi[]`.
- **Props**:

```ts
interface FlashcardListProps {
  proposals: FlashcardProposalUi[];
  onAccept(id: string): void;
  onReject(id: string): void;
  onEdit(id: string, values: EditProposalFormValues): void;
}
```

### FlashcardListItem

- **Description**: Card displaying a single proposal with action buttons.
- **HTML / Children**:
  - Two `<p>` for front/back.
  - Action buttons: Accept (toggle), Edit, Reject.
  - Icon or badge to show `edited` state.
- **Events**:
  - `Accept` click → `onAccept(tempId)`.
  - `Reject` click → `onReject(tempId)`.
  - `Edit` click → open `FlashcardEditModal`.
- **Validation**: none
- **Types**: `FlashcardProposalUi`.
- **Props**:

```ts
interface FlashcardListItemProps {
  proposal: FlashcardProposalUi;
  onAccept(id: string): void;
  onReject(id: string): void;
  onEdit(id: string, values: EditProposalFormValues): void;
}
```

### FlashcardEditModal

- **Description**: Modal dialog to edit flashcard content.
- **HTML / Children**: a dialog with inputs (`<textarea>` front/back), Confirm & Cancel buttons.
- **Events**:
  - `Confirm` click → `onConfirm(id, values)`.
  - `Cancel` click → `onClose()`.
- **Validation**:
  - Zod schema enforces front ≤200 and back ≤500 chars; shows validation errors below fields; confirmation button disabled when validation fails.
- **Types**: `EditProposalFormValues`.
- **Props**:

```ts
interface FlashcardEditModalProps {
  // In the future the same dialog will be used not only for editing proposals but also for editing existing flashcards
  proposal: FlashcardProposalUi | FlashcardDetailResponseDto;
  onConfirm(id: string, values: EditProposalFormValues): void;
  onClose(): void;
}
```

### ControlBar

- **Description**: A bar below the flashcard list providing buttons for saving accepted flashcards, saving all flashcards, and resetting whole view.
- **HTML / Children**: a container with three mentioned buttons + optional `InlineErrorMessage`.
- **Events**:
  - `onSaveAccepted` / `onSaveAll` / `onReset` click.
- **Validation**:
  - Disable `Save accepted` when `acceptedCount === 0`.
  - Disable `Save all` when `nonRejectedCount === 0`.
  - Disable all buttons while `isSaving`.
- **Types**: none.
- **Props**:

```ts
interface ControlBarProps {
  acceptedCount: number;
  nonRejectedCount: number;
  isSaving: boolean;
  errorMessage?: string;
  onSaveAccepted(): void;
  onSaveAll(): void;
  onReset(): void;
}
```

## 5. Types

```ts
// AI proposal can be either unedited or edited before save
export type SourceAi = "ai-full" | "ai-edited";

// Type used by UI components (list item, modal, control bar)
export interface FlashcardProposalUi extends Omit<FlashcardProposalDto, "source"> {
  accepted: boolean;
  rejected: boolean;
  source: SourceAi;
}

export interface EditProposalFormValues {
  front: string; // ≤200
  back: string; // ≤500
}
```

Imports from `@/src/types.ts`: `CreateGenerationCommand`, `CreateGenerationResponseDto`, `CreateFlashcardsCommand`, `CreateFlashcardsResponseDto`, `FlashcardProposalDto`, `FlashcardDetailResponseDto`.

## 6. State Management

Most of the state lives in **`FlashcardGenerationView`** and is passed down via the props defined in Section&nbsp;4. For managing state we use React hooks and custom hooks for API calls. No React Context is required at this stage.

### 6.1 `FlashcardGenerationView`

| State           | Type                                                   | Purpose                                   |
| --------------- | ------------------------------------------------------ | ----------------------------------------- |
| `proposals`     | `FlashcardProposalUi[]`                                | List of generated proposals with UI flags |
| `processStatus` | `'initial' \| 'generating' \| 'generated' \| 'saving'` | Flow control for buttons & overlay        |

Additionally the following derived state is computed based on `proposals`:
| `acceptedCount` | `number` | Count of accepted proposals |
| `nonRejectedCount` | `number` | Count of proposals that are not rejected |

| Called hooks            | Responsibility                                                                 |
| ----------------------- | ------------------------------------------------------------------------------ |
| `useGenerateFlashcards` | Wraps POST `/generations` – returns `generate(text)` plus `isLoading`, `error` |
| `useCreateFlashcards`   | Wraps POST `/flashcards` – returns `create(payload)` plus `isLoading`, `error` |

### 6.2 Local component state

| Component            | Local state                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `SourceInputSection` | `sourceText`                                                        |
| `FlashcardListItem`  | none                                                                |
| `FlashcardEditModal` | form values & zod validation state (internal via `react-hook-form`) |

## 7. API Integration

### POST `/generations`

Called when user clicks "Generate" button

- Request: `CreateGenerationCommand` `{ source_text }`.
- Response: `CreateGenerationResponseDto`.
- Errors: 400/401/502/500 → show error message

### POST `/flashcards`

Called when user clicks "Save accepted" or "Save all" button

- Request: `CreateFlashcardsCommand` `{ flashcards }`.
- Response: `CreateFlashcardsResponseDto` → redirect to `/flashcards` on 201.
- Errors: 400/401/500 → show error message

## 8. User Interactions

- Typing/pasting text into textarea for sourceText -> triggers validation.
- Clicking "Generate" button → triggers POST `/generations` API call, shows overlay with loader; when finished, proposals appear or error message is displayed.
- For each proposal:
  - Clicking Accept button -> marks the proposal as accepted.
  - Clicking Edit button -> opens a modal; editing its inputs content triggers validation; after `Confirm` button is clicked, `front` and `back` are updated accordingly and `source` is set to `ai-edited`.
  - Clicking Reject button -> marks the proposal as rejected - it won't be shown on the list anymore.
- Clicking "Save accepted" or "Save all" buttons → triggers POST `/flashcards` API call, shows overlay with loader; when finished successfully redirects to `/flashcards`, otherwise error message is shown.
- Clicking "Reset" button → clear the whole view state.

## 9. Conditions & Validation

- Source text length 1 000–10 000 - otherwise `Generate` button is disabled.
- Proposal front ≤200, back ≤500 - otherwise `Confirm` button is disabled.
- Auth guard to access this view.
- Preventing interactions during async operations, showing Overlay.

## 10. Error Handling

- API calls errors: show `InlineErrorMessage`, keep payload data to let the user try again.
- Validation errors: show `InlineErrorMessage`.

## 11. Implementation Steps

All these implementation steps should be performed in line with all the requirements/specifications described in this document.

1. Page scaffold
   - Create `src/pages/generate.astro` guarded by `requireAuth` middleware.
   - Render `<RootAuthenticatedLayout><FlashcardGenerationView client:load /></RootAuthenticatedLayout>`.

2. Project structure
   - Add folder `src/components/generate/` containing:
     - `FlashcardGenerationView.tsx`
     - `SourceInputSection.tsx`
     - `FlashcardList.tsx`
     - `FlashcardListItem.tsx`
     - `FlashcardEditModal.tsx`
     - `ControlBar.tsx`

3. Implement shared UI helpers in `src/components/ui/`: `InlineErrorMessage` and `LoadingOverlay` - if reasonable use shadcn/ui components (preferred), but if this would be an overkill in this case, create own simple components.

4. Implement `SourceInputSection`

5. Implement `FlashcardEditModal`

6. Implement `FlashcardListItem`

7. Implement `FlashcardList` - responsive grid (1–4 cols) using CSS grid + Tailwind.

8. Implement `ControlBar`

9. Implement custom API hooks in `src/components/hooks`
   - `useGenerateFlashcards` → wraps POST `/generations`, returns `{ generate, isLoading, error }`.
   - `useCreateFlashcards` → wraps POST `/flashcards`, returns `{ create, isLoading, error }`.

10. Implement `FlashcardGenerationView`

11. Testing
    - Unit tests for all user interactions
