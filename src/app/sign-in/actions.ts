"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { safeRedirectPath } from "@/lib/safe-redirect";

function backToSignIn(message: string, next?: string): never {
  const qs = new URLSearchParams({ error: message });
  if (next && next !== "/") qs.set("next", next);
  redirect(`/sign-in?${qs.toString()}`);
}

export async function signInWithPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    backToSignIn("Email and password are required.", next);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[sign-in] failed", error.message);
    backToSignIn("Sign-in failed — check your email and password.", next);
  }

  // Determine whether the user has MFA enrolled and needs to step up.
  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) {
    console.error("[sign-in] AAL check failed", aalError.message);
    backToSignIn("Sign-in failed — please try again.", next);
  }

  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/sign-in/mfa${qs}`);
  }

  // No MFA factor enrolled — block sign-in with a clear message. Staff are
  // required to have TOTP enrolled (set up during sign-up). This protects
  // accounts that somehow ended up without a factor.
  await supabase.auth.signOut();
  backToSignIn(
    "This account has no MFA factor. Please contact an administrator.",
    next
  );
}
