"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const PENDING_STAFF_COOKIE = "fv_pending_staff";

type PendingStaff = {
  name: string;
  role: string;
};

function backToEnroll(message: string): never {
  redirect(`/sign-up/mfa?error=${encodeURIComponent(message)}`);
}

export async function verifyEnrollmentAction(formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!factorId || !code) backToEnroll("Missing factor or code.");

  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    backToEnroll(challengeError?.message ?? "Could not create challenge.");
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge!.id,
    code,
  });
  if (verifyError) backToEnroll(verifyError.message);

  // Recover the pending name + role stashed by /sign-up.
  const raw = cookies().get(PENDING_STAFF_COOKIE)?.value;
  if (!raw) {
    backToEnroll(
      "Registration timed out. Sign in to retry MFA setup or contact admin."
    );
  }
  let pending: PendingStaff;
  try {
    pending = JSON.parse(raw!) as PendingStaff;
  } catch {
    backToEnroll("Could not read pending registration. Please retry sign-up.");
  }

  // Bootstrap the staff_users row via the SECURITY DEFINER function (the
  // ordinary RLS policy requires is_staff(), which this user isn't yet).
  const { error: rpcError } = await supabase.rpc("create_staff_user", {
    p_name: pending!.name,
    p_role: pending!.role,
  });
  if (rpcError) backToEnroll(rpcError.message);

  // Now is_staff() returns true; we can write the audit row.
  await recordStaffAudit(supabase, "staff.created", {
    entity_type: "staff_user",
    entity_id: user!.id,
    new_value: { name: pending!.name, role: pending!.role },
  });

  cookies().delete(PENDING_STAFF_COOKIE);
  redirect("/");
}
