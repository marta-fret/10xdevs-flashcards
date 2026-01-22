import { createHash } from "node:crypto";
import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CreateGenerationCommand,
  CreateGenerationResponseDto,
  FlashcardProposalDto,
  GenerationErrorLogDto,
} from "../../types";
import { OpenRouterService } from "./openrouter.service";
import { OpenRouterServiceError, type OpenRouterResponseFormat } from "./openrouter.types";

export interface GenerateFlashcardProposalsParams extends CreateGenerationCommand {
  userId: string;
}

const FLASHCARDS_RESPONSE_SCHEMA: OpenRouterResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "flashcards_response",
    schema: {
      type: "object",
      properties: {
        flashcards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              front: { type: "string", description: "Front of the flashcard" },
              back: { type: "string", description: "Back of the flashcard" },
            },
            required: ["front", "back"],
            additionalProperties: false,
          },
        },
      },
      required: ["flashcards"],
      additionalProperties: false,
    },
  },
};

export class GenerationService {
  private readonly supabase: SupabaseClient;
  private readonly model = "openai/gpt-4o-mini" as const;
  private readonly openRouter: OpenRouterService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;

    const apiKey = import.meta.env.OPENROUTER_API_KEY || "";

    this.openRouter = new OpenRouterService({
      apiKey,
      model: this.model,
    });

    this.openRouter.setSystemMessage(
      "You are a helpful assistant that generates flashcards from provided text. " +
        "Extract key concepts and facts. Create clear, concise questions and answers. " +
        "Return the output in JSON format with a 'flashcards' array."
    );
    this.openRouter.setResponseFormat(FLASHCARDS_RESPONSE_SCHEMA);
  }

  async generateFlashcardProposals(params: GenerateFlashcardProposalsParams): Promise<CreateGenerationResponseDto> {
    const { source_text, userId } = params;

    const startedAt = performance.now();

    let proposals: FlashcardProposalDto[];

    try {
      proposals = await this.callOpenRouter(source_text);
    } catch (error) {
      if (error instanceof OpenRouterServiceError) {
        await this.storeOpenRouterError({ userId, source_text, error });
      }
      throw error;
    }

    const durationMs = Math.round(performance.now() - startedAt);

    const { data, error } = await this.supabase
      .from("generations")
      .insert({
        user_id: userId,
        model: this.model,
        generated_count: proposals.length,
        accepted_unedited_count: null,
        accepted_edited_count: null,
        source_text_length: source_text.length,
        source_text_hash: await this.hashSourceText(source_text),
        generation_duration: durationMs,
      })
      .select("id, generated_count")
      .single();

    if (error || !data) {
      throw new Error("Failed to insert generation record");
    }

    return {
      generation_id: data.id,
      flashcards_proposals: proposals,
      generated_count: data.generated_count,
    };
  }

  private async hashSourceText(source_text: string): Promise<string> {
    return createHash("md5").update(source_text, "utf8").digest("hex");
  }

  private async storeError(payload: Omit<GenerationErrorLogDto, "id" | "created_at">): Promise<void> {
    const { error } = await this.supabase.from("generation_error_logs").insert(payload);
    if (error) {
      // Intentionally swallow error to avoid masking the original failure.
      // In a real-world setup we might forward this to an external logger.
      // eslint-disable-next-line no-console
      console.error("Failed to store generation error:", error);
    }
  }

  private async callOpenRouter(sourceText: string): Promise<FlashcardProposalDto[]> {
    const { parsedJson } = await this.openRouter.chat({
      userMessage: `Generate flashcards from the following text:\n\n${sourceText}`,
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (parsedJson as any).flashcards.map((card: any) => ({
        temp_id: crypto.randomUUID(),
        front: card.front,
        back: card.back,
        source: "ai-full",
      }));
    } catch {
      throw new OpenRouterServiceError("BAD_RESPONSE", "Invalid response structure");
    }
  }

  private async storeOpenRouterError(params: {
    userId: string;
    source_text: string;
    error: OpenRouterServiceError;
  }): Promise<void> {
    const { userId, source_text, error } = params;

    const maxMessageLength = 500;
    const rawMessage = error.message || "Upstream AI provider error";
    const truncatedMessage = rawMessage.length > maxMessageLength ? rawMessage.slice(0, maxMessageLength) : rawMessage;

    const payload: Omit<GenerationErrorLogDto, "id" | "created_at"> = {
      user_id: userId,
      model: this.model,
      source_text_hash: await this.hashSourceText(source_text),
      source_text_length: source_text.length,
      error_code: error.code,
      error_message: truncatedMessage,
    };

    await this.storeError(payload);
  }
}
