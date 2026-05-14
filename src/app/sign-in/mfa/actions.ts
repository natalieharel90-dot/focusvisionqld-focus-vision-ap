"use server";

import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function backToMfa(message: string): never {
  redirect(`/sign-in/mfa?error=${encodeURIComponent(message)}`);
}

export async function verifyMfaSignInAction(formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!factorId || !code) {
    backToMfa("Missing factor or code.");
  }

  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) {
    backToMfa(challengeError.message);
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge!.id,
    code,
  });
  if (verifyError) {
    backToMfa(verifyError.message);
  }

  await recordStaffAudit(supabase, "staff.signed_in");

  redirect("/");
}
