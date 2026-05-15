"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { summarizeAuditEvent } from "@/lib/audit-log";

export type AuditRow = {
  id: string;
  created_at: string;
  actor_staff_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_email: string | null;
  event_type: string;
  patient_id: string | null;
  patient_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
};

function fmtTimestamp(iso: string): string {
  // Client component — toLocaleString uses the viewer's local time zone.
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function prettyJson(value: unknown): string {
  if (value == null) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AuditTable({ rows }: { rows: ReadonlyArray<AuditRow> }) {
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openDetail(row: AuditRow) {
    setSelected(row);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-fv-bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-fv-bg-soft text-xs uppercase tracking-wide text-fv-text-secondary">
            <tr>
              <th className="px-3 py-2 font-semibold">Timestamp</th>
              <th className="px-3 py-2 font-semibold">Actor</th>
              <th className="px-3 py-2 font-semibold">Action</th>
              <th className="px-3 py-2 font-semibold">Patient</th>
              <th className="px-3 py-2 font-semibold">Entity</th>
              <th className="px-3 py-2 font-semibold">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => openDetail(row)}
                className="cursor-pointer border-t border-fv-bg-soft text-fv-text-primary hover:bg-fv-bg-soft"
              >
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {fmtTimestamp(row.created_at)}
                </td>
                <td className="px-3 py-2">
                  {row.actor_name ?? "—"}
                  {row.actor_role ? (
                    <span className="text-xs text-fv-text-secondary">
                      {" "}
                      · {row.actor_role}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <code className="text-xs">{row.event_type}</code>
                </td>
                <td className="px-3 py-2">
                  {row.patient_id && row.patient_name ? (
                    <Link
                      href={`/patients/${row.patient_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-fv-accent-strong hover:underline"
                    >
                      {row.patient_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-fv-text-secondary">
                  {row.entity_type ?? "—"}
                  {row.entity_id ? (
                    <span className="block font-mono">
                      {row.entity_id.slice(0, 8)}…
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-fv-text-secondary">
                  {summarizeAuditEvent(row)}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-fv-text-secondary"
                >
                  No audit events match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      <dialog
        ref={dialogRef}
        className="w-full max-w-2xl rounded-2xl p-0 backdrop:bg-black/50"
      >
        {selected ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-fv-text-primary">
                  <code className="text-sm">{selected.event_type}</code>
                </h2>
                <p className="mt-1 text-xs text-fv-text-secondary">
                  {fmtTimestamp(selected.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-md border border-fv-bg-soft px-3 py-1 text-sm text-fv-text-primary"
              >
                Close
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Actor">
                {selected.actor_name ?? "—"}
                {selected.actor_role ? ` · ${selected.actor_role}` : ""}
              </Field>
              <Field label="Actor email">
                {selected.actor_email ?? "—"}
              </Field>
              <Field label="IP address">
                {selected.ip_address ?? "—"}
              </Field>
              <Field label="Entity">
                {selected.entity_type ?? "—"}
                {selected.entity_id ? ` · ${selected.entity_id}` : ""}
              </Field>
              <Field label="User agent">
                <span className="break-all">
                  {selected.user_agent ?? "—"}
                </span>
              </Field>
              <Field label="Patient">
                {selected.patient_id && selected.patient_name ? (
                  <Link
                    href={`/patients/${selected.patient_id}`}
                    className="text-fv-accent-strong hover:underline"
                  >
                    {selected.patient_name}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
            </dl>

            {/* Before → after, side by side */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
                Before → after
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs font-semibold text-fv-text-secondary">
                    Before
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-md bg-fv-bg-soft p-3 text-xs">
                    {prettyJson(selected.old_value)}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-fv-text-secondary">
                    After
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-md bg-fv-bg-soft p-3 text-xs">
                    {prettyJson(selected.new_value)}
                  </pre>
                </div>
              </div>
            </div>

            {selected.patient_id ? (
              <Link
                href={`/patients/${selected.patient_id}`}
                className="self-start text-sm font-semibold text-fv-accent-strong hover:underline"
              >
                View patient record →
              </Link>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-fv-text-secondary">{label}</dt>
      <dd className="text-fv-text-primary">{children}</dd>
    </div>
  );
}
