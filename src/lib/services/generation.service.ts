import { createHash } from "node:crypto";
import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CreateGenerationCommand,
  CreateGenerationResponseDto,
  FlashcardProposalDto,
  GenerationErrorLogDto,
} from "../../types";

export class OpenRouterError extends Error {
  public readonly code: string;

  constructor(message: string, code = "upstream_error") {
    super(message);
    this.name = "OpenRouterError";
    this.code = code;
  }
}

export interface GenerateFlashcardProposalsParams extends CreateGenerationCommand {
  userId: string;
}

export class GenerationService {
  private readonly supabase: SupabaseClient;
  private readonly model = "openai/gpt-4o-mini" as const;
  private readonly timeoutMs = 60_000;
  private readonly useRealOpenRouter = false;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // NOTE: For now this method uses a mocked LLM call.
  // In a later iteration we will replace the mock with a real OpenRouter HTTP request.
  async generateFlashcardProposals(params: GenerateFlashcardProposalsParams): Promise<CreateGenerationResponseDto> {
    const { source_text, userId } = params;

    const startedAt = performance.now();

    let proposals: FlashcardProposalDto[];

    if (this.useRealOpenRouter) {
      try {
        proposals = await this.callOpenRouter(source_text);
      } catch (error) {
        if (error instanceof OpenRouterError) {
          await this.logOpenRouterError({ userId, source_text, error });
        }

        throw error;
      }
    } else {
      proposals = await this.generateMockProposals(source_text);
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

  private async logError(payload: Omit<GenerationErrorLogDto, "id" | "created_at">): Promise<void> {
    const { error } = await this.supabase.from("generation_error_logs").insert(payload);
    if (error) {
      // Intentionally swallow error to avoid masking the original failure.
      // In a real-world setup we might forward this to an external logger.
    }
  }

  private async generateMockProposals(sourceText: string): Promise<FlashcardProposalDto[]> {
    // Simulate upstream latency so that the caller can be exercised with async behaviour.
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    const proposals: FlashcardProposalDto[] = [
      {
        temp_id: crypto.randomUUID(),
        front: "Example question generated from source text",
        back: `Example answer based on the provided source text (length: ${sourceText.length} characters).`,
        source: "ai-full",
      },
    ];

    return proposals;
  }

  private async callOpenRouter(_sourceText: string): Promise<FlashcardProposalDto[]> {
    // Real OpenRouter integration will be implemented in a future iteration.
    // For now this method is intentionally disabled and will only be
    // reachable once `useRealOpenRouter` is set to true.
    throw new OpenRouterError("Real OpenRouter integration is not enabled in this environment.");
  }

  private async logOpenRouterError(params: {
    userId: string;
    source_text: string;
    error: OpenRouterError;
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

    await this.logError(payload);
  }
}
