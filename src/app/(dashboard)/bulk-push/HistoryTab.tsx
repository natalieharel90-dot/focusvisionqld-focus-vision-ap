import Link from "next/link";

import { openRate, type CohortFilter } from "@/lib/bulk-push";

export type HistoryRow = {
  id: string;
  firedAt: string | null;
  scheduledAt: string;
  senderName: string;
  cohortSummary: string;
  contentSummary: string;
  patientsReached: number;
  patientsOpened: number;
};

export type PushDetail = {
  id: string;
  title: string;
  body: string;
  cohortSummary: string;
  cohortFilter: CohortFilter;
  senderName: string;
  firedAt: string | null;
  scheduledAt: string;
  patientsReached: number;
  patientsOpened: number;
  recipients: {
    name: string;
    recoveryDay: number | null;
    status: string;
    deliveredAt: string;
    openedAt: string | null;
  }[];
};

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

export function HistoryTab({
  rows,
  page,
  totalPages,
  detail,
}: {
  rows: HistoryRow[];
  page: number;
  totalPages: number;
  detail: PushDetail | null;
}) {
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-fv-bg-soft bg-fv-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fv-bg-soft text-left text-xs uppercase tracking-wide text-fv-text-secondary">
              <th className="px-4 py-3 font-medium">Sent / scheduled</th>
              <th className="px-4 py-3 font-medium">Sender</th>
              <th className="px-4 py-3 font-medium">Cohort</th>
              <th className="px-4 py-3 font-medium">Content</th>
              <th className="px-4 py-3 font-medium">Reached</th>
              <th className="px-4 py-3 font-medium">Opened</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-fv-text-secondary"
                >
                  No bulk pushes yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const sent = r.firedAt !== null;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-fv-bg-soft last:border-0 hover:bg-fv-bg-soft/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/bulk-push?tab=history&page=${page}&push=${r.id}`}
                        className="block"
                      >
                        <span className="text-fv-text-primary">
                          {fmt(sent ? r.firedAt : r.scheduledAt)}
                        </span>
                        {!sent ? (
                          <span className="ml-2 rounded bg-fv-bg-accent-soft px-1.5 py-0.5 text-xs text-fv-accent-strong">
                            Scheduled
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-fv-text-secondary">
                      {r.senderName}
                    </td>
                    <td className="px-4 py-3 text-fv-text-secondary">
                      {r.cohortSummary}
                    </td>
                    <td className="px-4 py-3 text-fv-text-primary">
                      {r.contentSummary}
                    </td>
                    <td className="px-4 py-3 text-fv-text-secondary">
                      {sent ? r.patientsReached : "—"}
                    </td>
                    <td className="px-4 py-3 text-fv-text-secondary">
                      {sent ? (
                        <Link
                          href={`/bulk-push?tab=history&page=${page}&push=${r.id}`}
                          className="text-fv-accent-strong hover:underline"
                        >
                          {r.patientsOpened} (
                          {openRate(r.patientsReached, r.patientsOpened)}%)
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`/bulk-push?tab=history&page=${page - 1}`}
              className="rounded-md border border-fv-bg-soft px-3 py-1.5 text-fv-text-primary hover:bg-fv-bg-soft"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-fv-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/bulk-push?tab=history&page=${page + 1}`}
              className="rounded-md border border-fv-bg-soft px-3 py-1.5 text-fv-text-primary hover:bg-fv-bg-soft"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}

      {detail ? <DetailDrawer detail={detail} page={page} /> : null}
    </div>
  );
}

function DetailDrawer({ detail, page }: { detail: PushDetail; page: number }) {
  const closeHref = `/bulk-push?tab=history&page=${page}`;
  const sent = detail.firedAt !== null;
  return (
    <>
      <Link
        href={closeHref}
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/30"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col overflow-y-auto bg-fv-bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-fv-bg-soft px-5 py-4">
          <h2 className="text-lg font-semibold text-fv-text-primary">
            Bulk push detail
          </h2>
          <Link
            href={closeHref}
            className="text-sm text-fv-text-secondary hover:text-fv-text-primary"
          >
            Close
          </Link>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              Content preview
            </h3>
            <div className="mt-2 rounded-lg border border-fv-bg-soft bg-fv-bg-app p-3">
              <div className="text-xs text-fv-text-secondary">
                From Focus Vision team
              </div>
              <div className="mt-1 font-semibold text-fv-text-primary">
                {detail.title}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fv-text-primary">
                {detail.body}
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              Cohort &amp; delivery
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-fv-text-secondary">Cohort</dt>
              <dd className="text-fv-text-primary">{detail.cohortSummary}</dd>
              <dt className="text-fv-text-secondary">Sender</dt>
              <dd className="text-fv-text-primary">{detail.senderName}</dd>
              <dt className="text-fv-text-secondary">
                {sent ? "Sent" : "Scheduled"}
              </dt>
              <dd className="text-fv-text-primary">
                {fmt(sent ? detail.firedAt : detail.scheduledAt)}
              </dd>
              <dt className="text-fv-text-secondary">Reached</dt>
              <dd className="text-fv-text-primary">{detail.patientsReached}</dd>
              <dt className="text-fv-text-secondary">Opened</dt>
              <dd className="text-fv-text-primary">
                {detail.patientsOpened} (
                {openRate(detail.patientsReached, detail.patientsOpened)}%)
              </dd>
            </dl>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-fv-text-secondary">
                Filter JSON
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-fv-bg-app p-2 text-xs text-fv-text-secondary">
                {JSON.stringify(detail.cohortFilter, null, 2)}
              </pre>
            </details>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              Recipients ({detail.recipients.length})
            </h3>
            <ul className="mt-2 flex flex-col divide-y divide-fv-bg-soft">
              {detail.recipients.map((r, i) => (
                <li key={i} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-fv-text-primary">{r.name}</span>
                    <span
                      className={
                        r.openedAt
                          ? "text-fv-success"
                          : "text-fv-text-secondary"
                      }
                    >
                      {r.openedAt ? "Opened" : "Not opened"}
                    </span>
                  </div>
                  <div className="text-xs text-fv-text-secondary">
                    {r.recoveryDay !== null ? `Day ${r.recoveryDay} · ` : ""}
                    Delivered {fmt(r.deliveredAt)}
                    {r.openedAt ? ` · Opened ${fmt(r.openedAt)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
}
