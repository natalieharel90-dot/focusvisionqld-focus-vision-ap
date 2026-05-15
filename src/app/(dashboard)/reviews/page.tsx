import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import {
  FEEDBACK_TARGETS,
  averageRating,
  unacknowledgedFollowUps,
  type FeedbackTarget,
} from "@/lib/feedback";
import { replyToFeedbackAction } from "./actions";

export const dynamic = "force-dynamic";

const REPLY_PREFILL =
  "Hi — thank you so much for taking the time to share your feedback with " +
  "us. It genuinely helps us improve. ";

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
  searchParams: { target?: string; feedback?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const target: FeedbackTarget =
    searchParams.target === "hospital"
      ? "hospital"
      : searchParams.target === "app"
        ? "app"
        : "clinic";

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

  // KPI strip — averages over the last 30 days + open follow-ups.
  const cutoff = Date.now() - 30 * 86_400_000;
  const recent = allRows.filter(
    (r) => new Date(r.submitted_at).getTime() >= cutoff
  );
  const avgByTarget = (t: FeedbackTarget) =>
    averageRating(recent.filter((r) => r.target === t).map((r) => r.rating));
  const openFollowUps = unacknowledgedFollowUps(allRows);

  const rows = allRows.filter((r) => r.target === target);
  const detail = searchParams.feedback
    ? allRows.find((r) => r.id === searchParams.feedback) ?? null
    : null;

  const tabClass = (active: boolean) =>
    `rounded-t-lg px-4 py-2 text-sm font-medium ${
      active
        ? "border-b-2 border-fv-accent-strong text-fv-accent-strong"
        : "text-fv-text-secondary hover:text-fv-text-primary"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <h1 className="text-2xl font-semibold text-fv-text-primary">Feedback</h1>
      <p className="mt-1 text-sm text-fv-text-secondary">
        What patients are telling us about their care, the hospital, and the app.
      </p>

      {/* KPI strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FEEDBACK_TARGETS.map((t) => (
          <div
            key={t.key}
            className="rounded-xl border border-fv-bg-soft bg-fv-bg-card p-3"
          >
            <div className="text-xs text-fv-text-secondary">
              {t.label} · 30d avg
            </div>
            <div className="text-xl font-semibold text-fv-text-primary">
              {avgByTarget(t.key) || "—"}
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-fv-bg-soft bg-fv-bg-card p-3">
          <div className="text-xs text-fv-text-secondary">
            Follow-ups open
          </div>
          <div className="text-xl font-semibold text-fv-text-primary">
            {openFollowUps}
          </div>
        </div>
      </div>

      {searchParams.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-fv-bg-soft">
        {FEEDBACK_TARGETS.map((t) => (
          <Link
            key={t.key}
            href={`/reviews?target=${t.key}`}
            className={tabClass(t.key === target)}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Rows */}
      <ul className="mt-4 flex flex-col gap-2">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-fv-bg-soft bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary">
            No feedback in this category yet.
          </li>
        ) : (
          rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/reviews?target=${target}&feedback=${r.id}`}
                className="flex items-start gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-4 hover:bg-fv-bg-soft/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fv-bg-soft text-xs font-semibold text-fv-text-secondary">
                  {initials(patientName.get(r.patient_id) ?? "?")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-fv-accent-warm">
                      {stars(r.rating)}
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
                  </span>
                  {r.comment ? (
                    <span className="mt-1 block text-sm text-fv-text-primary">
                      {r.comment}
                    </span>
                  ) : null}
                  {r.staff_mention ? (
                    <span className="mt-0.5 block text-xs text-fv-text-secondary">
                      Mentioned: {r.staff_mention}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>

      {detail ? (
        <FeedbackDrawer
          row={detail}
          patientName={patientName.get(detail.patient_id) ?? "Unknown patient"}
          staffName={staffName}
          target={target}
        />
      ) : null}
    </main>
  );
}

function FeedbackDrawer({
  row,
  patientName,
  staffName,
  target,
}: {
  row: FeedbackRow;
  patientName: string;
  staffName: ReadonlyMap<string, string>;
  target: FeedbackTarget;
}) {
  const closeHref = `/reviews?target=${target}`;
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
                    staffName.get(row.acknowledged_by_staff_id) ?? "a staff member"
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
              <input type="hidden" name="target" value={target} />
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
