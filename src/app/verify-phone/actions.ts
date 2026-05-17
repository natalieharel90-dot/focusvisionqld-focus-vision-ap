"use server";

import { createHash, randomInt } from "node:crypto";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Normalise an Australian mobile to "+614xxxxxxxx". Returns null if it
// doesn't look like an AU mobile.
function normaliseAuMobile(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  let local: string;
  if (cleaned.startsWith("+61")) local = "0" + cleaned.slice(3);
  else if (cleaned.startsWith("61")) local = "0" + cleaned.slice(2);
  else local = cleaned;
  if (!/^04\d{8}$/.test(local)) return null;
  return "+61" + local.slice(1);
}

function back(message: string): never {
  redirect(`/verify-phone?error=${encodeURIComponent(message)}`);
}

// Generates a verification code, stores its hash, and "sends" it. Real SMS
// delivery is not wired — until the clinic's SMS provider is configured
// the code is logged and (outside production) surfaced for testing.
export async function sendPhoneCodeAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const phone = normaliseAuMobile(String(formData.get("phone") ?? ""));
  if (!phone) back("Enter a valid Australian mobile number.");

  // One active code at a time.
  await supabase
    .from("patient_phone_verifications")
    .delete()
    .eq("patient_id", user.id)
    .is("verified_at", null);

  const code = String(randomInt(100000, 1000000));
  const { error } = await supabase
    .from("patient_phone_verifications")
    .insert({
      patient_id: user.id,
      phone,
      code_hash: hashCode(code),
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
    });
  if (error) back("Couldn't send a code right now. Please try again.");

  // TODO: deliver `code` to `phone` via the clinic's SMS provider.
  console.log(`[dev] phone verification code for ${phone}: ${code}`);
  if (process.env.NODE_ENV !== "production") {
    redirect(`/verify-phone?devcode=${code}`);
  }
  redirect("/verify-phone");
}

// Checks a submitted code. On success the verified phone is written to the
// patient record and phone_verified is set.
export async function verifyPhoneCodeAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) back("Enter the 6-digit code.");

  const { data: row } = await supabase
    .from("patient_phone_verifications")
    .select("id, phone, code_hash, expires_at, attempts")
    .eq("patient_id", user.id)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) back("Your code has expired. Send a new one.");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase
      .from("patient_phone_verifications")
      .delete()
      .eq("id", row.id);
    back("Your code has expired. Send a new one.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await supabase
      .from("patient_phone_verifications")
      .delete()
      .eq("id", row.id);
    back("Too many attempts. Send a new code.");
  }

  if (hashCode(code) !== row.code_hash) {
    await supabase
      .from("patient_phone_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    back("That code isn't right. Please try again.");
  }

  await supabase
    .from("patient_phone_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", row.id);
  await supabase
    .from("patients")
    .update({ phone: row.phone, phone_verified: true })
    .eq("id", user.id);

  redirect("/home");
}

// Discards the pending code so the patient can enter a different number.
export async function restartPhoneVerificationAction() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  await supabase
    .from("patient_phone_verifications")
    .delete()
    .eq("patient_id", user.id)
    .is("verified_at", null);

  redirect("/verify-phone");
}
