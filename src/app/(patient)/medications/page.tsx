import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { markTakenAction, snoozeAction } from "./actions";
import { MedicationReminders } from "./MedicationReminders";

export const dynamic = "force-dynamic";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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

  // Lazily create today's medication_doses rows on first visit. RLS
  // forbids patient INSERTs into medication_doses directly; this RPC
  // (SECURITY DEFINER) handles it on their behalf.
  await supabase.rpc("ensure_todays_doses", { p_patient_id: user.id });

  const { data: medications } = await supabase
    .from("medications")
    .select("*")
    .eq("patient_id", user.id)
    .is("stopped_at", null)
    .order("name");

  const meds = medications ?? [];
  const medById = new Map(meds.map((m) => [m.id, m]));
  const medIds = meds.map((m) => m.id);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

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

  // "Currently due" = soonest non-taken dose (whether slightly past or
  // imminent). Only this one gets snooze controls.
  const currentDoseId = todayDoses.find((d) => d.taken_at === null)?.id ?? null;

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
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Medications
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Your reminder times are set by your care team.
        </p>
      </header>

      <MedicationReminders doses={reminderPayload} />

      {searchParams.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* Active medications list (read-only — patients can't add) */}
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fv-text-primary">
          Your medications
        </h2>
        {meds.length === 0 ? (
          <p className="mt-3 text-sm text-fv-text-secondary">
            No active medications.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {meds.map((m) => (
              <li
                key={m.id}
                className="rounded-md bg-fv-bg-soft p-3 text-sm"
              >
                <div className="font-medium text-fv-text-primary">{m.name}</div>
                <div className="text-xs text-fv-text-secondary">
                  {m.dose} · {m.route} · {m.frequency}
                </div>
                {m.taper_notes ? (
                  <p className="mt-1 text-xs text-fv-text-secondary">
                    {m.taper_notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Today's timeline */}
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fv-text-primary">
          Today
        </h2>
        {todayDoses.length === 0 ? (
          <p className="mt-3 text-sm text-fv-text-secondary">
            No doses scheduled today.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {todayDoses.map((d) => {
              const med = medById.get(d.medication_id);
              const isCurrent = d.id === currentDoseId;
              const isTaken = d.taken_at !== null;
              return (
                <li
                  key={d.id}
                  className={`rounded-md p-3 text-sm ${
                    isCurrent
                      ? "border border-fv-accent-strong bg-fv-bg-accent-soft"
                      : "bg-fv-bg-soft"
                  } ${isTaken ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
                        {fmtTime(d.scheduled_at)}
                        {d.snooze_count > 0 ? ` · snoozed ×${d.snooze_count}` : ""}
                      </div>
                      <div className="font-medium text-fv-text-primary">
                        {med?.name ?? "Medication"}
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        {med?.dose}
                      </div>
                    </div>
                    {isTaken ? (
                      <span className="text-xs font-semibold text-fv-accent-strong">
                        ✓ Taken at {fmtTime(d.taken_at!)}
                      </span>
                    ) : (
                      <form action={markTakenAction}>
                        <input type="hidden" name="dose_id" value={d.id} />
                        <button
                          type="submit"
                          className="rounded-md bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Mark taken
                        </button>
                      </form>
                    )}
                  </div>

                  {!isTaken && isCurrent ? (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-fv-text-secondary">
                        Snooze:
                      </span>
                      {[15, 30, 60].map((m) => (
                        <form key={m} action={snoozeAction}>
                          <input type="hidden" name="dose_id" value={d.id} />
                          <input type="hidden" name="minutes" value={m} />
                          <button
                            type="submit"
                            className="rounded-md border border-fv-bg-soft bg-white px-2 py-1 text-xs font-medium text-fv-text-primary"
                          >
                            {m} min
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
