import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import {
  CHECKLIST_ITEMS,
  cardMatchesFilters,
  formatDuration,
  isVisibleInKanban,
  medianTimeToActivateMs,
  parseChecklist,
  type Checklist,
  type SetupStatus,
} from "@/lib/setup-tasks";
import { completeSetupItemAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function fmtDate(value: string | null): string {
  if (!value) return "TBC";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtSignedUp(value: string): string {
  return new Date(value).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Card = {
  taskId: string;
  patientId: string;
  patientName: string;
  email: string | null;
  phone: string | null;
  status: SetupStatus;
  checklist: Checklist;
  signedUpAt: string;
  activatedAt: string | null;
  surgeonName: string | null;
  procedureType: string | null;
  surgeryDate: string | null;
};

// Awaiting/partial first (action needed), then activated, then unverified.
const STATUS_ORDER: Record<SetupStatus, number> = {
  awaiting_setup: 0,
  partial: 1,
  activated: 2,
  mfa_pending: 3,
};

const STATUS_META: Record<
  SetupStatus,
  { pill: string; pillCls: string; border: string }
> = {
  awaiting_setup: {
    pill: "Awaiting clinical setup",
    pillCls: "bg-amber-100 text-amber-800",
    border: "border-l-amber-400",
  },
  partial: {
    pill: "Partial",
    pillCls: "bg-amber-100 text-amber-800",
    border: "border-l-amber-400",
  },
  activated: {
    pill: "Activated",
    pillCls: "bg-green-100 text-green-800",
    border: "border-l-green-500",
  },
  mfa_pending: {
    pill: "MFA pending",
    pillCls: "bg-fv-bg-soft text-fv-text-secondary",
    border: "border-l-fv-border",
  },
};

export default async function NewPatientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createSupabaseServerClient();

  const filters = {
    surgeonId: first(searchParams.surgeon) || null,
    surgeryFrom: first(searchParams.from) || null,
    surgeryTo: first(searchParams.to) || null,
    nameSearch: first(searchParams.q) || null,
  };

  const { data: tasks } = await supabase
    .from("patient_setup_tasks")
    .select("id, patient_id, status, checklist, activated_at, created_at");
  const taskRows = tasks ?? [];
  const patientIds = taskRows.map((t) => t.patient_id);

  const [patientsResult, proceduresResult, surgeonsResult] =
    patientIds.length > 0
      ? await Promise.all([
          supabase
            .from("patients")
            .select("id, name, email, phone")
            .in("id", patientIds),
          supabase
            .from("procedures")
            .select(
              "patient_id, surgeon_id, procedure_type, surgery_date, status"
            )
            .in("patient_id", patientIds)
            .eq("status", "active")
            .order("surgery_date", { ascending: false }),
          supabase
            .from("staff_users")
            .select("id, name")
            .eq("role", "surgeon")
            .order("name"),
        ])
      : [
          {
            data: [] as {
              id: string;
              name: string;
              email: string;
              phone: string | null;
            }[],
          },
          {
            data: [] as {
              patient_id: string;
              surgeon_id: string;
              procedure_type: string;
              surgery_date: string;
              status: string;
            }[],
          },
          { data: [] as { id: string; name: string }[] },
        ];

  const patientById = new Map(
    (patientsResult.data ?? []).map((p) => [p.id, p])
  );
  const procByPatient = new Map<
    string,
    { surgeon_id: string; procedure_type: string; surgery_date: string }
  >();
  for (const p of proceduresResult.data ?? []) {
    if (!procByPatient.has(p.patient_id)) {
      procByPatient.set(p.patient_id, {
        surgeon_id: p.surgeon_id,
        procedure_type: p.procedure_type,
        surgery_date: p.surgery_date,
      });
    }
  }
  const surgeonName = new Map(
    (surgeonsResult.data ?? []).map((s) => [s.id, s.name])
  );

  const medianMs = medianTimeToActivateMs(
    taskRows.map((t) => ({
      created_at: t.created_at,
      activated_at: t.activated_at,
    }))
  );

  const cards: Card[] = taskRows
    .map((t) => {
      const patient = patientById.get(t.patient_id);
      const proc = procByPatient.get(t.patient_id);
      return {
        taskId: t.id,
        patientId: t.patient_id,
        patientName: patient?.name ?? "Unknown patient",
        email: patient?.email ?? null,
        phone: patient?.phone ?? null,
        status: t.status as SetupStatus,
        checklist: parseChecklist(t.checklist),
        signedUpAt: t.created_at,
        activatedAt: t.activated_at,
        surgeonName: proc ? surgeonName.get(proc.surgeon_id) ?? null : null,
        procedureType: proc?.procedure_type ?? null,
        surgeryDate: proc?.surgery_date ?? null,
      };
    })
    .filter((c) =>
      isVisibleInKanban({ status: c.status, activated_at: c.activatedAt })
    )
    .filter((c) =>
      cardMatchesFilters(
        {
          patient_name: c.patientName,
          surgeon_id:
            procByPatient.get(c.patientId)?.surgeon_id ?? null,
          surgery_date: c.surgeryDate,
        },
        filters
      )
    )
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        Date.parse(b.signedUpAt) - Date.parse(a.signedUpAt)
    );

  const countByStatus: Record<SetupStatus, number> = {
    mfa_pending: 0,
    awaiting_setup: 0,
    partial: 0,
    activated: 0,
  };
  for (const c of cards) countByStatus[c.status] += 1;

  const stats = [
    {
      label: "Awaiting setup",
      value: String(countByStatus.awaiting_setup + countByStatus.partial),
      sub: "Action required",
      accent: true,
    },
    {
      label: "Set up this week",
      value: String(countByStatus.activated),
      sub: "Activated, last 7 days",
      accent: false,
    },
    {
      label: "Avg time to activate",
      value: medianMs === null ? "—" : formatDuration(medianMs),
      sub: "Median, last 30 days",
      accent: false,
    },
    {
      label: "Awaiting verification",
      value: String(countByStatus.mfa_pending),
      sub: "MFA pending",
      accent: false,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            New patients · awaiting setup
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Patients who have signed up via the app but haven&apos;t been
            activated yet. Confirm details and assign a surgeon + procedure
            to start their recovery journey.
          </p>
        </div>
        {/* Search — preserves the active surgeon / date filters. */}
        <form method="get" className="w-full max-w-xs">
          <input
            type="hidden"
            name="surgeon"
            value={filters.surgeonId ?? ""}
          />
          <input type="hidden" name="from" value={filters.surgeryFrom ?? ""} />
          <input type="hidden" name="to" value={filters.surgeryTo ?? ""} />
          <input
            type="search"
            name="q"
            defaultValue={filters.nameSearch ?? ""}
            placeholder="Search by patient name…"
            className="w-full rounded-lg border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm focus:border-fv-accent focus:outline-none"
          />
        </form>
      </div>

      {/* Stat cards — 4 across, wrapping to 2×2 on narrow screens */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl bg-fv-bg-card p-4 shadow-sm ${
              s.accent ? "border-l-4 border-l-amber-400" : ""
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {s.label}
            </div>
            <div
              className={`mt-1 text-2xl font-semibold ${
                s.accent ? "text-amber-700" : "text-fv-text-primary"
              }`}
            >
              {s.value}
            </div>
            <div className="text-xs text-fv-text-secondary">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <form
        method="get"
        className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-fv-bg-card p-4 shadow-sm sm:grid-cols-3"
      >
        <input type="hidden" name="q" value={filters.nameSearch ?? ""} />
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">Surgeon</span>
          <select
            name="surgeon"
            defaultValue={filters.surgeonId ?? ""}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Any surgeon</option>
            {(surgeonsResult.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">
            Surgery from
          </span>
          <input
            type="date"
            name="from"
            defaultValue={filters.surgeryFrom ?? ""}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">
            Surgery to
          </span>
          <input
            type="date"
            name="to"
            defaultValue={filters.surgeryTo ?? ""}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-3">
          <button
            type="submit"
            className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
          <Link
            href="/new-patients"
            className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
          >
            Reset
          </Link>
        </div>
      </form>

      {searchParams.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {first(searchParams.error)}
        </p>
      ) : null}

      {/* Patient queue — single vertical column */}
      <div className="mt-5 flex flex-col gap-4">
        {cards.length === 0 ? (
          <p className="rounded-xl bg-fv-bg-card p-8 text-center text-sm text-fv-text-secondary shadow-sm">
            No patients in the onboarding queue.
          </p>
        ) : (
          cards.map((card) => {
            const meta = STATUS_META[card.status];
            const allDone = CHECKLIST_ITEMS.every(
              (i) => card.checklist[i.key].done
            );
            return (
              <article
                key={card.taskId}
                className={`rounded-xl border-l-4 bg-fv-bg-card p-5 shadow-sm ${meta.border}`}
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fv-bg-accent-soft text-sm font-semibold text-fv-accent-strong">
                      {card.status === "mfa_pending"
                        ? "??"
                        : initials(card.patientName)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-fv-text-primary">
                        {card.patientName}
                      </div>
                      <div className="mt-0.5 text-xs text-fv-text-secondary">
                        {[
                          card.email,
                          card.phone,
                          `Signed up ${fmtSignedUp(card.signedUpAt)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${meta.pillCls}`}
                  >
                    {meta.pill}
                  </span>
                </header>

                {/* Setup checklist */}
                <div className="mt-3.5 rounded-lg bg-fv-bg-soft/60 p-3.5">
                  <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-fv-text-secondary">
                    Setup checklist
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CHECKLIST_ITEMS.map((item) => {
                      const entry = card.checklist[item.key];
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={
                                entry.done
                                  ? "font-bold text-green-600"
                                  : "font-bold text-red-500"
                              }
                            >
                              {entry.done ? "✓" : "✕"}
                            </span>
                            <span className="truncate text-fv-text-primary">
                              {item.label}
                            </span>
                          </span>
                          {!entry.done ? (
                            <form action={completeSetupItemAction}>
                              <input
                                type="hidden"
                                name="task_id"
                                value={card.taskId}
                              />
                              <input
                                type="hidden"
                                name="item_key"
                                value={item.key}
                              />
                              <button
                                type="submit"
                                className="shrink-0 rounded-md border border-fv-border px-2 py-0.5 text-[11px] font-semibold text-fv-accent-strong hover:bg-fv-bg-soft"
                              >
                                {item.action}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {card.status === "mfa_pending" ? (
                  <p className="mt-3 text-xs leading-relaxed text-fv-text-secondary">
                    Patient hasn&apos;t completed the MFA step. No staff
                    action is needed — once they finish verification (or
                    abandon after 24h) they auto-clear from this queue.
                  </p>
                ) : null}

                {card.status === "activated" && allDone ? (
                  <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
                    ✓ Setup complete · activated{" "}
                    {card.activatedAt ? fmtSignedUp(card.activatedAt) : "—"}.
                    This card leaves the queue 7 days after activation.
                  </p>
                ) : null}

                <footer className="mt-3.5 flex items-center justify-between gap-3 border-t border-fv-bg-soft pt-3 text-xs text-fv-text-secondary">
                  <span>
                    {card.surgeonName ?? "Surgeon TBC"} ·{" "}
                    {card.procedureType
                      ? card.procedureType.toUpperCase()
                      : "Procedure TBC"}{" "}
                    · Surgery {fmtDate(card.surgeryDate)}
                  </span>
                  <Link
                    href={`/patients/${card.patientId}`}
                    className="shrink-0 font-semibold text-fv-accent-strong hover:underline"
                  >
                    View patient record →
                  </Link>
                </footer>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}
