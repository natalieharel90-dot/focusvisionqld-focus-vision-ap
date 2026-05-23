// Alert dispatcher — fires the configured zone_alert_actions
// (email/in-app/surgeon) when a check-in lands in a routable zone.
//
// Runs server-side with the service-role key so it can read all staff
// push subscriptions and write to the alert_dispatches audit log.
// Never throws — failures are logged and recorded as `error` on the
// dispatch row, but they never block the check-in submission itself.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { sendEmail } from "./email";
import { sendPush } from "./push";

const CLINIC_EMAIL = process.env.CLINIC_ALERT_EMAIL ?? "hello@focusvision.com.au";

const ZONE_LABEL: Record<AlertLevel, string> = {
  yellow: "🟡 Yellow",
  orange: "🟠 Orange",
  red: "🔴 Red (staff-only)",
};

type AlertLevel = "yellow" | "orange" | "red";

function adminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

export async function dispatchAlert(opts: {
  checkInId: string;
  patientId: string;
  alertLevel: AlertLevel;
}): Promise<void> {
  const admin = adminClient();
  if (!admin) {
    console.warn("[alert] no admin client — skipping dispatch");
    return;
  }

  const errors: string[] = [];
  let emailSent = false;
  let inappPushed = 0;
  let surgeonPushed = false;

  try {
    const { data: actions } = await admin
      .from("zone_alert_actions")
      .select("email_clinic, inapp_to_all, call_surgeon")
      .eq("alert_level", opts.alertLevel)
      .maybeSingle();
    if (!actions) {
      throw new Error(`no zone_alert_actions row for ${opts.alertLevel}`);
    }

    const [patientRes, procedureRes, checkInRes] = await Promise.all([
      admin
        .from("patients")
        .select("first_name, last_name, name, email")
        .eq("id", opts.patientId)
        .single(),
      admin
        .from("procedures")
        .select("procedure_type, surgery_date, surgeon_id")
        .eq("patient_id", opts.patientId)
        .eq("status", "active")
        .order("surgery_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("check_ins")
        .select(
          "pain, light_sensitivity, vision, unusual_symptoms, other_description, recovery_day"
        )
        .eq("id", opts.checkInId)
        .single(),
    ]);

    if (patientRes.error) throw patientRes.error;
    const patient = patientRes.data;
    const proc = procedureRes.data;
    const check = checkInRes.data;

    const name = patient.first_name || patient.name || "Patient";
    const procLabel = proc?.procedure_type?.toUpperCase() ?? "—";
    const day = check?.recovery_day ?? 0;
    const symptoms = (check?.unusual_symptoms ?? []).join(", ");
    const zone = ZONE_LABEL[opts.alertLevel];
    const summary = `${name} · Day ${day} ${procLabel} · ${zone}`;
    const detailLines = [
      `Pain: ${check?.pain ?? "?"}/5`,
      `Light sensitivity: ${check?.light_sensitivity ?? "?"}/5`,
      `Vision: ${check?.vision ?? "?"}`,
      symptoms ? `Symptoms: ${symptoms}` : null,
      check?.other_description ? `Notes: ${check.other_description}` : null,
    ].filter(Boolean);

    // 1. Email the clinic
    if (actions.email_clinic) {
      const result = await sendEmail({
        to: CLINIC_EMAIL,
        subject: `[Focus Vision ${opts.alertLevel.toUpperCase()}] ${summary}`,
        text: `${summary}\n\n${detailLines.join("\n")}\n`,
      });
      emailSent = result.ok;
      if (!result.ok) errors.push(`email: ${result.error}`);
    }

    // 2. In-app push to all staff with a push subscription
    if (actions.inapp_to_all) {
      const { data: staff } = await admin
        .from("staff_users")
        .select("id")
        .eq("active", true);
      const staffIds = new Set((staff ?? []).map((s) => s.id));
      // The surgeon gets their own specific push below, so don't double up.
      if (actions.call_surgeon && proc?.surgeon_id) {
        staffIds.delete(proc.surgeon_id);
      }
      const results = await Promise.all(
        Array.from(staffIds).map((id) =>
          sendPush(id, {
            title: `${zone} alert`,
            body: summary,
            url: `/patients/${opts.patientId}`,
            tag: `alert-${opts.checkInId}`,
          })
        )
      );
      inappPushed = results.reduce((n, r) => n + r.sent, 0);
    }

    // 3. Surgeon push — high-priority alert that opens the patient's
    //    staff-app screen, where the surgeon can act (call the patient,
    //    reply, change meds, etc.).
    if (actions.call_surgeon && proc?.surgeon_id) {
      const result = await sendPush(proc.surgeon_id, {
        title: `📞 ${zone}: ${name} needs you`,
        body: `Day ${day} ${procLabel} · open the patient screen`,
        url: `/staff-app/patients/${opts.patientId}`,
        tag: `alert-${opts.checkInId}-surgeon`,
      });
      surgeonPushed = result.sent > 0;
      if (result.subscriptions === 0) {
        errors.push(
          "surgeon has no push subscription — they won't be notified until they enable notifications"
        );
      }
    }
  } catch (err) {
    errors.push(`dispatcher: ${(err as Error).message}`);
    console.error("[alert] dispatcher failed", err);
  }

  await admin.from("alert_dispatches").insert({
    check_in_id: opts.checkInId,
    patient_id: opts.patientId,
    alert_level: opts.alertLevel,
    email_sent: emailSent,
    inapp_pushed: inappPushed,
    surgeon_pushed: surgeonPushed,
    error: errors.length > 0 ? errors.join("; ") : null,
  });
}
