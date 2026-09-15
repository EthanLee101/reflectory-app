import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE code-exchange endpoint for OAuth sign-in (Google). Supabase redirects
 * here with a `code` after the provider consent screen; exchanging it sets
 * the session cookies via the SSR client.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Vercel puts a load balancer in front of production, so `origin` can
      // report the internal host — prefer the forwarded host when present.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (!isLocalEnv && forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}/journal`);
      }
      return NextResponse.redirect(`${origin}/journal`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
