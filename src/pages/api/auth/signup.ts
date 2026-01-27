import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import type { SignupCommand } from "@/types.ts";
import { signupCommandSchema } from "@/lib/authUtils";
import { jsonResponse } from "../utils";

export const prerender = false;

interface LocalsWithSupabase {
  supabase: SupabaseClient;
}

type AuthErrorCode = "VALIDATION_ERROR" | "EMAIL_ALREADY_REGISTERED" | "INTERNAL_ERROR";

interface AuthErrorResponseBody {
  error: {
    code: AuthErrorCode;
    message: string;
  };
}

interface SignupSuccessResponseBody {
  data: {
    user_id: string;
    email: string | null;
  };
}

const errorResponse = (code: AuthErrorCode, message: string, status: number) =>
  jsonResponse<AuthErrorResponseBody>({ error: { code, message } }, status);

export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase } = locals as LocalsWithSupabase;

  if (!supabase) {
    return errorResponse("INTERNAL_ERROR", "Supabase client not available", 500);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parseResult = signupCommandSchema.safeParse(json);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return errorResponse("VALIDATION_ERROR", firstError?.message ?? "Invalid form data", 400);
  }

  const { email, password } = parseResult.data as SignupCommand;

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error || !data?.user) {
      const message = error?.message ?? "Unable to create user";
      const normalized = message.toLowerCase();

      if (normalized.includes("already registered") || normalized.includes("already exists")) {
        return errorResponse("EMAIL_ALREADY_REGISTERED", "This email is already registered", 409);
      }

      // Generic internal error for other Supabase failures
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
    // eslint-disable-next-line no-console
    console.error("[API] Unhandled signup error:", message);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
};
