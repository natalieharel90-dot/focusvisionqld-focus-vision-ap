import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadPatientFeatures } from "@/lib/patient-features-server";
import { summariseHours, type OpeningHours } from "@/lib/contact";
import {
  DEFAULT_SURGERY_DAY_TEXT,
  getPreopChecklist,
  isPreOp,
  selectPreopContent,
} from "@/lib/preop";

export const dynamic = "force-dynamic";

type ContentItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  media_url: string | null;
  procedures: string[];
  audience: string;
};

function brisbaneToday(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Brisbane",
  });
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Stable gradient per video — content_items has no stored thumbnail.
const GRADIENTS = [
  "from-sky-500 to-teal-700",
  "from-teal-500 to-teal-700",
  "from-amber-300 via-lime-300 to-teal-500",
  "from-cyan-500 to-teal-700",
];
function gradientFor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return GRADIENTS[h % GRADIENTS.length]!;
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
    .select(
      "id, procedure_type, surgeon_id, surgery_date, facility_id, source_template_id"
    )
    .eq("patient_id", user.id)
    .order("surgery_date", { ascending: true });

  // Pre-op procedures are those on or after today. After surgery the
  // screen is hidden — bounce post-op patients back home.
  const preOpProcedures = (procedures ?? []).filter((p) =>
    isPreOp(p.surgery_date, today)
  );
  if (preOpProcedures.length === 0) redirect("/home");

  const upcoming = preOpProcedures[0]!;

  const [
    { data: surgeonRow },
    { data: contentRows },
    { data: clinic },
    { data: templateRow },
  ] = await Promise.all([
    supabase
      .from("staff_users")
      .select("name")
      .eq("id", upcoming.surgeon_id)
      .maybeSingle(),
    supabase
      .from("content_items")
      .select("id, type, title, body, media_url, procedures, audience"),
    supabase
      .from("clinic_profile")
      .select("phone, opening_hours")
      .limit(1)
      .maybeSingle(),
    upcoming.source_template_id
      ? supabase
          .from("procedure_templates")
          .select("surgery_day_text")
          .eq("id", upcoming.source_template_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Try the patient's own template first, then any template for this
  // procedure type, then the clinic-wide default text.
  let surgeryDayText: string =
    templateRow?.surgery_day_text ?? DEFAULT_SURGERY_DAY_TEXT;
  if (!templateRow?.surgery_day_text) {
    const { data: fallback } = await supabase
      .from("procedure_templates")
      .select("surgery_day_text")
      .eq("procedure_type", upcoming.procedure_type)
      .not("surgery_day_text", "is", null)
      .limit(1)
      .maybeSingle();
    if (fallback?.surgery_day_text) surgeryDayText = fallback.surgery_day_text;
  }
  const checklist = getPreopChecklist(upcoming.procedure_type);

  let facilityName: string | null = null;
  if (upcoming.facility_id) {
    const { data: facility } = await supabase
      .from("partner_facilities")
      .select("name")
      .eq("id", upcoming.facility_id)
      .maybeSingle();
    facilityName = facility?.name ?? null;
  }

  const content = selectPreopContent(
    (contentRows ?? []) as ContentItem[],
    upcoming.procedure_type
  );
  const videos = content.filter((c) => c.type === "video");
  const questions = content.filter((c) => c.type === "faq");

  const surgeonName = surgeonRow?.name ?? "Your surgeon";
  const hours = clinic
    ? summariseHours((clinic.opening_hours ?? {}) as OpeningHours)
    : "";

  return (
    <main className="flex flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          Pre-op information
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Everything you need to know before surgery day
        </p>
      </header>

      {/* Your surgery */}
      <section className="flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-fv-bg-accent-soft text-fv-accent-strong">
          <CalendarIcon />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
            Your surgery
          </div>
          <div className="font-bold text-fv-text-primary">
            {upcoming.procedure_type.toUpperCase()} · {surgeonName}
          </div>
          <div className="mt-0.5 text-sm text-fv-text-secondary">
            Scheduled for {fmtDate(upcoming.surgery_date)}
            {facilityName ? ` at ${facilityName}` : ""}
          </div>
        </div>
      </section>

      {/* What to expect on surgery day */}
      <Section title="What to expect on surgery day">
        <div className="whitespace-pre-line rounded-2xl bg-fv-bg-card p-5 text-sm leading-relaxed text-fv-text-primary shadow-sm">
          {surgeryDayText}
        </div>
      </Section>

      {/* Day-before checklist */}
      <Section title="Day-before checklist">
        <div className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <ul className="flex flex-col gap-3">
            {checklist.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-relaxed text-fv-text-primary"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-fv-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Videos */}
      {videos.length > 0 ? (
        <Section title="Videos to watch before surgery">
          {videos.map((v) => {
            const card = (
              <div className="overflow-hidden rounded-2xl bg-fv-bg-card shadow-sm">
                <div
                  className={`grid h-44 place-items-center bg-gradient-to-br ${gradientFor(
                    v.id
                  )}`}
                >
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-fv-accent-strong">
                    <PlayIcon />
                  </span>
                </div>
                <div className="p-4">
                  <div className="font-semibold text-fv-text-primary">
                    {v.title}
                  </div>
                  {v.body ? (
                    <div className="mt-0.5 text-sm text-fv-text-secondary">
                      {v.body}
                    </div>
                  ) : null}
                </div>
              </div>
            );
            return v.media_url ? (
              <a key={v.id} href={v.media_url} target="_blank" rel="noreferrer">
                {card}
              </a>
            ) : (
              <div key={v.id}>{card}</div>
            );
          })}
        </Section>
      ) : null}

      {/* Common questions */}
      {questions.length > 0 ? (
        <Section title="Common questions">
          {questions.map((q) => {
            const inner = (
              <>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-fv-bg-accent-soft text-fv-accent-strong">
                  <QuestionIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fv-text-primary">
                    {q.title}
                  </span>
                  {q.body ? (
                    <span className="mt-0.5 block text-sm text-fv-text-secondary">
                      {q.body}
                    </span>
                  ) : null}
                </span>
                {q.media_url ? (
                  <span
                    aria-hidden
                    className="shrink-0 self-center text-lg text-fv-text-secondary"
                  >
                    ›
                  </span>
                ) : null}
              </>
            );
            const cls =
              "flex items-start gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm";
            return q.media_url ? (
              <a
                key={q.id}
                href={q.media_url}
                target="_blank"
                rel="noreferrer"
                className={cls}
              >
                {inner}
              </a>
            ) : (
              <div key={q.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </Section>
      ) : null}

      {/* Day-of contact */}
      {clinic?.phone ? (
        <Section title="Day-of contact">
          <div className="rounded-2xl bg-fv-bg-accent-soft px-5 py-5 text-center">
            <div className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
              If you have questions before surgery
            </div>
            <a
              href={`tel:${clinic.phone.replace(/[^\d+]/g, "")}`}
              className="mt-1 block text-3xl font-bold text-fv-text-primary"
            >
              {clinic.phone}
            </a>
            {hours ? (
              <div className="mt-0.5 text-sm text-fv-text-secondary">
                {hours}
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}
    </main>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-fv-text-secondary">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
