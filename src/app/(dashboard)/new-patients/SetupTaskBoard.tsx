"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  CHECKLIST_ITEMS,
  KANBAN_COLUMNS,
  type Checklist,
  type SetupStatus,
} from "@/lib/setup-tasks";
import { completeSetupItemAction } from "./actions";

export type SetupCard = {
  id: string;
  patientId: string;
  patientName: string;
  status: SetupStatus;
  checklist: Checklist;
  activatedAt: string | null;
  surgeonId: string | null;
  surgeonName: string | null;
  procedureType: string | null;
  surgeryDate: string | null;
};

const COLUMN_TINT: Record<SetupStatus, string> = {
  mfa_pending: "border-t-fv-text-secondary",
  awaiting_setup: "border-t-blue-400",
  partial: "border-t-amber-400",
  activated: "border-t-green-500",
};

function fmtDate(value: string | null): string {
  if (!value) return "TBC";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SetupTaskBoard({
  cards,
}: {
  cards: ReadonlyArray<SetupCard>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Re-derive the selected card from props each render so it reflects
  // fresh data after an action revalidates the page.
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  function openCard(id: string) {
    setSelectedId(id);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.status === col.status);
          return (
            <section
              key={col.status}
              className={`rounded-xl border-t-4 bg-fv-bg-soft ${COLUMN_TINT[col.status]}`}
            >
              <header className="flex items-center justify-between px-3 py-2">
                <h2 className="text-sm font-semibold text-fv-text-primary">
                  {col.label}
                </h2>
                <span className="rounded-full bg-fv-bg-card px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                  {colCards.length}
                </span>
              </header>
              <div className="flex flex-col gap-2 px-2 pb-3">
                {colCards.map((card) => {
                  const remaining = CHECKLIST_ITEMS.filter(
                    (i) => !card.checklist[i.key].done
                  );
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => openCard(card.id)}
                      className="rounded-lg bg-fv-bg-card p-3 text-left shadow-sm hover:shadow"
                    >
                      <div className="text-sm font-semibold text-fv-text-primary">
                        {card.patientName}
                      </div>
                      <div className="mt-0.5 text-xs text-fv-text-secondary">
                        {card.surgeonName ?? "Surgeon TBC"} ·{" "}
                        {card.procedureType
                          ? card.procedureType.toUpperCase()
                          : "Procedure TBC"}
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        Surgery: {fmtDate(card.surgeryDate)}
                      </div>
                      {remaining.length > 0 ? (
                        <ul className="mt-2 space-y-0.5">
                          {remaining.map((i) => (
                            <li
                              key={i.key}
                              className="text-xs text-fv-text-secondary"
                            >
                              ⏳ {i.label}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-2 text-xs font-medium text-green-700">
                          ✅ Setup complete
                        </div>
                      )}
                    </button>
                  );
                })}
                {colCards.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-fv-text-secondary">
                    No patients.
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {/* Side panel — full checklist */}
      <dialog
        ref={dialogRef}
        className="ml-auto h-screen w-full max-w-md rounded-l-2xl p-0 backdrop:bg-black/40"
      >
        {selected ? (
          <div className="flex h-full flex-col">
            <header className="flex items-start justify-between border-b border-fv-bg-soft p-5">
              <div>
                <h2 className="text-lg font-semibold text-fv-text-primary">
                  {selected.patientName}
                </h2>
                <p className="text-xs text-fv-text-secondary">
                  {selected.surgeonName ?? "Surgeon TBC"} ·{" "}
                  {selected.procedureType
                    ? selected.procedureType.toUpperCase()
                    : "Procedure TBC"}{" "}
                  · Surgery {fmtDate(selected.surgeryDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-md border border-fv-bg-soft px-3 py-1 text-sm text-fv-text-primary"
              >
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
                Setup checklist
              </h3>
              <ul className="mt-3 space-y-3">
                {CHECKLIST_ITEMS.map((item) => {
                  const entry = selected.checklist[item.key];
                  return (
                    <li
                      key={item.key}
                      className="rounded-lg border border-fv-bg-soft p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-fv-text-primary">
                          {entry.done ? "✅" : "⏳"} {item.label}
                        </span>
                        {!entry.done ? (
                          <form action={completeSetupItemAction}>
                            <input
                              type="hidden"
                              name="task_id"
                              value={selected.id}
                            />
                            <input
                              type="hidden"
                              name="item_key"
                              value={item.key}
                            />
                            <button
                              type="submit"
                              className="rounded-md bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              {item.action}
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {entry.done ? (
                        <p className="mt-1 text-xs text-fv-text-secondary">
                          Done {fmtDateTime(entry.done_at)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {selected.status === "activated" ? (
                <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
                  Activated {fmtDateTime(selected.activatedAt)}. This card
                  leaves the queue 7 days after activation.
                </p>
              ) : null}
            </div>

            <footer className="border-t border-fv-bg-soft p-5">
              <Link
                href={`/patients/${selected.patientId}`}
                className="text-sm font-semibold text-fv-accent-strong hover:underline"
              >
                View patient record →
              </Link>
            </footer>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
