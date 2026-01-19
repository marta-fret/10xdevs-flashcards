import type { SupabaseClient } from "../../db/supabase.client";
import type { CreateFlashcardCommandItem, FlashcardDto } from "../../types";

export class FlashcardsService {
  constructor(private supabase: SupabaseClient) {}

  public async createFlashcards(userId: string, flashcards: CreateFlashcardCommandItem[]): Promise<FlashcardDto[]> {
    const { data, error } = await this.supabase.rpc("create_flashcards", {
      p_user_id: userId,
      p_flashcards: flashcards,
    });

    if (error) {
      // TODO: Improve error handling based on specific db errors
      throw new Error("Failed to create flashcards in database");
    }

    return data as FlashcardDto[];
  }
}
