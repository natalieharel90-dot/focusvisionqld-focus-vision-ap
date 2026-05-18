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

// Outcome of a send — callers that just fire a notification can ignore
// this; the test action uses it to report exactly what happened.
export type PushResult = {
  configured: boolean;
  subscriptions: number;
  sent: number;
  failures: string[];
};

// Sends a push notification to every device the patient has registered.
// Never throws — a failed push must not break the action that triggered
// it. Dead subscriptions (404/410) are pruned.
export async function sendPush(
  patientId: string,
  payload: PushPayload
): Promise<PushResult> {
  if (!configure()) {
    console.warn("[push] VAPID not configured — skipping push");
    return { configured: false, subscriptions: 0, sent: 0, failures: [] };
  }
  const admin = adminClient();
  if (!admin) {
    return {
      configured: false,
      subscriptions: 0,
      sent: 0,
      failures: ["Service-role client unavailable."],
    };
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("patient_id", patientId);
  const list = subs ?? [];
  if (list.length === 0) {
    return { configured: true, subscriptions: 0, sent: 0, failures: [] };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  const failures: string[] = [];

  await Promise.all(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        const detail =
          (err as { body?: string }).body ||
          (err as Error).message ||
          "send failed";
        // 404/410 mean the browser dropped the subscription — prune it.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          failures.push(`subscription expired (${status})`);
        } else {
          failures.push(`${status ?? ""} ${detail}`.trim());
          console.error("[push] send failed", status, err);
        }
      }
    })
  );

  return { configured: true, subscriptions: list.length, sent, failures };
}
