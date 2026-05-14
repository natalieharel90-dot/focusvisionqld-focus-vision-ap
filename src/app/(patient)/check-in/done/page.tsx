import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadZoneContent } from "@/lib/zone-content";
import type { PatientZone } from "@/lib/zones";

export const dynamic = "force-dynamic";

// Zone-specific colours for the hero card. The patient never sees red
// (per spec); patient_zone is constrained to green / yellow / orange.
const ZONE_STYLES: Record<PatientZone, { bg: string; text: string; chip: string }> = {
  green: {
    bg: "bg-green-100",
    text: "text-green-900",
    chip: "On track",
  },
  yellow: {
    bg: "bg-yellow-100",
    text: "text-yellow-900",
    chip: "Keep an eye on this",
  },
  orange: {
    bg: "bg-orange-100",
    text: "text-orange-900",
    chip: "We'll be in touch",
  },
};

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

  const { data: procedure } = await supabase
    .from("procedures")
    .select("procedure_type, surgeon_id")
    .eq("patient_id", user.id)
    .eq("status", "active")
    .order("surgery_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const content = await loadZoneContent(supabase, {
    zone: checkIn.patient_zone,
    procedure_type: procedure?.procedure_type ?? null,
    surgeon_id: procedure?.surgeon_id ?? null,
  });

  const style = ZONE_STYLES[checkIn.patient_zone];

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <section className={`rounded-2xl ${style.bg} p-5 ${style.text}`}>
        <div className="text-xs font-bold uppercase tracking-wider opacity-75">
          Day {checkIn.recovery_day} · {style.chip}
        </div>
        <h1 className="mt-2 text-2xl font-semibold">
          {content?.headline ?? style.chip}
        </h1>
        {content?.message ? (
          <p className="mt-3 text-sm leading-relaxed">{content.message}</p>
        ) : null}
      </section>

      {content?.expected_symptoms && content.expected_symptoms.length > 0 ? (
        <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-fv-text-primary">
            What&apos;s normal right now
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fv-text-primary">
            {content.expected_symptoms.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {content?.today_tip ? (
        <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-fv-text-primary">
            Today&apos;s tip
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fv-text-primary">
            {content.today_tip}
          </p>
        </section>
      ) : null}

      {content?.instructions ? (
        <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-fv-text-primary">
            What to do
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fv-text-primary">
            {content.instructions}
          </p>
        </section>
      ) : null}

      {content?.warning ? (
        <section className="rounded-2xl bg-orange-50 p-5 text-orange-900">
          <p className="text-sm font-medium leading-relaxed">
            {content.warning}
          </p>
        </section>
      ) : null}

      <Link
        href="/home"
        className="mt-2 self-center text-sm font-semibold text-fv-accent-strong hover:underline"
      >
        Back to home
      </Link>
    </main>
  );
}
