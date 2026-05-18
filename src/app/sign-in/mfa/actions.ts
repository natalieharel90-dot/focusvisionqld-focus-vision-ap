"use server";

import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { safeRedirectPath } from "@/lib/safe-redirect";

function backToMfa(message: string, next: string): never {
  const qs = new URLSearchParams({ error: message });
  if (next !== "/") qs.set("next", next);
  redirect(`/sign-in/mfa?${qs.toString()}`);
}

export async function verifyMfaSignInAction(formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const next = safeRedirectPath(String(formData.get("next") ?? ""));

  if (!factorId || !code) {
    backToMfa("Missing factor or code.", next);
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
    backToMfa(challengeError.message, next);
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge!.id,
    code,
  });
  if (verifyError) {
    backToMfa(verifyError.message, next);
  }

  await recordStaffAudit(supabase, "staff.signed_in");

  redirect(next);
}
