import "server-only";

export type SmsResult = { ok: true } | { ok: false; error: string };

// Sends an SMS via the ClickSend REST API. Credentials come from
// environment variables — CLICKSEND_USERNAME and CLICKSEND_API_KEY.
// CLICKSEND_SENDER is optional: an alphanumeric sender ID (max 11 chars,
// e.g. "FocusVision") or a number — if unset, ClickSend sends from a
// shared number. When the credentials aren't set (e.g. local
// development) it returns a failure the caller can fall back from rather
// than throwing.
export async function sendSms(
  to: string,
  body: string
): Promise<SmsResult> {
  const username = process.env.CLICKSEND_USERNAME;
  const apiKey = process.env.CLICKSEND_API_KEY;
  const from = process.env.CLICKSEND_SENDER;

  if (!username || !apiKey) {
    return { ok: false, error: "SMS provider is not configured." };
  }

  try {
    const message: Record<string, string> = {
      source: "focus-vision",
      to,
      body,
    };
    if (from) message.from = from;

    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${username}:${apiKey}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [message] }),
    });

    const payload = (await res.json().catch(() => null)) as {
      response_code?: string;
      response_msg?: string;
      data?: { messages?: Array<{ status?: string }> };
    } | null;

    if (!res.ok || payload?.response_code !== "SUCCESS") {
      const detail =
        payload?.response_msg ||
        payload?.response_code ||
        `HTTP ${res.status}`;
      return { ok: false, error: `ClickSend rejected the request: ${detail}` };
    }

    // A request-level SUCCESS can still carry a per-message failure.
    const status = payload.data?.messages?.[0]?.status?.toUpperCase();
    if (status && status !== "SUCCESS" && status !== "QUEUED") {
      return {
        ok: false,
        error: `ClickSend could not send the message (${status}).`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SMS request failed.",
    };
  }
}
