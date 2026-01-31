import type {
  CreateFlashcardCommandItem,
  FlashcardDto,
  FlashcardsListQueryCommand,
  FlashcardsListResponseDto,
  FlashcardListItemDto,
} from "../../types";
import type { SupabaseClient } from "../../db/supabase.client";

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
}
