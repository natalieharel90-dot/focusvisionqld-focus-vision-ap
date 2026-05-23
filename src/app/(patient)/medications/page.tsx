import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { markTakenAction, snoozeAction } from "./actions";
import { MedicationReminders } from "./MedicationReminders";

export const dynamic = "force-dynamic";

// "08:00" or an ISO timestamp → "8:00 AM".
function fmtClock(value: string): string {
  const d = value.includes("T")
    ? new Date(value)
    : new Date(`2000-01-01T${value}`);
  return d
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
    .toUpperCase();
}

// "Pred Forte" → "PF"; "Oxybuprocaine" → "Ox".
function medInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-fv-bg-accent-soft text-fv-accent-strong",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-sky-100 text-sky-800",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function untilLabel(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "due now";
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `in ${hrs}h ${mins % 60}m`;
}

export default async function MedicationsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  // Lazily create today's medication_doses rows (SECURITY DEFINER RPC).
  await supabase.rpc("ensure_todays_doses", { p_patient_id: user.id });

  // The patient's chosen snooze duration (Settings → Reminders).
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("snooze_minutes")
    .eq("patient_id", user.id)
    .maybeSingle();
  const snoozeMinutes = prefs?.snooze_minutes ?? 10;

  const { data: medications } = await supabase
    .from("medications")
    .select("*")
    .eq("patient_id", user.id)
    .is("stopped_at", null)
    .order("name");

  const meds = medications ?? [];
  const medById = new Map(meds.map((m) => [m.id, m]));
  const medIds = meds.map((m) => m.id);

  // General medication guidance from the patient's procedure template.
  const templateId =
    meds.find((m) => m.source_template_id)?.source_template_id ?? null;
  let medicationNotes: string | null = null;
  if (templateId) {
    const { data: template } = await supabase
      .from("procedure_templates")
      .select("medication_notes")
      .eq("id", templateId)
      .maybeSingle();
    medicationNotes = template?.medication_notes ?? null;
  }

  // Day boundaries in the clinic's timezone (Brisbane, UTC+10, no DST) so
  // "today's doses" doesn't drift by ~10 hours on a UTC server.
  const brisbaneDay = new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Brisbane",
  });
  const startOfDay = new Date(`${brisbaneDay}T00:00:00+10:00`);
  const endOfDay = new Date(`${brisbaneDay}T23:59:59.999+10:00`);

  const { data: doses } =
    medIds.length === 0
      ? { data: [] }
      : await supabase
          .from("medication_doses")
          .select("*")
          .in("medication_id", medIds)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString())
          .order("scheduled_at");

  const todayDoses = doses ?? [];
  const total = todayDoses.length;
  const taken = todayDoses.filter((d) => d.taken_at !== null).length;
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

  // The soonest not-yet-taken dose — the "due now" card + next-dose label.
  const nextDose = todayDoses.find((d) => d.taken_at === null) ?? null;
  const nextMed = nextDose ? medById.get(nextDose.medication_id) : null;

  const reminderPayload = todayDoses
    .filter((d) => d.taken_at === null)
    .map((d) => {
      const med = medById.get(d.medication_id);
      return {
        id: d.id,
        scheduled_at: d.scheduled_at,
        medication_name: med?.name ?? "Medication",
        dose: med?.dose ?? "",
      };
    });

  return (
    <main className="flex flex-col gap-4 px-5 py-5">
      <header>
        <h1 className="text-2xl font-bold text-fv-text-primary">
          Medications
        </h1>
        <p className="mt-0.5 text-sm text-fv-text-secondary">
          {total > 0
            ? `Today, ${taken} of ${total} doses complete`
            : "No doses scheduled today"}
        </p>
      </header>

      <MedicationReminders doses={reminderPayload} />

      {medicationNotes ? (
        <section className="flex items-start gap-3 rounded-2xl bg-fv-bg-accent-soft p-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-5 w-5 shrink-0 text-fv-accent-strong"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fv-text-primary">
            {medicationNotes}
          </p>
        </section>
      ) : null}

      {searchParams.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* Today's progress */}
      {total > 0 ? (
        <section className="rounded-2xl bg-gradient-to-br from-fv-accent to-fv-accent-strong p-5 text-white shadow-sm">
          <div className="text-sm font-semibold text-white/80">
            Today&apos;s progress
          </div>
          <div className="mt-0.5 text-3xl font-bold">
            {taken} / {total} doses
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-white/85">
            {nextDose && nextMed
              ? `Next dose ${untilLabel(nextDose.scheduled_at)} · ${nextMed.name}`
              : "All doses done for today 🎉"}
          </div>
        </section>
      ) : null}

      {/* Today's schedule */}
      {total > 0 ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Today&apos;s schedule
          </h2>
          <div className="mt-2 flex flex-col gap-2.5">
            {todayDoses.map((d) => {
              const med = medById.get(d.medication_id);
              const name = med?.name ?? "Medication";
              const isTaken = d.taken_at !== null;
              const isDue = !isTaken && d.id === nextDose?.id;
              return (
                <div key={d.id} className="flex gap-3">
                  <div className="w-16 shrink-0 pt-3 text-sm font-semibold text-fv-text-secondary">
                    {fmtClock(d.scheduled_at)}
                  </div>
                  <div
                    className={`flex flex-1 items-center gap-3 rounded-2xl bg-fv-bg-card p-3 shadow-sm ${
                      isDue ? "ring-2 ring-fv-accent-strong" : ""
                    } ${isTaken ? "opacity-70" : ""}`}
                  >
                    <span
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold ${avatarColor(
                        name
                      )}`}
                    >
                      {medInitials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-fv-text-primary">
                        {name}
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        {isDue
                          ? "Due now · reminder fired"
                          : `${med?.dose ?? ""}${
                              med?.route ? ` · ${med.route}` : ""
                            }`}
                      </div>
                    </div>
                    {isDue ? (
                      <form action={snoozeAction}>
                        <input type="hidden" name="dose_id" value={d.id} />
                        <input
                          type="hidden"
                          name="minutes"
                          value={snoozeMinutes}
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
                        >
                          🕐 Snooze {snoozeMinutes}m
                        </button>
                      </form>
                    ) : null}
                    {isTaken ? (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-white">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    ) : (
                      <form action={markTakenAction}>
                        <input type="hidden" name="dose_id" value={d.id} />
                        <button
                          type="submit"
                          title="Mark taken"
                          className="block h-9 w-9 shrink-0 rounded-full border-2 border-fv-bg-soft hover:border-fv-accent-strong"
                        />
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Empty state — no active medications yet. */}
      {meds.length === 0 ? (
        <section className="rounded-2xl bg-fv-bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-fv-text-primary">
            You don&apos;t have any medications set up yet.
          </p>
          <p className="mt-1 text-xs text-fv-text-secondary">
            Your care team adds these in the clinic — they&apos;ll appear
            here as soon as they&apos;re ready.
          </p>
        </section>
      ) : null}

      {/* Reminder schedule per medication */}
      {meds.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Your reminder schedule
          </h2>
          <div className="mt-2 flex flex-col gap-2.5">
            {meds.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl bg-fv-bg-card p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold text-fv-text-primary">
                    {m.name}
                  </div>
                  <div className="text-sm text-fv-text-secondary">
                    {m.frequency}
                  </div>
                </div>
                {m.scheduled_times.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.scheduled_times.map((t) => (
                      <span
                        key={t}
                        className="rounded-lg bg-fv-bg-soft px-3 py-1.5 text-sm font-semibold text-fv-text-primary"
                      >
                        {fmtClock(t)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {m.taper_notes ? (
                  <p className="mt-2 text-xs text-fv-text-secondary">
                    {m.taper_notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Info notes */}
      <div className="flex gap-2.5 rounded-2xl bg-fv-bg-soft/60 p-4 text-sm text-fv-text-secondary">
        <span aria-hidden className="text-fv-accent-strong">
          ⓘ
        </span>
        <p>
          Your reminder times are set by your care team. To change them,
          message your clinic. Times follow your phone&apos;s clock — if you
          travel, your reminders adjust automatically.
        </p>
      </div>
      <div className="flex gap-2.5 rounded-2xl bg-fv-bg-soft/60 p-4 text-sm text-fv-text-secondary">
        <span aria-hidden className="text-fv-accent-strong">
          📶
        </span>
        <p>
          <strong className="text-fv-text-primary">No signal?</strong>{" "}
          Reminders still fire and you can still mark doses taken. Everything
          syncs back when you reconnect.
        </p>
      </div>
    </main>
  );
}
