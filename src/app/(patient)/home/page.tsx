import Link from "next/link";

import { HOME_TILES } from "@/lib/patient-shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isPreOp, surgeryCountdownLabel } from "@/lib/preop";
import { ONBOARDING_STEPS, shouldShowOnboarding } from "@/lib/onboarding";
import { OnboardingTour } from "@/components/patient/OnboardingTour";
import { loadPatientFeatures } from "@/lib/patient-features-server";
import { selectNextAppointment } from "@/lib/appointments";
import { NextAppointmentCard } from "@/components/patient/NextAppointmentCard";

export const dynamic = "force-dynamic";

const RECOVERY_WINDOW_DAYS = 90;

function brisbaneToday(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Brisbane",
  });
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor(
    (Date.now() - new Date(`${dateStr}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

export default async function PatientHomePage({
  searchParams,
}: {
  searchParams: { tour?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [
    procedureResult,
    dosesResult,
    threadResult,
    setupResult,
    prefsResult,
    appointmentsResult,
  ] = await Promise.all([
    supabase
      .from("procedures")
      .select("procedure_type, surgery_date")
      .eq("patient_id", user.id)
      .eq("status", "active")
      .order("surgery_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("medications")
      .select("id")
      .eq("patient_id", user.id)
      .is("stopped_at", null),
    supabase
      .from("message_threads")
      .select("id")
      .eq("patient_id", user.id)
      .maybeSingle(),
    supabase
      .from("patient_setup_tasks")
      .select("status")
      .eq("patient_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_preferences")
      .select("onboarding_completed_at")
      .eq("patient_id", user.id)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select(
        "id, appointment_type, scheduled_at, clinician_id, location, status, created_at"
      )
      .eq("patient_id", user.id),
  ]);

  // Next upcoming appointment for the home card (null ⇒ card hidden).
  const nextAppointment = selectNextAppointment(
    appointmentsResult.data ?? [],
    new Date()
  );
  let nextApptClinician: string | null = null;
  if (nextAppointment?.clinician_id) {
    const { data: clinician } = await supabase
      .from("staff_users")
      .select("name")
      .eq("id", nextAppointment.clinician_id)
      .maybeSingle();
    nextApptClinician = clinician?.name ?? null;
  }

  const features = await loadPatientFeatures(supabase, user.id);
  const procedure = procedureResult.data;
  const today = brisbaneToday();
  const preOp = isPreOp(procedure?.surgery_date ?? null, today);
  const recoveryDay = daysSince(procedure?.surgery_date ?? null);
  const progress =
    recoveryDay == null
      ? 0
      : Math.min(1, Math.max(0, recoveryDay / RECOVERY_WINDOW_DAYS));

  // Today's scheduled doses.
  const medIds = (dosesResult.data ?? []).map((m) => m.id);
  let dosesToday = 0;
  if (medIds.length > 0) {
    const { count } = await supabase
      .from("medication_doses")
      .select("id", { count: "exact", head: true })
      .in("medication_id", medIds)
      .gte("scheduled_at", startOfDay.toISOString())
      .lte("scheduled_at", endOfDay.toISOString());
    dosesToday = count ?? 0;
  }

  // Unread staff messages.
  let unread = 0;
  if (threadResult.data) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadResult.data.id)
      .eq("sender_type", "staff")
      .is("read_at", null);
    unread = count ?? 0;
  }

  const subtitle: Record<string, string> = {
    "check-in": "2 minutes · helps your care team",
    medications:
      dosesToday > 0 ? `${dosesToday} doses today` : "No doses scheduled",
    messages: unread > 0 ? `${unread} unread` : "Message your care team",
    documents: "Surgery report, scripts, receipts",
    feedback: "Tell us how things are going",
    contact: "Call, message or book a follow-up",
    settings: "Theme, language, reminders",
  };

  // The onboarding tour: first-run for activated patients, or an explicit
  // replay from Settings (?tour=replay).
  const replay = searchParams.tour === "replay";
  const showTour =
    replay ||
    shouldShowOnboarding(
      setupResult.data?.status,
      prefsResult.data?.onboarding_completed_at
    );

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      {/* Recovery progress / pre-op countdown */}
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
          {procedure
            ? `${procedure.procedure_type.toUpperCase()} ${
                preOp ? "pre-op" : "recovery"
              }`
            : "Welcome"}
        </div>
        {preOp && procedure ? (
          <>
            <h1 className="mt-1 text-2xl font-semibold text-fv-text-primary">
              {surgeryCountdownLabel(procedure.surgery_date, today)}
            </h1>
            <p className="mt-1.5 text-xs text-fv-text-secondary">
              Use the time before surgery to get prepared — tap below.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-2xl font-semibold text-fv-text-primary">
              {recoveryDay == null
                ? "Good day"
                : `Day ${recoveryDay} of recovery`}
            </h1>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-fv-bg-soft">
              <div
                className="h-full rounded-full bg-fv-accent"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-fv-text-secondary">
              {recoveryDay == null
                ? "Your recovery timeline appears here once surgery is scheduled."
                : `${
                    RECOVERY_WINDOW_DAYS -
                    Math.min(recoveryDay, RECOVERY_WINDOW_DAYS)
                  } days left in the typical recovery window`}
            </p>
          </>
        )}
      </section>

      {/* Next appointment — hidden when there is no upcoming appointment. */}
      {nextAppointment ? (
        <NextAppointmentCard
          appointment={nextAppointment}
          clinicianName={nextApptClinician}
        />
      ) : null}

      {/* Pre-op featured tile — shown until surgery day, then hidden. */}
      {preOp && procedure && features.preop_tile ? (
        <Link
          href="/pre-op"
          className="flex items-center justify-between rounded-2xl bg-fv-accent-strong p-5 text-white shadow-sm hover:opacity-95"
        >
          <span>
            <span className="block text-base font-semibold">
              Before your surgery
            </span>
            <span className="block text-sm opacity-90">
              {surgeryCountdownLabel(procedure.surgery_date, today)} · checklist
              &amp; what to expect
            </span>
          </span>
          <span aria-hidden className="text-2xl">
            🗓️
          </span>
        </Link>
      ) : null}

      {/* Tile grid */}
      <div className="grid grid-cols-2 gap-3">
        {HOME_TILES.filter(
          (tile) => tile.key !== "feedback" || features.feedback_tile
        ).map((tile) => {
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <span aria-hidden className="text-2xl">
                  {tile.icon}
                </span>
                {tile.key === "messages" && unread > 0 ? (
                  <span className="rounded-full bg-fv-accent px-2 py-0.5 text-xs font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-base font-semibold text-fv-text-primary">
                {tile.title}
              </div>
              <div className="text-xs text-fv-text-secondary">
                {tile.href
                  ? subtitle[tile.key]
                  : `${subtitle[tile.key]} · coming soon`}
              </div>
            </>
          );

          return tile.href ? (
            <Link
              key={tile.key}
              href={tile.href}
              data-tour={tile.key}
              className="flex flex-col rounded-2xl bg-fv-bg-tile p-4 shadow-sm hover:shadow"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={tile.key}
              data-tour={tile.key}
              aria-disabled
              className="flex cursor-default flex-col rounded-2xl bg-fv-bg-tile p-4 opacity-60 shadow-sm"
            >
              {inner}
            </div>
          );
        })}
      </div>

      {showTour ? (
        <OnboardingTour
          steps={ONBOARDING_STEPS}
          mode={replay ? "replay" : "first-run"}
        />
      ) : null}
    </main>
  );
}
