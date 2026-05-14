"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

function backToSignIn(message: string): never {
  redirect(`/sign-in?error=${encodeURIComponent(message)}`);
}

export async function signInWithPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    backToSignIn("Email and password are required.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    backToSignIn(error.message);
  }

  // Determine whether the user has MFA enrolled and needs to step up.
  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) {
    backToSignIn(aalError.message);
  }

  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/sign-in/mfa");
  }

  // No MFA factor enrolled — block sign-in with a clear message. Staff are
  // required to have TOTP enrolled (set up during sign-up). This protects
  // accounts that somehow ended up without a factor.
  await supabase.auth.signOut();
  backToSignIn(
    "This account has no MFA factor. Please contact an administrator."
  );
}
