import type { APIRoute } from "astro";
import type {
  ApiErrorResponse,
  CreateFlashcardsCommand,
  FlashcardsApiErrorCode,
  FlashcardsListQueryCommand,
  FlashcardsListResponseDto,
} from "../../types";
import { FlashcardsService } from "../../lib/services/flashcards.service";
import { createFlashcardsCommandSchema, flashcardsListQuerySchema } from "../../lib/flashcardsUtils";
import { jsonResponse } from "./utils";

type ErrorResponseBody = ApiErrorResponse<FlashcardsApiErrorCode>;

const errorResponse = (code: FlashcardsApiErrorCode, message: string, status: number) =>
  jsonResponse<ErrorResponseBody>({ error: { code, message } }, status);

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase, user } = locals;

  if (!supabase) {
    return errorResponse("internal_error", "Supabase client not available", 500);
  }

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

  const parseResult = createFlashcardsCommandSchema.safeParse(json);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return errorResponse("invalid_request", firstError.message ?? "Invalid request body", 400);
  }

  const body = parseResult.data as CreateFlashcardsCommand;

  const flashcardsService = new FlashcardsService(supabase);

  try {
    const result = await flashcardsService.createFlashcards(userId, body.flashcards);
    return jsonResponse({ flashcards: result }, 201);
  } catch {
    // TODO: Add more specific error handling
    return errorResponse("internal_error", "Internal server error", 500);
  }
};

export const GET: APIRoute = async ({ request, locals }) => {
  const { supabase, user } = locals;

  if (!supabase) {
    return errorResponse("internal_error", "Supabase client not available", 500);
  }

  const userId = user?.id;
  if (!userId) {
    return errorResponse("unauthorized", "Authentication required", 401);
  }

  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());

  const parseResult = flashcardsListQuerySchema.safeParse(searchParams);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return errorResponse("invalid_request", firstError.message ?? "Invalid query parameters", 400);
  }

  const query = parseResult.data as FlashcardsListQueryCommand;

  const flashcardsService = new FlashcardsService(supabase);

  try {
    const result = await flashcardsService.listFlashcards(userId, query);
    return jsonResponse<FlashcardsListResponseDto>(result, 200);
  } catch {
    return errorResponse("internal_error", "Internal server error", 500);
  }
};
