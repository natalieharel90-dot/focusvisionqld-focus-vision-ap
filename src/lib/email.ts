// Resend client for transactional emails (alerts, etc.). The API key
// and "from" address are read from env. When the API key isn't set the
// function logs and returns ok:false so the caller can degrade
// gracefully — useful in local dev and during the staging rollout
// before DNS is verified.

type EmailParams = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export type EmailResult = { ok: boolean; id?: string; error?: string };

// Resend's testing sender works without DNS verification but only
// delivers to the API key owner's email — fine for early smoke tests.
const DEFAULT_FROM = "Focus Vision Alerts <onboarding@resend.dev>";

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM_EMAIL ?? DEFAULT_FROM;

  if (!key) {
    console.log("[email] RESEND_API_KEY not set — would send:", {
      to: params.to,
      subject: params.subject,
    });
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        text: params.text,
        html:
          params.html ??
          `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(params.text)}</pre>`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Resend rejected (${res.status}): ${detail.slice(0, 300)}`,
      };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: `Resend request failed: ${(err as Error).message}`,
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
