"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

function back(message: string): never {
  redirect(`/reset-password/update?error=${encodeURIComponent(message)}`);
}

// Sets the new password for the recovery session created by the email
// link, then ends that session so the user signs in cleanly — staff in
// particular must re-do TOTP, which a recovery session has not satisfied.
export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    back("Password must be at least 8 characters.");
  }
  if (password !== confirm) {
    back("The two passwords don't match.");
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    back("Your reset link has expired. Please request a new one.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[reset-password] update failed", error.message);
    back("Couldn't update the password — please request a fresh link.");
  }

  // Route to the right sign-in. Check staff membership before signing out.
  const { data: staff } = await supabase
    .from("staff_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  await supabase.auth.signOut();
  redirect(staff ? "/sign-in?reset=1" : "/patient-sign-in?reset=1");
}
