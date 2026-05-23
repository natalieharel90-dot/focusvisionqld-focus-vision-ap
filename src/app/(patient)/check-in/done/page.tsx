import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadZoneContent } from "@/lib/zone-content";
import type { PatientZone } from "@/lib/zones";

export const dynamic = "force-dynamic";

// The patient never sees red (per spec); patient_zone is green / yellow /
// orange. Each gets its own hero treatment.
const ZONE: Record<
  PatientZone,
  { grad: string; icon: "check" | "warn" | "phone"; headline: string; sub: string | null }
> = {
  green: {
    grad: "from-emerald-500 to-emerald-700",
    icon: "check",
    headline: "You're tracking beautifully",
    sub: "everything looks normal",
  },
  yellow: {
    grad: "from-amber-400 to-amber-500",
    icon: "warn",
    headline: "On track — let's take it easy",
    sub: "symptoms are at the higher end of normal",
  },
  orange: {
    grad: "from-orange-400 to-orange-500",
    icon: "phone",
    headline: "Let's have a chat today",
    sub: null,
  },
};

function HeroIcon({ name }: { name: "check" | "warn" | "phone" }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-8 w-8",
  };
  const paths: Record<string, ReactNode> = {
    check: <path d="M20 6 9 17l-5-5" />,
    warn: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
  };
  return <svg {...props}>{paths[name]}</svg>;
}

export default async function CheckInDonePage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const id = searchParams.id;
  if (!id) redirect("/home");

  const { data: checkIn } = await supabase
    .from("check_ins")
    .select("patient_zone, recovery_day")
    .eq("id", id)
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!checkIn) notFound();

  const [{ data: procedure }, { data: clinic }] = await Promise.all([
    supabase
      .from("procedures")
      .select("procedure_type, surgeon_id")
      .eq("patient_id", user.id)
      .eq("status", "active")
      .order("surgery_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("clinic_profile")
      .select("name, phone")
      .limit(1)
      .maybeSingle(),
  ]);

  // Patient's surgeon for the after-hours fallback message.
  let surgeon: { name: string; phone: string | null } | null = null;
  if (procedure?.surgeon_id) {
    const { data: surgeonRow } = await supabase
      .from("staff_users")
      .select("name, display_name, phone")
      .eq("id", procedure.surgeon_id)
      .maybeSingle();
    if (surgeonRow) {
      surgeon = {
        name: surgeonRow.display_name || surgeonRow.name,
        phone: surgeonRow.phone,
      };
    }
  }

  const content = await loadZoneContent(supabase, {
    zone: checkIn.patient_zone,
    procedure_type: procedure?.procedure_type ?? null,
    surgeon_id: procedure?.surgeon_id ?? null,
  });

  const zone = ZONE[checkIn.patient_zone];
  const procLabel = procedure?.procedure_type?.toUpperCase() ?? null;
  const metaParts = [
    `Day ${checkIn.recovery_day}`,
    procLabel,
    zone.sub,
  ].filter(Boolean);

  return (
    <main className="flex flex-col gap-4 px-5 py-5">
      {/* Hero */}
      <section
        className={`flex flex-col items-center rounded-2xl bg-gradient-to-br ${zone.grad} px-5 py-7 text-center text-white shadow-sm`}
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/20">
          <HeroIcon name={zone.icon} />
        </span>
        <h1 className="mt-4 text-2xl font-bold">
          {content?.headline ?? zone.headline}
        </h1>
        <p className="mt-1.5 text-sm text-white/85">
          {metaParts.join(" · ")}
        </p>
      </section>

      {/* From your care team */}
      {content?.message ? (
        <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-fv-accent-strong"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" />
            </svg>
            <h2 className="text-base font-semibold text-fv-text-primary">
              From your care team
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-fv-text-secondary">
            {content.message}
          </p>
        </section>
      ) : null}

      {/* Yellow — take it easy tip */}
      {checkIn.patient_zone === "yellow" && content?.today_tip ? (
        <section className="rounded-r-2xl rounded-bl-2xl border-l-4 border-amber-500 bg-amber-50 p-4">
          <h2 className="text-base font-semibold text-amber-800">
            Take it easy today
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fv-text-secondary">
            {content.today_tip}
          </p>
        </section>
      ) : null}

      {/* Green & Yellow — expected symptoms */}
      {checkIn.patient_zone !== "orange" &&
      content?.expected_symptoms &&
      content.expected_symptoms.length > 0 ? (
        <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-fv-accent-strong"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <h2 className="text-base font-semibold text-fv-text-primary">
              Expected symptoms around this time
            </h2>
          </div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {content.expected_symptoms.map((s) => (
              <li key={s} className="flex gap-2.5 text-sm text-fv-text-primary">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-fv-accent" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Orange — contact the clinic */}
      {checkIn.patient_zone === "orange" ? (
        <>
          <section className="rounded-2xl bg-fv-bg-accent-soft px-5 py-4 text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {clinic?.name ?? "Your clinic"}
            </div>
            <div className="mt-1 text-2xl font-bold text-fv-text-primary">
              {clinic?.phone ?? "—"}
            </div>
            <div className="mt-0.5 text-xs text-fv-text-secondary">
              During clinic hours
            </div>
          </section>
          {clinic?.phone ? (
            <a
              href={`tel:${clinic.phone.replace(/[^\d+]/g, "")}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 px-5 py-3.5 text-base font-semibold text-white shadow-sm"
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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Call the clinic now
            </a>
          ) : null}
          <p className="text-center text-sm text-fv-text-secondary">
            After hours? Please go to your nearest emergency department, or
            contact your surgeon
            {surgeon ? (
              <>
                ,{" "}
                <span className="font-semibold text-fv-text-primary">
                  {surgeon.name}
                </span>
                {surgeon.phone ? (
                  <>
                    {" "}on{" "}
                    <a
                      href={`tel:${surgeon.phone.replace(/[^\d+]/g, "")}`}
                      className="font-semibold text-fv-text-primary underline"
                    >
                      {surgeon.phone}
                    </a>
                  </>
                ) : null}
                .
              </>
            ) : (
              " directly."
            )}
          </p>
        </>
      ) : null}

      {/* Severe-symptoms warning from the recovery guidance */}
      {content?.warning ? (
        <section className="rounded-r-2xl rounded-bl-2xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          {content.warning}
        </section>
      ) : null}

      <Link
        href="/home"
        className="mt-1 self-center text-sm font-semibold text-fv-accent-strong hover:underline"
      >
        Back to home
      </Link>
    </main>
  );
}
