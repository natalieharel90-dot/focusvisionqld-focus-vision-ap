import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { sendPush } from "@/lib/push";
import { brisbaneNow, inQuietHours } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Patient-facing reminders fire within DUE_WINDOW_MINUTES of their
// preferred time — wide enough to be caught by a scheduler running
// every ~15 minutes. Defaults match the previous hardcoded values for
// patients with no preferences row.
const DEFAULT_CHECKIN_TIME = "09:00";
const DEFAULT_NUDGE_TIME = "15:00";
const DUE_WINDOW_MINUTES = 30;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

type Prefs = {
  notify_medication: boolean;
  notify_checkin: boolean;
  notify_checkin_nudge: boolean;
  checkin_reminder_time: string;
  checkin_nudge_time: string;
  quiet_hours: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

// True when the current Brisbane "HH:MM" falls in
// [preferred, preferred + windowMin) — i.e. the cron tick is at or
// shortly after the patient's preferred time.
function withinWindow(now: string, preferred: string, windowMin: number) {
  const [nh, nm] = now.split(":").map(Number);
  const [ph, pm] = preferred.split(":").map(Number);
  const diff = nh! * 60 + nm! - (ph! * 60 + pm!);
  return diff >= 0 && diff < windowMin;
}

// Reminder scheduler — called on a schedule by an external cron service.
// Sends medication, daily check-in and nudge notifications, respecting
// each patient's notification preferences and quiet-hours window.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server not configured." },
      { status: 500 }
    );
  }

  const now = new Date();
  const { day, time, hour } = brisbaneNow(now);

  // Preferences keyed by patient — a missing row means schema defaults
  // (medication + check-in reminders on, nudge off, quiet hours off).
  const { data: prefRows } = await supabase
    .from("user_preferences")
    .select(
      "patient_id, notify_medication, notify_checkin, notify_checkin_nudge, checkin_reminder_time, checkin_nudge_time, quiet_hours, quiet_hours_start, quiet_hours_end"
    );
  const prefs = new Map<string, Prefs>();
  for (const row of prefRows ?? []) {
    prefs.set(row.patient_id, row);
  }
  const isQuiet = (patientId: string): boolean => {
    const p = prefs.get(patientId);
    if (!p || !p.quiet_hours) return false;
    return inQuietHours(time, p.quiet_hours_start, p.quiet_hours_end);
  };

  const summary = { medication: 0, checkin: 0, nudge: 0 };

  // ── Medication reminders ───────────────────────────────────────────────
  const windowStart = new Date(
    now.getTime() - DUE_WINDOW_MINUTES * 60_000
  ).toISOString();
  const { data: dueDoses } = await supabase
    .from("medication_doses")
    .select("id, medications(patient_id, name, stopped_at)")
    .is("taken_at", null)
    .is("reminder_sent_at", null)
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", now.toISOString());

  for (const dose of dueDoses ?? []) {
    const med = dose.medications;
    if (!med || med.stopped_at) continue;
    const patientId = med.patient_id;
    const p = prefs.get(patientId);
    if (p && !p.notify_medication) continue;
    if (isQuiet(patientId)) continue;

    const result = await sendPush(patientId, {
      title: "Medication reminder",
      body: `Time for your ${med.name}.`,
      url: "/medications",
      tag: `dose-${dose.id}`,
    });
    await supabase
      .from("medication_doses")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", dose.id);
    if (result.sent > 0) summary.medication += 1;
  }

  // ── Daily check-in reminder + nudge ────────────────────────────────────
  // Per-patient timing: each patient's checkin_reminder_time and
  // checkin_nudge_time control when they get their reminder. We process
  // every tick and fire for any patient whose preferred time falls
  // within DUE_WINDOW_MINUTES of "now". reminder_log dedups across the
  // ~2 ticks that could match the same patient.

  const { data: procRows } = await supabase
    .from("procedures")
    .select("patient_id")
    .eq("status", "active");
  const recovering = new Set((procRows ?? []).map((r) => r.patient_id));

  const dayStart = new Date(`${day}T00:00:00+10:00`).toISOString();
  const { data: checkinRows } = await supabase
    .from("check_ins")
    .select("patient_id")
    .gte("created_at", dayStart);
  const checkedIn = new Set((checkinRows ?? []).map((r) => r.patient_id));

  const { data: logRows } = await supabase
    .from("reminder_log")
    .select("patient_id, kind")
    .eq("sent_on", day);
  const logged = new Set(
    (logRows ?? []).map((r) => `${r.patient_id}:${r.kind}`)
  );

  for (const patientId of recovering) {
    if (checkedIn.has(patientId)) continue;
    if (isQuiet(patientId)) continue;
    const p = prefs.get(patientId);

    // Check-in reminder
    const checkinOn = p ? p.notify_checkin : true;
    if (checkinOn && !logged.has(`${patientId}:checkin`)) {
      const preferred = p?.checkin_reminder_time ?? DEFAULT_CHECKIN_TIME;
      if (withinWindow(time, preferred, DUE_WINDOW_MINUTES)) {
        const result = await sendPush(patientId, {
          title: "Focus Vision",
          body: "Good morning — time for your daily check-in.",
          url: "/check-in",
          tag: "checkin",
        });
        await supabase
          .from("reminder_log")
          .insert({ patient_id: patientId, kind: "checkin", sent_on: day });
        if (result.sent > 0) summary.checkin += 1;
        continue; // Don't also fire the nudge in the same tick.
      }
    }

    // Nudge — off by default; only fires if the patient opted in.
    if (p && p.notify_checkin_nudge && !logged.has(`${patientId}:nudge`)) {
      const preferred = p.checkin_nudge_time ?? DEFAULT_NUDGE_TIME;
      if (withinWindow(time, preferred, DUE_WINDOW_MINUTES)) {
        const result = await sendPush(patientId, {
          title: "Focus Vision",
          body: "A gentle reminder to do today's check-in.",
          url: "/check-in",
          tag: "nudge",
        });
        await supabase
          .from("reminder_log")
          .insert({ patient_id: patientId, kind: "nudge", sent_on: day });
        if (result.sent > 0) summary.nudge += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
