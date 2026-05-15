import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  canSendBulkPush,
  countOpened,
  type CheckInZone,
  type CohortFilter,
  type CohortPatient,
  type FlagLevel,
} from "@/lib/bulk-push";
import { ComposeTab, type ContentLibraryItem } from "./ComposeTab";
import { HistoryTab, type HistoryRow, type PushDetail } from "./HistoryTab";

export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 20;

// The clinic operates in Brisbane; recovery day is measured in clinic time.
function brisbaneToday(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Brisbane",
  });
}

type SupabaseServer = ReturnType<typeof createSupabaseServerClient>;

async function loadComposeData(supabase: SupabaseServer): Promise<{
  patients: CohortPatient[];
  procedureTypes: string[];
  surgeons: { id: string; name: string }[];
  contentLibrary: ContentLibraryItem[];
}> {
  const [proceduresRes, flagsRes, checkInsRes, surgeonsRes, contentRes] =
    await Promise.all([
      supabase
        .from("procedures")
        .select("patient_id, procedure_type, surgeon_id, surgery_date")
        .eq("status", "active"),
      supabase
        .from("manual_flags")
        .select("patient_id, alert_level")
        .is("resolved_at", null),
      supabase
        .from("check_ins")
        .select("patient_id, patient_zone, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("staff_users").select("id, name, role"),
      supabase
        .from("content_items")
        .select("id, type, title, body")
        .in("audience", ["post_op", "both"])
        .order("title"),
    ]);

  const procedures = proceduresRes.data ?? [];
  const patientIds = [...new Set(procedures.map((p) => p.patient_id))];
  const { data: patientRows } = await supabase
    .from("patients")
    .select("id, name")
    .in("id", patientIds);
  const nameById = new Map((patientRows ?? []).map((p) => [p.id, p.name]));

  // Most-recent active procedure per patient.
  const activeByPatient = new Map<
    string,
    { procedureType: string; surgeonId: string; surgeryDate: string }
  >();
  for (const row of procedures) {
    const existing = activeByPatient.get(row.patient_id);
    if (!existing || row.surgery_date > existing.surgeryDate) {
      activeByPatient.set(row.patient_id, {
        procedureType: row.procedure_type,
        surgeonId: row.surgeon_id,
        surgeryDate: row.surgery_date,
      });
    }
  }

  const flagsByPatient = new Map<string, FlagLevel[]>();
  for (const row of flagsRes.data ?? []) {
    const list = flagsByPatient.get(row.patient_id) ?? [];
    list.push(row.alert_level as FlagLevel);
    flagsByPatient.set(row.patient_id, list);
  }

  // check_ins arrive newest-first; the first seen per patient is the latest.
  const zoneByPatient = new Map<string, CheckInZone>();
  for (const row of checkInsRes.data ?? []) {
    if (!zoneByPatient.has(row.patient_id)) {
      zoneByPatient.set(row.patient_id, row.patient_zone as CheckInZone);
    }
  }

  const patients: CohortPatient[] = [];
  for (const [patientId, active] of activeByPatient) {
    patients.push({
      id: patientId,
      name: nameById.get(patientId) ?? "Unknown patient",
      procedureType: active.procedureType,
      surgeonId: active.surgeonId,
      surgeryDate: active.surgeryDate,
      openFlagLevels: flagsByPatient.get(patientId) ?? [],
      lastCheckInZone: zoneByPatient.get(patientId) ?? null,
    });
  }
  patients.sort((a, b) => a.name.localeCompare(b.name));

  const procedureTypes = [
    ...new Set(patients.map((p) => p.procedureType).filter(Boolean)),
  ].sort() as string[];

  const surgeons = (surgeonsRes.data ?? [])
    .filter((s) => s.role === "surgeon")
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    patients,
    procedureTypes,
    surgeons,
    contentLibrary: (contentRes.data ?? []) as ContentLibraryItem[],
  };
}

