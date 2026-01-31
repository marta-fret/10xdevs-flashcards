import type { APIRoute } from "astro";
import { z } from "zod";
import type {
  ApiErrorResponse,
  DeleteFlashcardResponseDto,
  FlashcardDetailResponseDto,
  FlashcardsApiDeleteErrorCode,
  FlashcardsApiPatchErrorCode,
  UpdateFlashcardCommand,
} from "../../../types";
import { FlashcardsService } from "../../../lib/services/flashcards.service";
import { updateFlashcardCommandSchema } from "../../../lib/flashcardsUtils";
import { jsonResponse } from "../utils";

export const prerender = false;

const errorResponse = <T extends string>(code: T, message: string, status: number) =>
  jsonResponse<ApiErrorResponse<T>>({ error: { code, message } }, status);

const patchErrorResponse = errorResponse<FlashcardsApiPatchErrorCode>;
const deleteErrorResponse = errorResponse<FlashcardsApiDeleteErrorCode>;

const flashcardIdSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NaN;
    }
    return parsed;
  }
  return value;
}, z.number().int().min(1));

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const { supabase, user } = locals;

  if (!supabase) {
    return patchErrorResponse("internal_error", "Supabase client not available", 500);
  }

  const userId = user?.id;
  if (!userId) {
    return patchErrorResponse("unauthorized", "Authentication required", 401);
  }

  const rawId = params.id;
  const idParseResult = flashcardIdSchema.safeParse(rawId);
  if (!idParseResult.success) {
    const firstError = idParseResult.error.errors[0];
    return patchErrorResponse("invalid_request", firstError.message ?? "Invalid flashcard id", 400);
  }

  const id = idParseResult.data as number;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return patchErrorResponse("invalid_request", "Invalid JSON body", 400);
  }

  const bodyParseResult = updateFlashcardCommandSchema.safeParse(json);
  if (!bodyParseResult.success) {
    const firstError = bodyParseResult.error.errors[0];
    return patchErrorResponse("invalid_request", firstError.message ?? "Invalid request body", 400);
  }

  const command = bodyParseResult.data as UpdateFlashcardCommand;

  const flashcardsService = new FlashcardsService(supabase);

  try {
    const result = await flashcardsService.updateFlashcard(userId, id, command);

    if (result === null) {
      return patchErrorResponse("not_found", "Flashcard not found", 404);
    }

    return jsonResponse<FlashcardDetailResponseDto>(result, 200);
  } catch {
    return patchErrorResponse("internal_error", "Internal server error", 500);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { supabase, user } = locals;

  if (!supabase) {
    return deleteErrorResponse("internal_error", "Supabase client not available", 500);
  }

  const userId = user?.id;
  if (!userId) {
    return deleteErrorResponse("unauthorized", "Authentication required", 401);
  }

  const rawId = params.id;
  const idParseResult = flashcardIdSchema.safeParse(rawId);
  if (!idParseResult.success) {
    const firstError = idParseResult.error.errors[0];
    return deleteErrorResponse("invalid_request", firstError.message ?? "Invalid flashcard id", 400);
  }

  const id = idParseResult.data as number;

  const flashcardsService = new FlashcardsService(supabase);

  try {
    const deleted = await flashcardsService.deleteFlashcard(userId, id);

    if (!deleted) {
      return deleteErrorResponse("not_found", "Flashcard not found", 404);
    }

    return jsonResponse<DeleteFlashcardResponseDto>({ message: "flashcard_deleted" }, 200);
  } catch {
    return deleteErrorResponse("internal_error", "Internal server error", 500);
  }
};
