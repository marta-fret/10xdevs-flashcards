import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import type { ApiErrorResponse, LoginCommand, LoginApiErrorCode } from "@/types.ts";
import { loginCommandSchema } from "@/lib/authUtils";
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

export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase } = locals as LocalsWithSupabase;

  if (!supabase) {
    return errorResponse("INTERNAL_ERROR", "Supabase client not available", 500);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidCredentialsResponse();
  }

  const parseResult = loginCommandSchema.safeParse(json);
  if (!parseResult.success) {
    return invalidCredentialsResponse();
  }

  const { email, password } = parseResult.data as LoginCommand;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
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
    // eslint-disable-next-line no-console
    console.error("[API] Unhandled login error:", message);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
};
