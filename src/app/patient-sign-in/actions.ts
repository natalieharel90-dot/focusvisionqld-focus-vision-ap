"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

function backWithError(message: string): never {
  redirect(`/patient-sign-in?error=${encodeURIComponent(message)}`);
}

export async function patientSignInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) backWithError("Email and password are required.");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) backWithError(error.message);
  if (!data.user) backWithError("Sign-in failed.");

  // Confirm this auth user is actually a patient. Reject anyone who isn't,
  // including staff users (who must sign in via /sign-in).
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!patient) {
    await supabase.auth.signOut();
    backWithError("This account is not registered as a patient.");
  }

  redirect("/home");
}

export async function patientSignOutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/patient-sign-in");
}
