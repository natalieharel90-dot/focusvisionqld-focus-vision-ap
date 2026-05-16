import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  documentKind,
  groupDocumentsByCategory,
  relativeTime,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

// ── Icons ────────────────────────────────────────────────────────────────
type IconName = "file" | "pill" | "card" | "image" | "camera" | "check";

function Icon({ name }: { name: IconName }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
  };
  const paths: Record<IconName, ReactNode> = {
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </>
    ),
    pill: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 8.5 15.5 15.5" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    check: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
  };
  return <svg {...props}>{paths[name]}</svg>;
}

// Pick a category-appropriate icon — the prototype shows pill / card icons
// for scripts and receipts, not a generic file icon.
function docIcon(category: string, filename: string): IconName {
  if (/script|prescription|medication/i.test(category)) return "pill";
  if (/receipt|invoice|finance|tax|aftercare/i.test(category)) return "card";
  if (/photo/i.test(category)) return "camera";
  return documentKind(filename) === "image" ? "image" : "file";
}

// ── Relative-day helpers ─────────────────────────────────────────────────
function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

// "Today" / "Yesterday" / "11 May" for a check-in.
function dayLabel(iso: string): string {
  const diff = Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000
  );
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
  });
}

// "Today, 9:14 AM" / "May 11, 9:32 AM" for a recovery photo.
function photoTime(iso: string): string {
  const d = new Date(iso);
  const time = d
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
    .toUpperCase();
  const diff = Math.round(
    (startOfDay(new Date()) - startOfDay(d)) / 86_400_000
  );
  if (diff <= 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  })}, ${time}`;
}

const ZONE: Record<string, { label: string; tile: string; word: string }> = {
  green: {
    label: "Green",
    tile: "bg-emerald-100 text-emerald-700",
    word: "text-emerald-700",
  },
  yellow: {
    label: "Yellow",
    tile: "bg-amber-100 text-amber-700",
    word: "text-amber-700",
  },
  orange: {
    label: "Orange",
    tile: "bg-orange-100 text-orange-700",
    word: "text-orange-700",
  },
};

const cardCls =
  "flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm";
const tileCls = "grid h-12 w-12 shrink-0 place-items-center rounded-xl";

function Chevron() {
  return (
    <span aria-hidden className="shrink-0 text-lg text-fv-text-secondary">
      ›
    </span>
  );
}

export default async function PatientDocumentsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const [documentsRes, checkInsRes, photosRes] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, category, filename, uploaded_at")
      .eq("patient_id", user.id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("check_ins")
      .select("id, recovery_day, vision, pain, patient_zone, created_at")
      .eq("patient_id", user.id)
      .order("recovery_day", { ascending: false }),
    supabase
      .from("eye_photos")
      .select("id, recovery_day, check_in_id, captured_at")
      .eq("patient_id", user.id)
      .order("captured_at", { ascending: false }),
  ]);

  const groups = groupDocumentsByCategory(documentsRes.data ?? []);
  const checkIns = checkInsRes.data ?? [];
  const photos = photosRes.data ?? [];
  const photoCheckInIds = new Set(
    photos.map((p) => p.check_in_id).filter(Boolean)
  );

  const isEmpty =
    groups.length === 0 && checkIns.length === 0 && photos.length === 0;

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          My documents
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          All your surgery paperwork in one place
        </p>
      </header>

      {isEmpty ? (
        <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No documents yet. Anything your clinic shares — and your own
          check-ins and photos — will appear here.
        </div>
      ) : null}

      {/* Document categories */}
      {groups.map((group) => (
        <section key={group.category}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            {group.category}
          </h2>
          <div className="flex flex-col gap-2.5">
            {group.documents.map((doc) => {
              const kind = documentKind(doc.filename);
              const kindLabel =
                kind === "pdf" ? "PDF" : kind === "image" ? "Image" : "File";
              return (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className={cardCls}
                >
                  <span
                    className={`${tileCls} bg-fv-bg-accent-soft text-fv-accent-strong`}
                  >
                    <Icon name={docIcon(group.category, doc.filename)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-fv-text-primary">
                      {doc.title ?? doc.filename}
                    </span>
                    <span className="block truncate text-sm text-fv-text-secondary">
                      {kindLabel} · uploaded {relativeTime(doc.uploaded_at)}
                    </span>
                  </span>
                  <Chevron />
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {/* Check-in history */}
      {checkIns.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Check-in history
          </h2>
          <div className="flex flex-col gap-2.5">
            {checkIns.map((c) => {
              const zone = ZONE[c.patient_zone] ?? ZONE.green!;
              const hasPhoto = photoCheckInIds.has(c.id);
              return (
                <Link
                  key={c.id}
                  href={`/check-in/done?id=${c.id}`}
                  className={cardCls}
                >
                  <span className={`${tileCls} ${zone.tile}`}>
                    <Icon name="check" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-fv-text-primary">
                      Day {c.recovery_day} · {dayLabel(c.created_at)}
                    </span>
                    <span className="block truncate text-sm text-fv-text-secondary">
                      <span className={`font-semibold ${zone.word}`}>
                        {zone.label}
                      </span>{" "}
                      · Pain {c.pain}/5 · Vision &ldquo;{c.vision}&rdquo;
                      {hasPhoto ? " · photo attached" : ""}
                    </span>
                  </span>
                  <Chevron />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Recovery photos */}
      {photos.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Recovery photos
          </h2>
          <div className="flex flex-col gap-2.5">
            {photos.map((p) => {
              const inner = (
                <>
                  <span className={`${tileCls} bg-sky-100 text-sky-700`}>
                    <Icon name="camera" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-fv-text-primary">
                      {p.recovery_day != null
                        ? `Day ${p.recovery_day} — eye photo`
                        : "Eye photo"}
                    </span>
                    <span className="block truncate text-sm text-fv-text-secondary">
                      {photoTime(p.captured_at)}
                      {p.check_in_id ? " · attached to check-in" : ""}
                    </span>
                  </span>
                  {p.check_in_id ? <Chevron /> : null}
                </>
              );
              return p.check_in_id ? (
                <Link
                  key={p.id}
                  href={`/check-in/done?id=${p.check_in_id}`}
                  className={cardCls}
                >
                  {inner}
                </Link>
              ) : (
                <div key={p.id} className={cardCls}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
