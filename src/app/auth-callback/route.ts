import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Handles the redirect from Supabase email-confirmation / magic links.
// Exchanges the ?code= for a session, then sends the user on to a sensible
// next stop. New staff land on /sign-up/mfa to finish enrollment; everyone
// else lands on / (the dashboard).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/sign-up/mfa";

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const dest = new URL("/sign-in", request.url);
    dest.searchParams.set("error", error.message);
    return NextResponse.redirect(dest);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
