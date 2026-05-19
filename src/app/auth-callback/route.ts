import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Handles the redirect from Supabase email links (password reset, email
// confirmation, magic links) and signs the user in.
//
// Two link styles are supported:
//   • token_hash + type — verifyOtp. Needs no browser-stored verifier, so
//     it works even when the link is opened in a different browser from
//     the one that started the flow (e.g. an email app's in-app browser).
//     Password-reset emails use this.
//   • code — exchangeCodeForSession (PKCE). Kept for older links.
//
// New staff land on /sign-up/mfa to finish enrolment; ?next= overrides it.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/sign-up/mfa";

  const supabase = createSupabaseServerClient();

  function fail(message: string) {
    const dest = new URL("/sign-in", request.url);
    dest.searchParams.set("error", message);
    return NextResponse.redirect(dest);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) return fail(error.message);
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/sign-in", request.url));
}
