import type { APIRoute } from "astro";
import { z } from "zod";
import type { ApiErrorResponse, CreateGenerationCommand, GenerationsApiErrorCode } from "../../types";
import { GenerationService } from "../../lib/services/generation.service";
import { OpenRouterServiceError } from "../../lib/services/openrouter.service.error";
import { jsonResponse } from "./utils";

const createGenerationCommandSchema = z.object({
  source_text: z
    .string({ required_error: "source_text is required", invalid_type_error: "source_text must be a string" })
    .min(1000, "source_text must be between 1000 and 10000 characters")
    .max(10000, "source_text must be between 1000 and 10000 characters"),
});

type ErrorResponseBody = ApiErrorResponse<GenerationsApiErrorCode>;

const errorResponse = (code: GenerationsApiErrorCode, message: string, status: number) =>
  jsonResponse<ErrorResponseBody>({ error: { code, message } }, status);

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase, user } = locals;

  if (!supabase) {
    return errorResponse("internal_error", "Supabase client not available", 500);
  }

  // TODO: Replace with real authenticated user once auth middleware is wired.
  const userId = user?.id;
  if (!userId) {
    return errorResponse("unauthorized", "Authentication required", 401);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse("invalid_request", "Invalid JSON body", 400);
  }

  const parseResult = createGenerationCommandSchema.safeParse(json);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return errorResponse("invalid_request", firstError.message ?? "Invalid request body", 400);
  }

  const body = parseResult.data as CreateGenerationCommand;

  const service = new GenerationService(supabase);

  try {
    const result = await service.generateFlashcardProposals({
      source_text: body.source_text,
      userId,
    });

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof OpenRouterServiceError) {
      switch (error.code) {
        case "RATE_LIMITED":
          return errorResponse(
            "service_unavailable",
            "AI service is currently rate limited. Please try again later.",
            429
          );
        case "TIMEOUT":
        case "NETWORK_ERROR":
        case "UPSTREAM_ERROR":
        case "BAD_RESPONSE":
          return errorResponse("upstream_error", "AI service provider error", 502);
        case "AUTH_ERROR":
        case "CONFIG_ERROR":
          return errorResponse("internal_error", "AI service configuration error", 500);
        case "VALIDATION_ERROR":
        default:
          return errorResponse("internal_error", "Internal server error during generation", 500);
      }
    }

    const message = error && typeof error === "object" && "message" in error ? error.message : "unknown";
    // eslint-disable-next-line no-console
    console.error("[API] Unhandled generation error:", message);
    return errorResponse("internal_error", "Internal server error", 500);
  }
};
