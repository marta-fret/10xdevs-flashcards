import type {
  CreateFlashcardCommandItem,
  FlashcardDto,
  FlashcardsListQueryCommand,
  FlashcardsListResponseDto,
  FlashcardListItemDto,
  UpdateFlashcardCommand,
  FlashcardDetailResponseDto,
  FlashcardSource,
} from "../../types";
import type { SupabaseClient } from "../../db/supabase.client";
import { createErrorLogger } from "../utils";

const logError = createErrorLogger("FlashcardsService");

export class FlashcardsService {
  constructor(private supabase: SupabaseClient) {}

  public async createFlashcards(userId: string, flashcards: CreateFlashcardCommandItem[]): Promise<FlashcardDto[]> {
    const { data, error } = await this.supabase.rpc("create_flashcards", {
      p_user_id: userId,
      p_flashcards: flashcards,
    });

    if (error) {
      logError(
        `Failed to create flashcards in database for userId=${userId}: ${error.message ?? "Unknown database error"}`
      );
      throw new Error("Failed to create flashcards in database");
    }

    return data as FlashcardDto[];
  }

  public async listFlashcards(userId: string, query: FlashcardsListQueryCommand): Promise<FlashcardsListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const sortField = query.sort ?? "created_at";
    const sortOrder = query.order ?? "desc";

    const { data, error, count } = await this.supabase
      .from("flashcards")
      .select("id, front, back, source, generation_id, created_at, updated_at", { count: "exact" })
      .eq("user_id", userId)
      .order(sortField, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    if (error) {
      logError(
        `Failed to list flashcards from database for userId=${userId}: ${error.message ?? "Unknown database error"}`
      );
      throw new Error("Failed to list flashcards from database");
    }

    const items = (data ?? []) as FlashcardListItemDto[];
    const totalItems = count ?? 0;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  public async updateFlashcard(
    userId: string,
    id: number,
    command: UpdateFlashcardCommand
  ): Promise<FlashcardDetailResponseDto | null> {
    const { data: existing, error: fetchError } = await this.supabase
      .from("flashcards")
      .select("id, front, back, source, generation_id, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      logError(
        `Failed to load flashcard for update from database for userId=${userId}, flashcardId=${id}: ${
          fetchError.message ?? "Unknown database error"
        }`
      );
      throw new Error("Failed to load flashcard for update");
    }

    if (!existing) {
      return null;
    }

    const updatePayload: { front?: string; back?: string; source?: FlashcardSource } = {};

    const { front, back } = command;
    const frontChanged = front !== undefined && front !== existing.front;
    const backChanged = back !== undefined && back !== existing.back;

    if (frontChanged) {
      updatePayload.front = front as string;
    }

    if (backChanged) {
      updatePayload.back = back as string;
    }

    if (existing.source === "ai-full" && (frontChanged || backChanged)) {
      updatePayload.source = "ai-edited";
    }

    const shouldUpdate = Object.keys(updatePayload).length > 0;
    if (!shouldUpdate) {
      return existing as FlashcardDetailResponseDto;
    }

    const { data: updated, error: updateError } = await this.supabase
      .from("flashcards")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, front, back, source, generation_id, created_at, updated_at")
      .maybeSingle();

    if (updateError) {
      logError(
        `Failed to update flashcard in database for userId=${userId}, flashcardId=${id}: ${
          updateError.message ?? "Unknown database error"
        }`
      );
      throw new Error("Failed to update flashcard in database");
    }

    if (!updated) {
      return null;
    }

    const updatedFlashcard = updated as FlashcardDetailResponseDto;

    const hadGeneration = existing.generation_id !== null;
    const sourceChangedFromAiFullToAiEdited = existing.source === "ai-full" && updatedFlashcard.source === "ai-edited";

    if (hadGeneration && sourceChangedFromAiFullToAiEdited) {
      const generationId = existing.generation_id as number;

      try {
        const { data: generation, error: generationFetchError } = await this.supabase
          .from("generations")
          .select("accepted_unedited_count, accepted_edited_count, generated_count")
          .eq("id", generationId)
          .eq("user_id", userId)
          .maybeSingle();

        if (generationFetchError || !generation) {
          logError(
            `Failed to load generation for analytics update: generationId=${generationId}, flashcardId=${id}, reason=${
              generationFetchError?.message ?? "Unknown database error or missing generation"
            }`
          );
        } else {
          const acceptedUnedited = generation.accepted_unedited_count ?? 0;
          const acceptedEdited = generation.accepted_edited_count ?? 0;
          const generatedCount = generation.generated_count ?? 0;

          const { error: generationUpdateError } = await this.supabase
            .from("generations")
            .update({
              // Math.max and Math.min are needed in case generation data was corrupted because of previous updates failures
              accepted_unedited_count: Math.max(0, acceptedUnedited - 1),
              accepted_edited_count: Math.min(generatedCount, acceptedEdited + 1),
            })
            .eq("id", generationId)
            .eq("user_id", userId);

          if (generationUpdateError) {
            logError(
              `Failed to update generation analytics counters: generationId=${generationId}, flashcardId=${id}, reason=${
                generationUpdateError.message ?? "Unknown database error"
              }`
            );
          }
        }
      } catch (error) {
        logError(
          `Unexpected error while updating generation analytics counters: generationId=${existing.generation_id}, flashcardId=${id}, reason=${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return updatedFlashcard;
  }

  public async deleteFlashcard(userId: string, id: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("flashcards")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      logError(
        `Failed to delete flashcard from database for userId=${userId}, flashcardId=${id}: ${
          error.message ?? "Unknown database error"
        }`
      );
      throw new Error("Failed to delete flashcard from database");
    }

    return data ? true : false;
  }
}
