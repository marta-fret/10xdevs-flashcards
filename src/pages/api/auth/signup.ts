import type { APIRoute } from "astro";
import { z } from "zod";
import type { SupabaseClient } from "../../../db/supabase.client.ts";

export const prerender = false;

interface LocalsWithSupabase {
  supabase: SupabaseClient;
}

const signupSchema = z
  .object({
    email: z
      .string({ required_error: "email is required", invalid_type_error: "email must be a string" })
      .email("Enter a valid email address"),
    password: z
      .string({ required_error: "password is required", invalid_type_error: "password must be a string" })
      .min(12, "Password must be at least 12 characters long and include at least one number and one special character")
      .refine((value) => /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value), {
        message:
          "Password must be at least 12 characters long and include at least one number and one special character",
        path: ["password"],
      }),
    repeatPassword: z.string({
      required_error: "repeatPassword is required",
      invalid_type_error: "repeatPassword must be a string",
    }),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "Passwords do not match",
    path: ["repeatPassword"],
  });

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

const jsonResponse = <T>(body: T, init?: number | ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: typeof init === "number" ? init : (init?.status ?? 200),
    headers: {
      "Content-Type": "application/json",
      ...(typeof init === "object" && init.headers ? init.headers : {}),
    },
  });

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

  const parseResult = signupSchema.safeParse(json);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return errorResponse("VALIDATION_ERROR", firstError?.message ?? "Invalid form data", 400);
  }

  const { email, password } = parseResult.data;

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