async function loadHistoryData(
  supabase: SupabaseServer,
  page: number,
  pushId: string | null
): Promise<{ rows: HistoryRow[]; totalPages: number; detail: PushDetail | null }> {
  const offset = (page - 1) * HISTORY_PAGE_SIZE;
  const { data: pushes, count } = await supabase
    .from("bulk_pushes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE - 1);

  const pushList = pushes ?? [];
  const senderIds = [...new Set(pushList.map((p) => p.sender_staff_id))];
  const pushIds = pushList.map((p) => p.id);

  const [sendersRes, deliveriesRes] = await Promise.all([
    senderIds.length
      ? supabase.from("staff_users").select("id, name").in("id", senderIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pushIds.length
      ? supabase
          .from("bulk_push_deliveries")
          .select("bulk_push_id, opened_at")
          .in("bulk_push_id", pushIds)
      : Promise.resolve({
          data: [] as { bulk_push_id: string; opened_at: string | null }[],
        }),
  ]);

  const senderName = new Map(
    (sendersRes.data ?? []).map((s) => [s.id, s.name])
  );
  const openedByPush = new Map<string, number>();
  for (const id of pushIds) openedByPush.set(id, 0);
  for (const d of deliveriesRes.data ?? []) {
    if (d.opened_at) {
      openedByPush.set(
        d.bulk_push_id,
        (openedByPush.get(d.bulk_push_id) ?? 0) + 1
      );
    }
  }

  const rows: HistoryRow[] = pushList.map((p) => ({
    id: p.id,
    firedAt: p.fired_at,
    scheduledAt: p.scheduled_at,
    senderName: senderName.get(p.sender_staff_id) ?? "Unknown",
    cohortSummary: p.cohort_summary,
    contentSummary: p.message_title,
    patientsReached: p.patients_reached,
    patientsOpened: openedByPush.get(p.id) ?? 0,
  }));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / HISTORY_PAGE_SIZE));

  let detail: PushDetail | null = null;
  if (pushId) {
    const { data: push } = await supabase
      .from("bulk_pushes")
      .select("*")
      .eq("id", pushId)
      .maybeSingle();
    if (push) {
      const { data: deliveries } = await supabase
        .from("bulk_push_deliveries")
        .select("patient_id, recovery_day, status, delivered_at, opened_at")
        .eq("bulk_push_id", pushId);
      const recipientIds = [
        ...new Set((deliveries ?? []).map((d) => d.patient_id)),
      ];
      const { data: recipientRows } = recipientIds.length
        ? await supabase
            .from("patients")
            .select("id, name")
            .in("id", recipientIds)
        : { data: [] as { id: string; name: string }[] };
      const recipientName = new Map(
        (recipientRows ?? []).map((r) => [r.id, r.name])
      );
      const recipients = (deliveries ?? [])
        .map((d) => ({
          name: recipientName.get(d.patient_id) ?? "Unknown patient",
          recoveryDay: d.recovery_day,
          status: d.status,
          deliveredAt: d.delivered_at,
          openedAt: d.opened_at,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      detail = {
        id: push.id,
        title: push.message_title,
        body: push.message_body,
        cohortSummary: push.cohort_summary,
        cohortFilter: push.cohort_filter as unknown as CohortFilter,
        senderName: senderName.get(push.sender_staff_id) ?? "Unknown",
        firedAt: push.fired_at,
        scheduledAt: push.scheduled_at,
        patientsReached: push.patients_reached,
        patientsOpened: countOpened(
          recipients.map((r) => ({ openedAt: r.openedAt }))
        ),
        recipients,
      };
    }
  }

  return { rows, totalPages, detail };
}

export default async function BulkPushPage({
  searchParams,
}: {
  searchParams: { tab?: string; page?: string; push?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: me } = await supabase
    .from("staff_users")
    .select("access_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/sign-in");

  const tab = searchParams.tab === "history" ? "history" : "compose";
  const canSend = canSendBulkPush(me.access_tier);

  const composeData =
    tab === "compose" ? await loadComposeData(supabase) : null;
  const historyData =
    tab === "history"
      ? await loadHistoryData(
          supabase,
          Math.max(1, Number(searchParams.page) || 1),
          searchParams.push ?? null
        )
      : null;

  const tabClass = (active: boolean) =>
    `rounded-t-lg px-4 py-2 text-sm font-medium ${
      active
        ? "border-b-2 border-fv-accent-strong text-fv-accent-strong"
        : "text-fv-text-secondary hover:text-fv-text-primary"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Bulk push to cohorts
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Send a message to many patients at once — useful when you spot
          something happening across a cohort.
        </p>
      </header>

      <div className="mb-5 flex gap-1 border-b border-fv-bg-soft">
        <Link href="/bulk-push?tab=compose" className={tabClass(tab === "compose")}>
          Compose
        </Link>
        <Link href="/bulk-push?tab=history" className={tabClass(tab === "history")}>
          History
        </Link>
      </div>

      {composeData ? (
        <ComposeTab
          patients={composeData.patients}
          procedureTypes={composeData.procedureTypes}
          surgeons={composeData.surgeons}
          contentLibrary={composeData.contentLibrary}
          today={brisbaneToday()}
          canSend={canSend}
        />
      ) : null}

      {historyData ? (
        <HistoryTab
          rows={historyData.rows}
          page={Math.max(1, Number(searchParams.page) || 1)}
          totalPages={historyData.totalPages}
          detail={historyData.detail}
        />
      ) : null}
    </main>
  );
}
