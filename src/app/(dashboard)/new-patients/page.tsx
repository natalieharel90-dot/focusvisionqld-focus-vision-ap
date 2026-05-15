import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  cardMatchesFilters,
  formatDuration,
  isVisibleInKanban,
  medianTimeToActivateMs,
  parseChecklist,
  type SetupStatus,
} from "@/lib/setup-tasks";
import { SetupTaskBoard, type SetupCard } from "./SetupTaskBoard";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

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

  // Whole table — one row per patient, small enough to fetch + filter in
  // memory. The 7-day and 30-day windows are applied client-side via the
  // pure helpers.
  const { data: tasks } = await supabase
    .from("patient_setup_tasks")
    .select(
      "id, patient_id, status, checklist, activated_at, created_at"
    );
  const taskRows = tasks ?? [];

  const patientIds = taskRows.map((t) => t.patient_id);

  const [patientsResult, proceduresResult, surgeonsResult] =
    patientIds.length > 0
      ? await Promise.all([
          supabase.from("patients").select("id, name").in("id", patientIds),
          supabase
            .from("procedures")
            .select("patient_id, surgeon_id, procedure_type, surgery_date, status")
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
          { data: [] as { id: string; name: string }[] },
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

  const patientName = new Map(
    (patientsResult.data ?? []).map((p) => [p.id, p.name])
  );
  // Most-recent active procedure per patient (query ordered desc).
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

  // Median time-to-activate (last 30 days) — computed over ALL tasks,
  // before the kanban 7-day visibility filter.
  const medianMs = medianTimeToActivateMs(
    taskRows.map((t) => ({
      created_at: t.created_at,
      activated_at: t.activated_at,
    }))
  );

  // Build cards, then apply the kanban 7-day rule + the filter bar.
  const allCards: SetupCard[] = taskRows.map((t) => {
    const proc = procByPatient.get(t.patient_id);
    return {
      id: t.id,
      patientId: t.patient_id,
      patientName: patientName.get(t.patient_id) ?? "Unknown patient",
      status: t.status as SetupStatus,
      checklist: parseChecklist(t.checklist),
      activatedAt: t.activated_at,
      surgeonId: proc?.surgeon_id ?? null,
      surgeonName: proc ? (surgeonName.get(proc.surgeon_id) ?? null) : null,
      procedureType: proc?.procedure_type ?? null,
      surgeryDate: proc?.surgery_date ?? null,
    };
  });

  const cards = allCards
    .filter((c) =>
      isVisibleInKanban({ status: c.status, activated_at: c.activatedAt })
    )
    .filter((c) =>
      cardMatchesFilters(
        {
          patient_name: c.patientName,
          surgeon_id: c.surgeonId,
          surgery_date: c.surgeryDate,
        },
        filters
      )
    );

  const countByStatus: Record<SetupStatus, number> = {
    mfa_pending: 0,
    awaiting_setup: 0,
    partial: 0,
    activated: 0,
  };
  for (const c of cards) countByStatus[c.status] += 1;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-fv-text-primary">
        New patients
      </h1>
      <p className="mt-1 text-sm text-fv-text-secondary">
        Onboarding queue. Cards move automatically as the setup checklist
        completes; activated patients drop off after 7 days.
      </p>

      {/* KPI strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["mfa_pending", "MFA pending"],
            ["awaiting_setup", "Awaiting setup"],
            ["partial", "Partial"],
            ["activated", "Activated"],
          ] as const
        ).map(([status, label]) => (
          <div
            key={status}
            className="rounded-xl bg-fv-bg-card p-4 shadow-sm"
          >
            <div className="text-2xl font-semibold text-fv-text-primary">
              {countByStatus[status]}
            </div>
            <div className="text-xs text-fv-text-secondary">{label}</div>
          </div>
        ))}
        <div className="rounded-xl bg-fv-bg-accent-soft p-4 shadow-sm">
          <div className="text-2xl font-semibold text-fv-accent-strong">
            {medianMs === null ? "—" : formatDuration(medianMs)}
          </div>
          <div className="text-xs text-fv-text-secondary">
            Median time to activate (30d)
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <form
        method="get"
        className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-fv-bg-card p-4 shadow-sm sm:grid-cols-4"
      >
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
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">
            Patient name
          </span>
          <input
            type="search"
            name="q"
            defaultValue={filters.nameSearch ?? ""}
            placeholder="Search…"
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-4">
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

      <div className="mt-5">
        <SetupTaskBoard cards={cards} />
      </div>
    </main>
  );
}
