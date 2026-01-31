import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import type { ApiErrorResponse, LogoutApiErrorCode } from "@/types.ts";
import { createErrorLogger } from "@/lib/utils";
import { jsonResponse } from "../utils";

export const prerender = false;

interface LocalsWithSupabase {
  supabase: SupabaseClient;
}

type LogoutErrorResponseBody = ApiErrorResponse<LogoutApiErrorCode>;

interface LogoutSuccessResponseBody {
  data: null;
}

const errorResponse = (code: LogoutApiErrorCode, message: string, status: number) =>
  jsonResponse<LogoutErrorResponseBody>({ error: { code, message } }, status);

const logError = createErrorLogger("[API logout]");

export const POST: APIRoute = async ({ locals }) => {
  const { supabase } = locals as LocalsWithSupabase;

  if (!supabase) {
    logError("Supabase client not available");
    return errorResponse("INTERNAL_ERROR", "Supabase client not available", 500);
  }

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      logError("Supabase logout failed: " + error?.message);
      return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
    }

    return jsonResponse<LogoutSuccessResponseBody>({ data: null }, 200);
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "unknown";
    logError("Unhandled logout error: " + message);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
};
