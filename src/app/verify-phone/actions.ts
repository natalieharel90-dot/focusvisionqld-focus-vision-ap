"use server";

import { createHash, randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendSms } from "@/lib/sms";
import { deriveStatus, parseChecklist } from "@/lib/setup-tasks";
import type { Database } from "@/types/database.types";

const CODE_TTL_MIN = 10;
const RESEND_THROTTLE_MS = 30_000;

// Marks the onboarding checklist's MFA step done once a patient verifies
// their phone. Uses the service role because patients can't write
// patient_setup_tasks themselves. Best-effort — never blocks the patient.
async function syncMfaSetupTask(patientId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const { data: task } = await admin
    .from("patient_setup_tasks")
    .select("checklist")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (!task) return;
  const checklist = parseChecklist(task.checklist);
  if (checklist.mfa_verified.done) return;
  const updated = {
    ...checklist,
    mfa_verified: {
      done: true,
      done_at: new Date().toISOString(),
      done_by: null,
    },
  };
  await admin
    .from("patient_setup_tasks")
    .update({ checklist: updated, status: deriveStatus(updated) })
    .eq("patient_id", patientId);
}

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

  // Deliver the code by SMS.
  const sms = await sendSms(
    phone,
    `Your Focus Vision verification code is ${code}. It expires in 10 minutes.`
  );

  // In local development the code is surfaced on screen so the flow can be
  // tested without a configured SMS provider.
  if (process.env.NODE_ENV === "development") {
    console.log(`[dev] phone verification code for ${phone}: ${code}`);
    redirect(`/verify-phone?devcode=${code}`);
  }

  if (!sms.ok) {
    console.error("[verify-phone] SMS send failed:", sms.error);
    back("Couldn't send a verification code right now. Please try again.");
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
    case "ok": {
      await syncMfaSetupTask(user.id);
      redirect("/home");
    }
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
