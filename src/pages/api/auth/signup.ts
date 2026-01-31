import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import type { ApiErrorResponse, SignupApiErrorCode, SignupCommand } from "@/types.ts";
import { signupCommandSchema } from "@/lib/authUtils";
import { createErrorLogger } from "@/lib/utils";
import { jsonResponse } from "../utils";

export const prerender = false;

interface LocalsWithSupabase {
  supabase: SupabaseClient;
}

type SignupErrorResponseBody = ApiErrorResponse<SignupApiErrorCode>;

interface SignupSuccessResponseBody {
  data: {
    user_id: string;
    email: string | null;
  };
}

const errorResponse = (code: SignupApiErrorCode, message: string, status: number) =>
  jsonResponse<SignupErrorResponseBody>({ error: { code, message } }, status);

const logError = createErrorLogger("[API signup]");

export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase } = locals as LocalsWithSupabase;

  if (!supabase) {
    logError("Supabase client not available");
    return errorResponse("INTERNAL_ERROR", "Supabase client not available", 500);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    logError("Invalid JSON body");
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parseResult = signupCommandSchema.safeParse(json);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    const message = firstError?.message ?? "Invalid form data";
    logError("Invalid form data: " + message);
    return errorResponse("VALIDATION_ERROR", message, 400);
  }

  const { email, password } = parseResult.data as SignupCommand;

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error || !data?.user) {
      const message = error?.message ?? "Unable to create user";
      const normalized = message.toLowerCase();

      if (normalized.includes("already registered") || normalized.includes("already exists")) {
        const message = "This email is already registered";
        logError("Email already registered, " + message);
        return errorResponse("EMAIL_ALREADY_REGISTERED", message, 409);
      }

      // Generic internal error for other Supabase failures
      logError("Unhandled signup error: " + message);
      return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
    }

    return jsonResponse<SignupSuccessResponseBody>(
      {
        data: {
          user_id: data.user.id,
          email: data.user.email ?? null,
        },
      },
      201
    );
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "unknown";
    logError("Unhandled signup error: " + message);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
};
