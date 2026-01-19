// Summary: DTO and Command Model types for the REST API, derived from Supabase entities.

import type { Tables, TablesInsert, TablesUpdate } from "./db/database.types";

// --- Internal aliases to Supabase entities (non-exported) ---
// These keep all DTO and command models strongly connected to the underlying DB schema.
type FlashcardRow = Tables<"flashcards">;
type FlashcardInsertRow = TablesInsert<"flashcards">;
type FlashcardUpdateRow = TablesUpdate<"flashcards">;

type GenerationRow = Tables<"generations">;
type GenerationErrorLogRow = Tables<"generation_error_logs">;

// --- Shared helper types ---

export type FlashcardSource = "ai-full" | "ai-edited" | "manual";

export type AiFlashcardSource = Extract<FlashcardSource, "ai-full" | "ai-edited">;

export type SortOrder = "asc" | "desc";

export interface PaginationMetaDto {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

// --- Flashcards DTOs & Commands ---

// Narrow the DB row for API exposure: we explicitly list exposed fields and
// override `source` with a stricter union type.
export type FlashcardDto = Pick<
  FlashcardRow,
  "id" | "front" | "back" | "generation_id" | "created_at" | "updated_at"
> & {
  source: FlashcardSource;
};

export type FlashcardListItemDto = FlashcardDto;

export type FlashcardsSortField = "created_at" | "updated_at";

// Command model for GET /flashcards query parameters.
export interface FlashcardsListQueryCommand {
  page?: number;
  limit?: number;
  q?: string;
  sort?: FlashcardsSortField;
  order?: SortOrder;
  // Optional filter based on flashcard source.
  source?: FlashcardSource;
}

// Response DTO for GET /flashcards.
export interface FlashcardsListResponseDto {
  items: FlashcardListItemDto[];
  pagination: PaginationMetaDto;
}

// Command model item for POST /flashcards.
// Derived from Insert row: user_id, id, timestamps are server-controlled.
export type CreateFlashcardCommandItem = Pick<FlashcardInsertRow, "front" | "back"> & {
  source: FlashcardSource;
  generation_id: Exclude<FlashcardInsertRow["generation_id"], undefined>;
};

// Command model for POST /flashcards body.
export interface CreateFlashcardsCommand {
  flashcards: CreateFlashcardCommandItem[];
}

// Response DTO for POST /flashcards.
export interface CreateFlashcardsResponseDto {
  flashcards: FlashcardDto[];
}

// Command model for PATCH /flashcards/:id body.
// Uses Update row so partial updates are naturally supported by TS.
export type UpdateFlashcardCommand = Pick<FlashcardUpdateRow, "front" | "back">;

// Response DTO for GET /flashcards/:id and PATCH /flashcards/:id.
export type FlashcardDetailResponseDto = FlashcardDto;

// Response DTO for DELETE /flashcards/:id.
export interface DeleteFlashcardResponseDto {
  message: string;
}

// --- Generations DTOs & Commands ---

// Command model for POST /generations.
export interface CreateGenerationCommand {
  source_text: string;
}

// DTO for AI flashcard proposals returned by POST /generations.
// front/back come from the flashcard insert shape, but these are not yet
// persisted flashcards, only proposals.
export type FlashcardProposalDto = Pick<FlashcardInsertRow, "front" | "back"> & {
  temp_id: string;
  // Proposals are always full AI suggestions.
  source: Extract<FlashcardSource, "ai-full">;
};

// Response DTO for POST /generations.
export interface CreateGenerationResponseDto {
  generation_id: GenerationRow["id"];
  flashcards_proposals: FlashcardProposalDto[];
  generated_count: GenerationRow["generated_count"];
}

// Summary view of a generation, used in list and detail endpoints.
export type GenerationSummaryDto = Pick<
  GenerationRow,
  | "id"
  | "model"
  | "generated_count"
  | "accepted_unedited_count"
  | "accepted_edited_count"
  | "source_text_length"
  | "generation_duration"
  | "created_at"
  | "updated_at"
>;

export type GenerationsSortField = "created_at" | "generation_duration";

// Command model for GET /generations query parameters.
export interface GenerationsListQueryCommand {
  page?: number;
  limit?: number;
  sort?: GenerationsSortField;
  order?: SortOrder;
}

// Response DTO for GET /generations.
export interface GenerationsListResponseDto {
  items: GenerationSummaryDto[];
  pagination: PaginationMetaDto;
}

// Flashcards attached to a generation in GET /generations/:id.
// These are a specialization of FlashcardDto:
// - source is restricted to AI-derived values
// - generation_id is guaranteed to be non-null
export type GenerationFlashcardDto = Pick<FlashcardDto, "id" | "front" | "back" | "created_at" | "updated_at"> & {
  source: AiFlashcardSource;
  generation_id: NonNullable<FlashcardRow["generation_id"]>;
};

// Response DTO for GET /generations/:id.
export interface GenerationDetailResponseDto {
  generation: GenerationSummaryDto;
  flashcards: GenerationFlashcardDto[];
}

// --- Generation Error Logs DTOs ---

// API-facing representation of generation error logs.
export type GenerationErrorLogDto = GenerationErrorLogRow;

// Response DTO for GET /generation-error-logs.
export type GenerationErrorLogsListResponseDto = GenerationErrorLogDto[];
