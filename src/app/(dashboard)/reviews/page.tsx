import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import { averageRating } from "@/lib/feedback";
import {
  markFeedbackContactedAction,
  replyToFeedbackAction,
} from "./actions";

export const dynamic = "force-dynamic";

const REPLY_PREFILL =
  "Hi — thank you so much for taking the time to share your feedback with " +
  "us. It genuinely helps us improve. ";

// The filter chips across the top of the list.
const FILTERS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "all", label: "All reviews" },
  { key: "clinic", label: "Focus Vision" },
  { key: "hospital", label: "Hospital" },
  { key: "app", label: "App" },
  { key: "contact", label: "★ Contact requested" },
];

const TARGET_LABEL: Record<string, string> = {
  clinic: "Focus Vision",
  hospital: "Hospital",
  app: "App",
};

function stars(rating: number): string {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(0, 5 - rating);
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Up to this many reviews render per page.
const PAGE_SIZE = 20;

function reviewHref(opts: {
  filter?: string;
  q?: string;
  feedback?: string;
  page?: number;
}): string {
  const p = new URLSearchParams();
  if (opts.filter && opts.filter !== "all") p.set("filter", opts.filter);
  if (opts.q) p.set("q", opts.q);
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  if (opts.feedback) p.set("feedback", opts.feedback);
  const s = p.toString();
  return s ? `/reviews?${s}` : "/reviews";
}

type FeedbackRow = {
  id: string;
  patient_id: string;
  target: string;
  rating: number;
  comment: string | null;
  staff_mention: string | null;
  contact_requested: boolean;
  recovery_day: number | null;
  acknowledged_at: string | null;
  acknowledged_by_staff_id: string | null;
  submitted_at: string;
};

export default async function StaffFeedbackPage({
  searchParams,
}: {
  searchParams: {
    filter?: string;
    q?: string;
    page?: string;
    feedback?: string;
    error?: string;
  };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const filter = FILTERS.some((f) => f.key === searchParams.filter)
    ? searchParams.filter!
    : "all";
  const q = (searchParams.q ?? "").trim();

  const { data: feedbackData } = await supabase
    .from("feedback")
    .select("*")
    .order("submitted_at", { ascending: false });
  const allRows = (feedbackData ?? []) as FeedbackRow[];

  // Resolve patient + staff names.
  const patientIds = [...new Set(allRows.map((r) => r.patient_id))];
  const staffIds = [
    ...new Set(
      allRows
        .map((r) => r.acknowledged_by_staff_id)
        .filter((id): id is string => id !== null)
    ),
  ];
  const [patientsRes, staffRes] = await Promise.all([
    patientIds.length
      ? supabase.from("patients").select("id, name").in("id", patientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    staffIds.length
      ? supabase.from("staff_users").select("id, name").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const patientName = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const staffName = new Map((staffRes.data ?? []).map((s) => [s.id, s.name]));

  // ── Summary metrics ──
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const newThisWeek = allRows.filter(
    (r) => Date.parse(r.submitted_at) >= weekAgo
  ).length;
  const overallAvg = allRows.length
    ? averageRating(allRows.map((r) => r.rating))
    : null;

  const today = new Date();
  const monthStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  ).getTime();
  const lastMonthStart = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  ).getTime();
  const totalThisMonth = allRows.filter(
    (r) => Date.parse(r.submitted_at) >= monthStart
  ).length;
  const totalLastMonth = allRows.filter((r) => {
    const t = Date.parse(r.submitted_at);
    return t >= lastMonthStart && t < monthStart;
  }).length;
  const monthDelta = totalThisMonth - totalLastMonth;

  // Staff mentions — count + the most-named person.
  const mentionCounts = new Map<string, number>();
  for (const r of allRows) {
    const m = r.staff_mention?.trim();
    if (m) mentionCounts.set(m, (mentionCounts.get(m) ?? 0) + 1);
  }
  const staffMentionCount = [...mentionCounts.values()].reduce(
    (s, n) => s + n,
    0
  );
  let mostMentioned: string | null = null;
  let mostMentionedN = 0;
  for (const [name, n] of mentionCounts) {
    if (n > mostMentionedN) {
      mostMentionedN = n;
      mostMentioned = name;
    }
  }

  const contactRequested = allRows.filter((r) => r.contact_requested).length;
  const awaitingReply = allRows.filter(
    (r) => r.contact_requested && !r.acknowledged_at
  ).length;

  // ── Filter counts + the filtered/searched list ──
  const countFor = (key: string): number => {
    if (key === "all") return allRows.length;
    if (key === "contact") return contactRequested;
    return allRows.filter((r) => r.target === key).length;
  };

  const ql = q.toLowerCase();
  const rows = allRows.filter((r) => {
    if (filter === "contact" && !r.contact_requested) return false;
    if (
      filter !== "all" &&
      filter !== "contact" &&
      r.target !== filter
    ) {
      return false;
    }
    if (ql) {
      const hay = [
        r.comment ?? "",
        patientName.get(r.patient_id) ?? "",
        r.staff_mention ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });

  // Pagination — at most PAGE_SIZE reviews per page.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(
    totalPages,
    Math.max(1, Math.floor(Number(searchParams.page) || 1))
  );
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstShown = rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = (page - 1) * PAGE_SIZE + pagedRows.length;

  const detail = searchParams.feedback
    ? allRows.find((r) => r.id === searchParams.feedback) ?? null
    : null;

  const stats = [
    {
      label: "Total this month",
      value: String(totalThisMonth),
      sub: (
        <span
          className={
            monthDelta > 0
              ? "text-green-600"
              : monthDelta < 0
                ? "text-red-600"
                : "text-fv-text-secondary"
          }
        >
          {monthDelta > 0 ? "↑" : monthDelta < 0 ? "↓" : "→"}{" "}
          {Math.abs(monthDelta)} vs last month
        </span>
      ),
    },
    {
      label: "Average rating",
      value: overallAvg == null ? "—" : overallAvg.toFixed(1),
      sub: "Out of 5",
    },
    {
      label: "Staff mentions",
      value: String(staffMentionCount),
      sub:
        mostMentioned == null
          ? "No mentions yet"
          : `Most named: ${mostMentioned}`,
    },
    {
      label: "Contact requested",
      value: String(contactRequested),
      sub: `${awaitingReply} awaiting reply`,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            Feedback
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            {newThisWeek} new this week · Average rating{" "}
            {overallAvg == null ? "—" : overallAvg.toFixed(1)} out of 5
          </p>
        </div>
        <form method="get" className="w-full max-w-xs">
          {filter !== "all" ? (
            <input type="hidden" name="filter" value={filter} />
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search comments, patient or staff name…"
            className="w-full rounded-lg border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm focus:border-fv-accent focus:outline-none"
          />
        </form>
      </div>

      {searchParams.error ? (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {s.label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-fv-text-primary">
              {s.value}
            </div>
            <div className="mt-1 text-xs text-fv-text-secondary">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={reviewHref({ filter: f.key, q })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                active
                  ? "bg-fv-accent-strong text-white"
                  : "border border-fv-border text-fv-text-secondary hover:bg-fv-bg-soft"
              }`}
            >
              {f.label} ({countFor(f.key)})
            </Link>
          );
        })}
      </div>

      {/* Rows */}
      <ul className="mt-4 flex flex-col gap-2">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-fv-bg-soft bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary">
            {q
              ? "No feedback matches your search."
              : "No feedback in this category yet."}
          </li>
        ) : (
          pagedRows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-fv-bg-soft bg-fv-bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fv-bg-soft text-xs font-semibold text-fv-text-secondary">
                  {initials(patientName.get(r.patient_id) ?? "?")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-fv-text-primary">
                      {patientName.get(r.patient_id) ?? "Unknown patient"}
                    </span>
                    <span className="text-fv-accent-warm">
                      {stars(r.rating)}
                    </span>
                    <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                      {TARGET_LABEL[r.target] ?? r.target}
                    </span>
                    <span className="text-xs text-fv-text-secondary">
                      {r.recovery_day != null
                        ? `Day ${r.recovery_day}`
                        : "Pre-op"}{" "}
                      · {fmt(r.submitted_at)}
                    </span>
                    {r.contact_requested && !r.acknowledged_at ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                        Follow-up requested
                      </span>
                    ) : null}
                    {r.acknowledged_at ? (
                      <span className="rounded-full bg-fv-bg-accent-soft px-2 py-0.5 text-xs text-fv-accent-strong">
                        Acknowledged
                      </span>
                    ) : null}
                  </div>
                  {r.comment ? (
                    <p className="mt-1 text-sm text-fv-text-primary">
                      {r.comment}
                    </p>
                  ) : null}
                  {r.staff_mention ? (
                    <p className="mt-0.5 text-xs text-fv-text-secondary">
                      Mentioned: {r.staff_mention}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Per-review actions */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-fv-bg-soft pt-3">
                {r.acknowledged_at ? (
                  <span className="text-xs font-medium text-fv-text-secondary">
                    ✓ Contacted
                  </span>
                ) : (
                  <form action={markFeedbackContactedAction}>
                    <input type="hidden" name="feedback_id" value={r.id} />
                    <input type="hidden" name="filter" value={filter} />
                    <input type="hidden" name="q" value={q} />
                    <input type="hidden" name="page" value={page} />
                    <button
                      type="submit"
                      className="rounded-lg border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
                    >
                      Mark as contacted
                    </button>
                  </form>
                )}
                <Link
                  href={reviewHref({ filter, q, page, feedback: r.id })}
                  className="rounded-lg border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
                >
                  Message patient
                </Link>
                <Link
                  href={`/patients/${r.patient_id}`}
                  className="rounded-lg bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  View patient
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Pagination */}
      {rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-fv-text-secondary">
          <span>
            Showing {firstShown}–{lastShown} of {rows.length}
          </span>
          {totalPages > 1 ? (
            <span className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={reviewHref({ filter, q, page: page - 1 })}
                  className="rounded-lg border border-fv-border px-3 py-1.5 font-medium text-fv-text-primary hover:bg-fv-bg-soft"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-lg border border-fv-bg-soft px-3 py-1.5 font-medium opacity-40">
                  ← Previous
                </span>
              )}
              <span className="px-1">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={reviewHref({ filter, q, page: page + 1 })}
                  className="rounded-lg border border-fv-border px-3 py-1.5 font-medium text-fv-text-primary hover:bg-fv-bg-soft"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-lg border border-fv-bg-soft px-3 py-1.5 font-medium opacity-40">
                  Next →
                </span>
              )}
            </span>
          ) : null}
        </div>
      ) : null}

      {detail ? (
        <FeedbackDrawer
          row={detail}
          patientName={patientName.get(detail.patient_id) ?? "Unknown patient"}
          staffName={staffName}
          filter={filter}
          q={q}
          page={page}
        />
      ) : null}
    </main>
  );
}

function FeedbackDrawer({
  row,
  patientName,
  staffName,
  filter,
  q,
  page,
}: {
  row: FeedbackRow;
  patientName: string;
  staffName: ReadonlyMap<string, string>;
  filter: string;
  q: string;
  page: number;
}) {
  const closeHref = reviewHref({ filter, q, page });
  return (
    <>
      <Link
        href={closeHref}
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/30"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[460px] max-w-full flex-col overflow-y-auto bg-fv-bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-fv-bg-soft px-5 py-4">
          <h2 className="text-lg font-semibold text-fv-text-primary">
            Feedback from {patientName}
          </h2>
          <Link
            href={closeHref}
            className="text-sm text-fv-text-secondary hover:text-fv-text-primary"
          >
            Close
          </Link>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5 text-sm">
          <div className="text-2xl text-fv-accent-warm">
            {stars(row.rating)}
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-fv-text-secondary">Recovery day</dt>
            <dd className="text-fv-text-primary">
              {row.recovery_day != null ? row.recovery_day : "Pre-op"}
            </dd>
            <dt className="text-fv-text-secondary">Submitted</dt>
            <dd className="text-fv-text-primary">{fmt(row.submitted_at)}</dd>
            {row.staff_mention ? (
              <>
                <dt className="text-fv-text-secondary">Staff mentioned</dt>
                <dd className="text-fv-text-primary">{row.staff_mention}</dd>
              </>
            ) : null}
            <dt className="text-fv-text-secondary">Follow-up requested</dt>
            <dd className="text-fv-text-primary">
              {row.contact_requested ? "Yes" : "No"}
            </dd>
          </dl>

          {row.comment ? (
            <div className="rounded-lg bg-fv-bg-app p-3 text-fv-text-primary">
              {row.comment}
            </div>
          ) : (
            <p className="text-fv-text-secondary">No written comment.</p>
          )}

          {row.acknowledged_at ? (
            <div className="rounded-lg bg-fv-bg-accent-soft p-3 text-fv-accent-strong">
              Acknowledged on {fmt(row.acknowledged_at)}
              {row.acknowledged_by_staff_id
                ? ` by ${
                    staffName.get(row.acknowledged_by_staff_id) ??
                    "a staff member"
                  }`
                : ""}
              .
            </div>
          ) : (
            <form
              action={replyToFeedbackAction}
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="feedback_id" value={row.id} />
              <input type="hidden" name="filter" value={filter} />
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="page" value={page} />
              <label className="text-xs font-medium text-fv-text-secondary">
                Reply via message
              </label>
              <textarea
                name="body"
                rows={4}
                defaultValue={REPLY_PREFILL}
                className="rounded-md border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Send reply &amp; mark acknowledged
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}
