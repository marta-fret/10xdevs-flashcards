import type { APIRoute } from "astro";
import { z } from "zod";
import type { CreateFlashcardsCommand } from "../../types";
import { DEFAULT_USER_ID, type SupabaseClient } from "../../db/supabase.client";
import { FlashcardsService } from "../../lib/services/flashcards.service";

const createFlashcardCommandItemSchema = z.object({
  front: z.string().trim().min(1).max(200),
  back: z.string().trim().min(1).max(500),
  source: z.enum(["ai-full", "ai-edited", "manual"]),
  // Ensure generation_id is either a number or explicitly null, never undefined.
  generation_id: z.union([z.number(), z.null()]),
});

const createFlashcardsCommandSchema = z
  .object({
    flashcards: z.array(createFlashcardCommandItemSchema).min(1),
  })
  .refine(
    (data) => {
      for (const fc of data.flashcards) {
        if ((fc.source === "ai-full" || fc.source === "ai-edited") && fc.generation_id === null) {
          return false;
        }
        if (fc.source === "manual" && fc.generation_id !== null) {
          return false;
        }
      }
      return true;
    },
    {
      message: "generation_id is required for AI-generated flashcards and must be null for manual ones.",
    }
  );

type ErrorCode = "invalid_request" | "unauthorized" | "internal_error";

interface ErrorResponseBody {
  error: ErrorCode;
  message: string;
}

const jsonResponse = <T>(body: T, init?: number | ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: typeof init === "number" ? init : (init?.status ?? 200),
    headers: {
      "Content-Type": "application/json",
      ...(typeof init === "object" && init.headers ? init.headers : {}),
    },
  });

const errorResponse = (code: ErrorCode, message: string, status: number) =>
  jsonResponse<ErrorResponseBody>({ error: code, message }, status);

export const prerender = false;

interface LocalsWithSupabase {
  supabase: SupabaseClient;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase } = locals as LocalsWithSupabase;

  if (!supabase) {
    return errorResponse("internal_error", "Supabase client not available", 500);
  }

  const userId = DEFAULT_USER_ID;
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
