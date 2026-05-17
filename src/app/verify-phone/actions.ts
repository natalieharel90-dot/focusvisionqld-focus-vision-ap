"use server";

import { createHash, randomInt } from "node:crypto";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

const CODE_TTL_MIN = 10;
const RESEND_THROTTLE_MS = 30_000;

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
// the code is logged and (in local development only) surfaced for testing.
export async function sendPhoneCodeAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const phone = normaliseAuMobile(String(formData.get("phone") ?? ""));
  if (!phone) back("Enter a valid Australian mobile number.");

  // Resend throttle — at most one code every 30 seconds per patient.
  const { data: recent } = await supabase
    .from("patient_phone_verifications")
    .select("id")
    .eq("patient_id", user.id)
    .is("verified_at", null)
    .gte(
      "created_at",
      new Date(Date.now() - RESEND_THROTTLE_MS).toISOString()
    )
    .limit(1)
    .maybeSingle();
  if (recent) {
    back("Please wait a moment before requesting another code.");
  }

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
  // Surfaced only in local development — never on a deployed environment.
  if (process.env.NODE_ENV === "development") {
    redirect(`/verify-phone?devcode=${code}`);
  }
  redirect("/verify-phone");
}

// Checks a submitted code. The match, attempt-count and the write of the
// verified number all happen in a SECURITY DEFINER function so the
// patient can't tamper with the verification row.
export async function verifyPhoneCodeAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) back("Enter the 6-digit code.");

  const { data: result, error } = await supabase.rpc(
    "confirm_phone_verification",
    { p_code_hash: hashCode(code) }
  );
  if (error) back("Something went wrong — please try again.");

  switch (result) {
    case "ok":
      redirect("/home");
    case "wrong":
      back("That code isn't right. Please try again.");
    case "locked":
      back("Too many attempts. Send a new code.");
    default:
      // 'expired' | 'none'
      back("Your code has expired. Send a new one.");
  }
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
