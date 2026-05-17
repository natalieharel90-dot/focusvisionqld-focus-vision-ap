import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const RECOVERY_WINDOW = 90;

const ZONE: Record<string, { label: string; chip: string; bar: string }> = {
  green: {
    label: "On track",
    chip: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-500",
  },
  yellow: {
    label: "Yellow — review",
    chip: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  orange: {
    label: "Orange — contact today",
    chip: "bg-orange-100 text-orange-800",
    bar: "bg-orange-500",
  },
};

function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor(
    (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000
  );
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Brisbane",
  });
}

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Brisbane",
  });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function StaffAppPatientPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, date_of_birth, discharged_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!patient) notFound();

  const [proceduresRes, checkInsRes, medsRes, apptsRes, flagsRes] =
    await Promise.all([
      supabase
        .from("procedures")
        .select("procedure_type, eye, surgeon_id, surgery_date, facility_id, status")
        .eq("patient_id", patient.id)
        .order("surgery_date", { ascending: false }),
      supabase
        .from("check_ins")
        .select("recovery_day, patient_zone, pain, light_sensitivity, created_at")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("medications")
        .select("name, dose, frequency")
        .eq("patient_id", patient.id)
        .is("stopped_at", null)
        .order("name"),
      supabase
        .from("appointments")
        .select("scheduled_at, appointment_type, status")
        .eq("patient_id", patient.id)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1),
      supabase
        .from("manual_flags")
        .select("alert_level, reason, created_at")
        .eq("patient_id", patient.id)
        .is("resolved_at", null)
        .order("created_at", { ascending: false }),
    ]);

  const procedures = proceduresRes.data ?? [];
  const procedure =
    procedures.find((p) => p.status === "active") ?? procedures[0] ?? null;

  // Resolve surgeon + facility names.
  let surgeonName = "—";
  let facilityName: string | null = null;
  if (procedure) {
    const [{ data: surgeon }, facility] = await Promise.all([
      supabase
        .from("staff_users")
        .select("name, display_name")
        .eq("id", procedure.surgeon_id)
        .maybeSingle(),
      procedure.facility_id
        ? supabase
            .from("partner_facilities")
            .select("name")
            .eq("id", procedure.facility_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    surgeonName = surgeon?.display_name || surgeon?.name || "—";
    facilityName = facility.data?.name ?? null;
  }

  const checkIns = checkInsRes.data ?? [];
  const latest = checkIns[0] ?? null;
  const day =
    latest?.recovery_day ?? daysSince(procedure?.surgery_date ?? null) ?? 0;
  const zone = ZONE[latest?.patient_zone ?? "green"] ?? ZONE.green!;
  const pct = Math.min(100, Math.max(0, (day / RECOVERY_WINDOW) * 100));
  const flags = flagsRes.data ?? [];
  const nextAppt = apptsRes.data?.[0] ?? null;

  return (
    <div className="flex flex-col">
      {/* Sub-header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-fv-bg-soft bg-fv-bg-card px-3 py-2.5">
        <Link
          href="/staff-app/patients"
          aria-label="Back to patients"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fv-text-secondary hover:bg-fv-bg-soft"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <span className="truncate font-semibold text-fv-text-primary">
          {patient.name}
        </span>
        {patient.discharged_at ? (
          <span className="ml-auto shrink-0 rounded-full bg-fv-bg-soft px-2 py-0.5 text-[10px] font-semibold text-fv-text-secondary">
            Discharged
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 px-4 py-4">
        {/* Open flags — surfaced first */}
        {flags.length > 0 ? (
          <Section title="Active flags">
            {flags.map((f, i) => (
              <div
                key={i}
                className={`rounded-xl border-l-4 p-3 text-sm ${
                  f.alert_level === "red"
                    ? "border-red-500 bg-red-50 text-red-900"
                    : f.alert_level === "orange"
                      ? "border-orange-500 bg-orange-50 text-orange-900"
                      : "border-amber-500 bg-amber-50 text-amber-900"
                }`}
              >
                <div className="font-semibold capitalize">
                  {f.alert_level} flag
                </div>
                <div className="mt-0.5">{f.reason}</div>
              </div>
            ))}
          </Section>
        ) : null}

        {/* Surgery */}
        <Section title="Surgery">
          <div className="rounded-2xl bg-fv-bg-card p-4 shadow-sm">
            {procedure ? (
              <>
                <div className="font-bold text-fv-text-primary">
                  {procedure.procedure_type.toUpperCase()} · {surgeonName}
                </div>
                <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fv-text-secondary">Eye</dt>
                    <dd className="font-medium capitalize text-fv-text-primary">
                      {procedure.eye}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-fv-text-secondary">Surgery date</dt>
                    <dd className="font-medium text-fv-text-primary">
                      {fmtDate(procedure.surgery_date)}
                    </dd>
                  </div>
                  {facilityName ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-fv-text-secondary">Facility</dt>
                      <dd className="text-right font-medium text-fv-text-primary">
                        {facilityName}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </>
            ) : (
              <p className="text-sm text-fv-text-secondary">
                No procedure on record.
              </p>
            )}
          </div>
        </Section>

        {/* Recovery progress */}
        <Section title="Recovery progress">
          <div className="rounded-2xl bg-fv-bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-bold text-fv-text-primary">
                Day {day}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${zone.chip}`}
              >
                {zone.label}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-fv-bg-soft">
              <div
                className={`h-full rounded-full ${zone.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-fv-text-secondary">
              {day} of {RECOVERY_WINDOW} recovery days
            </div>
          </div>
        </Section>

        {/* Recent check-ins */}
        <Section title="Recent check-ins">
          {checkIns.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No check-ins submitted yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {checkIns.map((c, i) => {
                const z = ZONE[c.patient_zone ?? "green"] ?? ZONE.green!;
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl bg-fv-bg-card p-3 text-sm shadow-sm"
                  >
                    <div>
                      <div className="font-semibold text-fv-text-primary">
                        Day {c.recovery_day}
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        Pain {c.pain}/5 · Light {c.light_sensitivity}/5
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${z.chip}`}
                    >
                      {z.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Next appointment */}
        <Section title="Next appointment">
          {nextAppt ? (
            <div className="rounded-2xl bg-fv-bg-card p-4 text-sm shadow-sm">
              <div className="font-semibold text-fv-text-primary">
                {fmtDateTime(nextAppt.scheduled_at)}
              </div>
              <div className="mt-0.5 text-xs capitalize text-fv-text-secondary">
                {(nextAppt.appointment_type ?? "appointment").replace(
                  /_/g,
                  " "
                )}
                {" · "}
                {nextAppt.status}
              </div>
            </div>
          ) : (
            <p className="text-sm text-fv-text-secondary">
              No upcoming appointment.
            </p>
          )}
        </Section>

        {/* Medications */}
        <Section title="Current medications">
          {medsRes.data && medsRes.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {medsRes.data.map((m, i) => (
                <li
                  key={i}
                  className="rounded-xl bg-fv-bg-card p-3 text-sm shadow-sm"
                >
                  <div className="font-semibold text-fv-text-primary">
                    {m.name}
                  </div>
                  <div className="text-xs text-fv-text-secondary">
                    {m.dose} · {m.frequency}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fv-text-secondary">
              No active medications.
            </p>
          )}
        </Section>

        <p className="pb-2 text-center text-xs text-fv-text-secondary">
          A read-only summary. Open the full dashboard to make changes.
        </p>
      </div>
    </div>
  );
}
