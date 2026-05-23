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
import { brisbaneNow, inQuietHours } from "./reminders";

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
      .select(
        "email_clinic, inapp_to_all, override_role_keys, include_surgeon_override"
      )
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

    // Build up the set of recipients across the three push paths so each
    // staff member only gets one notification per alert.
    const inappRecipients = new Set<string>();
    const overrideRecipients = new Set<string>();

    // 2. In-app push to all active staff who are on shift and not in
    //    their personal quiet-hours window. Off-shift / quiet staff are
    //    skipped here — they only get an alert if they're in the
    //    override path below.
    if (actions.inapp_to_all) {
      const { time: nowBrisbane } = brisbaneNow(new Date());
      const { data: staff } = await admin
        .from("staff_users")
        .select(
          "id, on_shift, quiet_hours, quiet_hours_start, quiet_hours_end"
        )
        .eq("active", true);
      for (const s of staff ?? []) {
        if (!s.on_shift) continue;
        if (
          s.quiet_hours &&
          inQuietHours(nowBrisbane, s.quiet_hours_start, s.quiet_hours_end)
        ) {
          continue;
        }
        inappRecipients.add(s.id);
      }
    }

    // 3. Override message to selected staff roles — these are the
    //    recipients that should bypass staff quiet-hours / off-shift
    //    gates once those are built. Today the gates don't exist, so
    //    this is a targeted push with an "URGENT" prefix.
    const overrideRoles = actions.override_role_keys ?? [];
    if (overrideRoles.length > 0) {
      const { data: roleStaff } = await admin
        .from("staff_users")
        .select("id")
        .eq("active", true)
        .in("role", overrideRoles);
      for (const s of roleStaff ?? []) overrideRecipients.add(s.id);
    }

    // 3b. Patient's surgeon — added to the override set IF the
    //     dispatcher option is on AND the surgeon has opted in.
    if (actions.include_surgeon_override && proc?.surgeon_id) {
      const { data: surgeonRow } = await admin
        .from("staff_users")
        .select("id, notify_after_hours")
        .eq("id", proc.surgeon_id)
        .maybeSingle();
      if (surgeonRow?.notify_after_hours) {
        overrideRecipients.add(surgeonRow.id);
        surgeonPushed = true;
      } else if (surgeonRow && !surgeonRow.notify_after_hours) {
        errors.push(
          "patient's surgeon hasn't opted in to after-hours alerts — skipped"
        );
      }
    }

    // Override recipients take priority — don't double-send to the same
    // person from both paths.
    for (const id of overrideRecipients) inappRecipients.delete(id);

    const generalResults = await Promise.all(
      Array.from(inappRecipients).map((id) =>
        sendPush(id, {
          title: `${zone} alert`,
          body: summary,
          url: `/patients/${opts.patientId}`,
          tag: `alert-${opts.checkInId}`,
        })
      )
    );
    const overrideResults = await Promise.all(
      Array.from(overrideRecipients).map((id) =>
        sendPush(id, {
          title: `🚨 URGENT · ${zone}: ${name}`,
          body: `Day ${day} ${procLabel} · open the patient screen`,
          url: `/staff-app/patients/${opts.patientId}`,
          tag: `alert-${opts.checkInId}-override`,
        })
      )
    );
    inappPushed =
      generalResults.reduce((n, r) => n + r.sent, 0) +
      overrideResults.reduce((n, r) => n + r.sent, 0);
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
