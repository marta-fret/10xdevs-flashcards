import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { ApiErrorResponse, LoginApiErrorCode } from "@/types";
import { POST } from "./login";
import type { AuthTokenResponsePassword } from "@supabase/supabase-js";

interface SupabaseAuthSignInResult {
  data: {
    user: {
      id: string;
      email: string | null;
    } | null;
  } | null;
  error: { message?: string } | null;
}

const createSupabaseMock = () => {
  return {
    auth: {
      signInWithPassword:
        vi.fn<(parameters: { email: string; password: string }) => Promise<AuthTokenResponsePassword>>(),
    },
  } as unknown as SupabaseClient;
};

const parseErrorResponse = async (response: Response) => {
  const body = (await response.json()) as ApiErrorResponse<LoginApiErrorCode>;
  return body.error;
};

describe("POST /api/auth/login", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    supabase = createSupabaseMock();
  });

  const callPost = (body: unknown, options?: { supabaseOverride?: SupabaseClient; rawBody?: boolean }) => {
    const requestBody = options?.rawBody ? (body as string) : JSON.stringify(body);

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    return POST({
      request,
      locals: { supabase: options?.supabaseOverride ?? supabase } as { supabase: SupabaseClient },
    } as Parameters<typeof POST>[0]);
  };

  it("returns 200 and user data on successful login", async () => {
    const signInMock = supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>;

    signInMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "user@example.com",
        },
      },
      error: null,
    } satisfies SupabaseAuthSignInResult);

    const response = await callPost({ email: "user@example.com", password: "password123" });

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { user_id: string; email: string | null };
    };

    expect(body.data.user_id).toBe("user-123");
    expect(body.data.email).toBe("user@example.com");
    expect(signInMock).toHaveBeenCalledWith({ email: "user@example.com", password: "password123" });
  });

  it("returns 401 INVALID_CREDENTIALS when Supabase returns an error", async () => {
    const signInMock = supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>;

    signInMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    } satisfies SupabaseAuthSignInResult);

    const response = await callPost({ email: "user@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);

    const error = await parseErrorResponse(response);
    expect(error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 INVALID_CREDENTIALS for invalid JSON body", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "this is not valid json",
    });

    const response = await POST({
      request,
      locals: { supabase } as { supabase: SupabaseClient },
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(401);

    const error = await parseErrorResponse(response);
    expect(error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 INVALID_CREDENTIALS for invalid payload (fails schema validation)", async () => {
    const response = await callPost({ email: "", password: "" });

    expect(response.status).toBe(401);

    const error = await parseErrorResponse(response);
    expect(error.code).toBe("INVALID_CREDENTIALS");

    const signInMock = supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>;
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("returns 500 INTERNAL_ERROR when Supabase client is not available", async () => {
    const response = await POST({
      request: new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      }),
      locals: {} as { supabase?: SupabaseClient },
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(500);

    const error = await parseErrorResponse(response);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe("Supabase client not available");
  });

  it("returns 500 INTERNAL_ERROR when Supabase throws an unexpected error", async () => {
    const signInMock = supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>;

    signInMock.mockRejectedValue(new Error("Unexpected failure"));

    const response = await callPost({ email: "user@example.com", password: "password123" });

    expect(response.status).toBe(500);

    const error = await parseErrorResponse(response);
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});
