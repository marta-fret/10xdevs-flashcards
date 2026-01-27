import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import type { LoginCommand } from "@/types.ts";
import { loginCommandSchema } from "@/lib/authUtils";

export const prerender = false;

interface LocalsWithSupabase {
  supabase: SupabaseClient;
}

type LoginErrorCode = "INVALID_CREDENTIALS" | "INTERNAL_ERROR";

interface LoginErrorResponseBody {
  error: {
    code: LoginErrorCode;
    message: string;
  };
}

interface LoginSuccessResponseBody {
  data: {
    user_id: string;
    email: string | null;
  };
}

const jsonResponse = <T>(body: T, init?: number | ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: typeof init === "number" ? init : (init?.status ?? 200),
    headers: {
      "Content-Type": "application/json",
      ...(typeof init === "object" && init.headers ? init.headers : {}),
    },
  });

const errorResponse = (code: LoginErrorCode, message: string, status: number) =>
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
