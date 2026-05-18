"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Sends a password-reset email. The link in the email routes through
// /auth-callback (which exchanges the code for a recovery session) and on
// to /reset-password/update where the new password is chosen.
export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const from = String(formData.get("from") ?? "").trim();
  const fromQs = from === "patient" ? "&from=patient" : "";

  if (!email) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        "Enter your email address."
      )}${fromQs}`
    );
  }

  const h = headers();
  const origin =
    h.get("origin") ?? (h.get("host") ? `https://${h.get("host")}` : "");

  const supabase = createSupabaseServerClient();
  const redirectTo = new URL("/auth-callback", origin);
  redirectTo.searchParams.set("next", "/reset-password/update");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo.toString(),
  });
  // Don't surface "no such user" — that would let anyone probe which
  // emails have accounts. Always report the same success state.
  if (error) {
    console.error("[reset-password] request failed", error.message);
  }

  redirect(`/reset-password?sent=1${fromQs}`);
}
