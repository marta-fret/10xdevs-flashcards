import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import type { ApiErrorResponse, LoginCommand, LoginApiErrorCode } from "@/types.ts";
import { loginCommandSchema } from "@/lib/authUtils";
import { createErrorLogger } from "@/lib/utils";
import { jsonResponse } from "../utils";

export const prerender = false;

interface LocalsWithSupabase {
  supabase: SupabaseClient;
}

type LoginErrorResponseBody = ApiErrorResponse<LoginApiErrorCode>;

interface LoginSuccessResponseBody {
  data: {
    user_id: string;
    email: string | null;
  };
}

const errorResponse = (code: LoginApiErrorCode, message: string, status: number) =>
  jsonResponse<LoginErrorResponseBody>({ error: { code, message } }, status);

const invalidCredentialsResponse = () => errorResponse("INVALID_CREDENTIALS", "Incorrect credentials", 401);

const logError = createErrorLogger("[API login]");

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
    return invalidCredentialsResponse();
  }

  const parseResult = loginCommandSchema.safeParse(json);
  if (!parseResult.success) {
    logError("Invalid form data");
    return invalidCredentialsResponse();
  }

  const { email, password } = parseResult.data as LoginCommand;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      logError("Supabase login failed");
      return invalidCredentialsResponse();
    }

    return jsonResponse<LoginSuccessResponseBody>({
      data: {
        user_id: data.user.id,
        email: data.user.email ?? null,
      },
    });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "unknown";
    logError("Unhandled login error: " + message);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
};
