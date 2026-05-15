import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadPatientFeatures } from "@/lib/patient-features-server";
import {
  DEFAULT_SURGERY_DAY_TEXT,
  PREOP_CHECKLIST,
  isPreOp,
  selectPreopContent,
  selectSurgeryDayText,
  surgeryCountdownLabel,
} from "@/lib/preop";

export const dynamic = "force-dynamic";

function brisbaneToday(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Brisbane",
  });
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PreOpPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  // The Pre-op tile/route is gated by the preop_tile feature flag.
  const features = await loadPatientFeatures(supabase, user.id);
  if (!features.preop_tile) redirect("/home");

  const today = brisbaneToday();

  const { data: procedures } = await supabase
    .from("procedures")
    .select("id, procedure_type, eye, surgeon_id, surgery_date, source_template_id")
    .eq("patient_id", user.id)
    .order("surgery_date", { ascending: true });

  // Pre-op procedures are those on or after today. After surgery the
  // screen is hidden — bounce post-op patients back home.
  const preOpProcedures = (procedures ?? []).filter((p) =>
    isPreOp(p.surgery_date, today)
  );
  if (preOpProcedures.length === 0) redirect("/home");

  const upcoming = preOpProcedures[0]!;

  const [{ data: surgeonRows }, { data: contentRows }, { data: templateRows }] =
    await Promise.all([
      supabase
        .from("staff_users")
        .select("id, name")
        .in(
          "id",
          [...new Set(preOpProcedures.map((p) => p.surgeon_id))]
        ),
      supabase.from("content_items").select("*"),
      supabase
        .from("procedure_templates")
        .select("id, procedure_type, surgery_day_text"),
    ]);

  const surgeonName = new Map(
    (surgeonRows ?? []).map((s) => [s.id, s.name])
  );

  const content = selectPreopContent(
    contentRows ?? [],
    upcoming.procedure_type
  );

  const surgeryDayText = selectSurgeryDayText(
    templateRows ?? [],
    upcoming.source_template_id,
    upcoming.procedure_type,
    DEFAULT_SURGERY_DAY_TEXT
  );

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      {/* Countdown */}
      <section className="rounded-2xl bg-fv-accent-strong p-5 text-white">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
          Before your surgery
        </div>
        <h1 className="mt-1 text-2xl font-semibold">
          {surgeryCountdownLabel(upcoming.surgery_date, today)}
        </h1>
        <p className="mt-1 text-sm opacity-90">
          {fmtDate(upcoming.surgery_date)}
        </p>
      </section>

      {/* Procedures */}
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fv-text-primary">
          Your procedure{preOpProcedures.length > 1 ? "s" : ""}
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {preOpProcedures.map((p) => (
            <li key={p.id} className="text-sm">
              <span className="font-medium text-fv-text-primary">
                {p.procedure_type.toUpperCase()} · {p.eye} eye
              </span>
              <span className="block text-xs text-fv-text-secondary">
                {surgeonName.get(p.surgeon_id) ?? "Your surgeon"} ·{" "}
                {fmtDate(p.surgery_date)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* What to expect on surgery day */}
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fv-text-primary">
          What to expect on surgery day
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-fv-text-secondary">
          {surgeryDayText}
        </p>
      </section>

      {/* Pre-op checklist */}
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fv-text-primary">
          Getting ready
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {PREOP_CHECKLIST.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-fv-text-secondary"
            >
              <span aria-hidden className="text-fv-accent-strong">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Pre-op content */}
      {content.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Helpful before your visit
          </h2>
          <ul className="flex flex-col gap-3">
            {content.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl bg-fv-bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-lg">
                    {item.type === "video" ? "▶️" : "📄"}
                  </span>
                  <span className="text-sm font-semibold text-fv-text-primary">
                    {item.title}
                  </span>
                </div>
                {item.body ? (
                  <p className="mt-1 text-sm text-fv-text-secondary">
                    {item.body}
                  </p>
                ) : null}
                {item.type === "video" && item.media_url ? (
                  <a
                    href={item.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-fv-accent-strong"
                  >
                    Watch video →
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
