import type { FlashcardSource, SortOrder, FlashcardsSortField } from "../../types";

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

export type FlashcardFormMode = "create" | "edit";
