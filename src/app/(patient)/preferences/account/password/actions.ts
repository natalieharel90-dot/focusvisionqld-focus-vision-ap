"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

function back(message: string): never {
  redirect(
    `/preferences/account/password?error=${encodeURIComponent(message)}`
  );
}

// Lets a signed-in patient replace their clinic-issued temporary password
// with one of their own.
export async function setPatientPasswordAction(formData: FormData) {
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
  if (!user) redirect("/patient-sign-in");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[patient-password] update failed", error.message);
    back("Couldn't update your password — please try again.");
  }

  redirect("/preferences/account?password=updated");
}
