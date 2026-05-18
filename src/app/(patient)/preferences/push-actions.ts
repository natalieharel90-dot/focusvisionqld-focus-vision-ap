"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PushActionResult = { ok: boolean; error?: string };

// Stores (or refreshes) a Web Push subscription for the signed-in
// patient's current device.
export async function savePushSubscriptionAction(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<PushActionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!sub.endpoint || !sub.p256dh || !sub.auth) {
    return { ok: false, error: "Invalid subscription." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      patient_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Removes a device's subscription when the patient turns notifications off.
export async function removePushSubscriptionAction(
  endpoint: string
): Promise<PushActionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("patient_id", user.id);
  return { ok: true };
}
