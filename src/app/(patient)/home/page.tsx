import Link from "next/link";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isPreOp, surgeryCountdownLabel } from "@/lib/preop";
import { ONBOARDING_STEPS, shouldShowOnboarding } from "@/lib/onboarding";
import { OnboardingTour } from "@/components/patient/OnboardingTour";
import { loadPatientFeatures } from "@/lib/patient-features-server";
import { selectNextAppointment } from "@/lib/appointments";
import { NextAppointmentCard } from "@/components/patient/NextAppointmentCard";
import { initials } from "@/lib/bulk-push";

export const dynamic = "force-dynamic";

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

function greeting(): string {
  const hr = Number(
    new Date().toLocaleString("en-US", {
      timeZone: "Australia/Brisbane",
      hour: "numeric",
      hour12: false,
    })
  );
  if (hr < 12) return "Good morning";
  if (hr < 18) return "Good afternoon";
  return "Good evening";
}

function fmtClock(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-AU", {
      timeZone: "Australia/Brisbane",
      hour: "numeric",
      minute: "2-digit",
    })
    .toUpperCase();
}

// Stroked icon glyphs for the home tiles + cards.
function TileIcon({ name }: { name: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
  };
  const paths: Record<string, ReactNode> = {
    pill: (
      <>
        <path d="m10.5 20.5-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </>
    ),
    video: (
      <>
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" />
      </>
    ),
    doc: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </>
    ),
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    chat: (
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    check: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="3" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" />
      </>
    ),
  };
  return <svg {...props}>{paths[name] ?? paths.file}</svg>;
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

  // Day boundaries in the clinic's timezone (Brisbane, UTC+10, no DST) so
  // "today" doesn't drift by ~10 hours on a UTC server.
  const brisbaneDay = brisbaneToday();
  const startOfDay = new Date(`${brisbaneDay}T00:00:00+10:00`);
  const endOfDay = new Date(`${brisbaneDay}T23:59:59.999+10:00`);

  const [
    patientResult,
    procedureResult,
    medsResult,
    threadResult,
    setupResult,
    prefsResult,
    appointmentsResult,
    checkInResult,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("first_name, name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("procedures")
      .select("procedure_type, surgery_date, surgeon_id")
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
    supabase
      .from("check_ins")
      .select("id")
      .eq("patient_id", user.id)
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString())
      .limit(1),
  ]);

  const features = await loadPatientFeatures(supabase, user.id);
  const procedure = procedureResult.data;
  const today = brisbaneToday();
  const preOp = isPreOp(procedure?.surgery_date ?? null, today);
  const recoveryDay = daysSince(procedure?.surgery_date ?? null);
  const firstName =
    patientResult.data?.first_name ||
    patientResult.data?.name?.split(" ")[0] ||
    "there";
  const checkedInToday = (checkInResult.data ?? []).length > 0;

  // Next appointment + its clinician.
  const nextAppointment = selectNextAppointment(
    appointmentsResult.data ?? [],
    new Date()
  );
  let nextApptClinician: string | null = null;
  if (nextAppointment?.clinician_id) {
    const { data: clinician } = await supabase
      .from("staff_users")
      .select("display_name, name")
      .eq("id", nextAppointment.clinician_id)
      .maybeSingle();
    nextApptClinician = clinician?.display_name || clinician?.name || null;
  }

  // Surgeon Spotlight — the patient's surgeon's welcome video.
  let spotlight: { name: string; url: string } | null = null;
  if (features.surgeon_spotlight && procedure?.surgeon_id) {
    const { data: surgeon } = await supabase
      .from("staff_users")
      .select("display_name, name, welcome_video_url")
      .eq("id", procedure.surgeon_id)
      .maybeSingle();
    if (surgeon?.welcome_video_url) {
      spotlight = {
        name: surgeon.display_name || surgeon.name,
        url: surgeon.welcome_video_url,
      };
    }
  }

  // Today's dose count + the soonest upcoming dose time.
  const medIds = (medsResult.data ?? []).map((m) => m.id);
  let dosesToday = 0;
  let nextDoseAt: string | null = null;
  if (medIds.length > 0) {
    const [{ count }, { data: nextDose }] = await Promise.all([
      supabase
        .from("medication_doses")
        .select("id", { count: "exact", head: true })
        .in("medication_id", medIds)
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString()),
      supabase
        .from("medication_doses")
        .select("scheduled_at")
        .in("medication_id", medIds)
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    dosesToday = count ?? 0;
    nextDoseAt = nextDose?.scheduled_at ?? null;
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

  const replay = searchParams.tour === "replay";
  const showTour =
    replay ||
    shouldShowOnboarding(
      setupResult.data?.status,
      prefsResult.data?.onboarding_completed_at
    );

  type Tile = {
    key: string;
    icon: string;
    title: string;
    sub: string;
    href: string | null;
    badge?: number;
  };
  const tiles: Tile[] = [
    {
      key: "medications",
      icon: "pill",
      title: "Medications",
      sub: nextDoseAt
        ? `Next dose · ${fmtClock(nextDoseAt)}`
        : medIds.length > 0
          ? `${medIds.length} active`
          : "None scheduled",
      href: "/medications",
      badge: dosesToday,
    },
    {
      key: "videos",
      icon: "video",
      title: "Videos & info",
      sub: "Short recovery guides for you",
      href: "/videos",
    },
    {
      key: "documents",
      icon: "doc",
      title: "My documents",
      sub: "Surgery report, scripts, receipts",
      href: "/documents",
    },
    {
      key: "contact",
      icon: "phone",
      title: "Contact clinic",
      sub: "Call, message or book follow-up",
      href: "/contact",
      badge: unread,
    },
    ...(features.feedback_tile
      ? [
          {
            key: "feedback",
            icon: "chat",
            title: "Leave feedback",
            sub: "Help us improve · 2 min",
            href: "/feedback",
          } as Tile,
        ]
      : []),
    {
      key: "settings",
      icon: "gear",
      title: "Settings",
      sub: "Theme, reminders, profile",
      href: "/preferences",
    },
  ];

  return (
    <main className="flex flex-col gap-4 px-5 py-5">
      {/* Greeting */}
      <header>
        <p className="text-sm text-fv-text-secondary">{greeting()},</p>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          {firstName}
        </h1>
        {procedure && !preOp && recoveryDay != null ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fv-bg-accent-soft px-3 py-1 text-sm font-semibold text-fv-accent-strong">
            <span className="h-2 w-2 rounded-full bg-fv-accent" />
            Day {recoveryDay} of recovery ·{" "}
            {procedure.procedure_type.toUpperCase()}
          </span>
        ) : preOp && procedure ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fv-bg-accent-soft px-3 py-1 text-sm font-semibold text-fv-accent-strong">
            <span className="h-2 w-2 rounded-full bg-fv-accent" />
            {surgeryCountdownLabel(procedure.surgery_date, today)} ·{" "}
            {procedure.procedure_type.toUpperCase()}
          </span>
        ) : null}
      </header>

      {/* Next appointment */}
      {nextAppointment ? (
        <NextAppointmentCard
          appointment={nextAppointment}
          clinicianName={nextApptClinician}
        />
      ) : null}

      {/* A message for you — Surgeon Spotlight */}
      {spotlight ? (
        <Link
          href="/welcome"
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-fv-accent to-fv-accent-strong p-4 text-white shadow-sm"
        >
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-semibold">
            {initials(spotlight.name)}
            <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-white text-xs text-fv-accent-strong">
              ▶
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
              A message for you
            </div>
            <div className="truncate font-semibold">
              From {spotlight.name}
            </div>
            <div className="text-sm text-white/85">▶ Personal welcome</div>
          </div>
          <span aria-hidden className="text-white/70">
            ›
          </span>
        </Link>
      ) : null}

      {/* Today's check-in CTA */}
      <Link
        href="/check-in"
        className="rounded-2xl bg-gradient-to-br from-fv-accent to-fv-accent-strong p-5 text-white shadow-sm"
      >
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/20">
          <TileIcon name="check" />
        </span>
        <div className="mt-3 text-lg font-semibold">
          {checkedInToday ? "Check-in done for today" : "Today's check-in"}
        </div>
        <div className="text-sm text-white/85">
          {checkedInToday
            ? "Thanks — your care team has it."
            : "2 minutes · helps your care team"}
        </div>
        {!checkedInToday ? (
          <div className="mt-2 text-sm font-semibold">Start now ›</div>
        ) : null}
      </Link>

      {/* Tile grid */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-fv-bg-accent-soft text-fv-accent-strong">
                  <TileIcon name={tile.icon} />
                </span>
                {tile.badge && tile.badge > 0 ? (
                  <span className="grid h-7 min-w-7 place-items-center rounded-xl bg-fv-accent-strong px-1.5 text-sm font-bold text-white">
                    {tile.badge}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-base font-semibold text-fv-text-primary">
                {tile.title}
              </div>
              <div className="text-xs text-fv-text-secondary">{tile.sub}</div>
            </>
          );
          return tile.href ? (
            <Link
              key={tile.key}
              href={tile.href}
              className="flex flex-col rounded-2xl bg-fv-bg-tile p-4 shadow-sm hover:shadow"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={tile.key}
              className="flex flex-col rounded-2xl bg-fv-bg-tile p-4 shadow-sm"
            >
              {inner}
            </div>
          );
        })}
      </div>

      {/* Pre-op information — shown until surgery day. */}
      {preOp && procedure && features.preop_tile ? (
        <Link
          href="/pre-op"
          className="flex items-center gap-3 rounded-2xl bg-fv-bg-accent-soft p-4 shadow-sm"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-fv-bg-card text-fv-accent-strong">
            <TileIcon name="file" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-fv-text-primary">
              Pre-op information
            </div>
            <div className="text-xs text-fv-text-secondary">
              Your surgery prep checklist, videos &amp; FAQs
            </div>
          </div>
          <span aria-hidden className="text-fv-text-secondary">
            ›
          </span>
        </Link>
      ) : null}

      {showTour ? (
        <OnboardingTour
          steps={ONBOARDING_STEPS}
          mode={replay ? "replay" : "first-run"}
        />
      ) : null}
    </main>
  );
}
