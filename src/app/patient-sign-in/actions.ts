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
  if (error) {
    console.error("[patient-sign-in] failed", error.message);
    backWithError("Sign-in failed — please check your email and password.");
  }
  if (!data.user) backWithError("Sign-in failed — please try again.");

  // Confirm this auth user is actually a patient. Reject anyone who isn't,
  // including staff users (who must sign in via /sign-in).
  const { data: patient } = await supabase
    .from("patients")
    .select("id, phone_verified")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!patient) {
    await supabase.auth.signOut();
    backWithError("This account is not registered as a patient.");
  }

  // Patients with an unverified mobile go through SMS verification first.
  redirect(patient.phone_verified ? "/home" : "/verify-phone");
}

export async function patientSignOutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/patient-sign-in");
}
