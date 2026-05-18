import "server-only";

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

const subject = process.env.VAPID_SUBJECT;
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

let configured = false;
function configure(): boolean {
  if (configured) return true;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

// Service-role client — the push sender is server-only infrastructure and
// needs to read every device a patient registered, across RLS.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

export type PushPayload = {
  title: string;
  body: string;
  // Path opened when the notification is tapped.
  url?: string;
  // Collapses repeat notifications of the same kind.
  tag?: string;
};

// Sends a push notification to every device the patient has registered.
// Best-effort: VAPID/service-role misconfiguration is logged and skipped,
// dead subscriptions are pruned, and nothing is thrown to the caller — a
// failed push must never break the action that triggered it.
export async function sendPush(
  patientId: string,
  payload: PushPayload
): Promise<void> {
  if (!configure()) {
    console.warn("[push] VAPID not configured — skipping push");
    return;
  }
  const admin = adminClient();
  if (!admin) {
    console.warn("[push] service-role client unavailable — skipping push");
    return;
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("patient_id", patientId);
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser dropped the subscription — prune it.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[push] send failed", status, err);
        }
      }
    })
  );
}
