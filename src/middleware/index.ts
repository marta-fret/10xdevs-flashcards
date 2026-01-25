import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerInstance } from "../db/supabase.client.ts";

// Publicly accessible routes that must not require an authenticated user.
// - /login: authentication page (login + sign-up)
// - /api/auth/*: auth endpoints that can be called without an existing session
const PUBLIC_PATHS: string[] = ["/login", "/api/auth/signup", "/api/auth/login"];

export const onRequest = defineMiddleware(async ({ locals, cookies, request, url, redirect }, next) => {
  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
  });

  // IMPORTANT: Always get user session first before any other operations
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    locals.user = {
      email: user.email ?? null,
      id: user.id,
    };
  } else if (!PUBLIC_PATHS.includes(url.pathname)) {
    // Redirect to login for protected routes
    return redirect("/login");
  }

  locals.supabase = supabase;

  return next();
});
