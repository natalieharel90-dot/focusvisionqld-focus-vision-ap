"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";
import {
  CHECKLIST_ITEMS,
  deriveStatus,
  markItemDone,
  parseChecklist,
  type ChecklistItemKey,
} from "@/lib/setup-tasks";

const ITEM_KEYS = new Set(CHECKLIST_ITEMS.map((i) => i.key));

function back(message: string): never {
  redirect(`/new-patients?error=${encodeURIComponent(message)}`);
}

// Marks one checklist item done. Recomputes status; if the task tips
// into 'activated', stamps activated_at + activated_by. Audit-logged.
export async function completeSetupItemAction(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const itemKey = String(formData.get("item_key") ?? "") as ChecklistItemKey;

  if (!taskId) back("Missing setup task id.");
  if (!ITEM_KEYS.has(itemKey)) back("Unknown checklist item.");

  const { supabase, userId } = await requireStaff();

  const { data: task, error: loadError } = await supabase
    .from("patient_setup_tasks")
    .select("id, patient_id, status, checklist, activated_at")
    .eq("id", taskId)
    .single();
  if (loadError) back(loadError.message);

  const nowIso = new Date().toISOString();
  const checklist = parseChecklist(task.checklist);

  if (checklist[itemKey].done) {
    // Already done — no-op, just refresh.
    revalidatePath("/new-patients");
    return;
  }

  const nextChecklist = markItemDone(checklist, itemKey, userId, nowIso);
  const nextStatus = deriveStatus(nextChecklist);
  const isActivating =
    nextStatus === "activated" && task.status !== "activated";

  const { error: updateError } = await supabase
    .from("patient_setup_tasks")
    .update({
      checklist: nextChecklist,
      status: nextStatus,
      activated_at: isActivating ? nowIso : task.activated_at,
      activated_by_staff_id: isActivating ? userId : undefined,
    })
    .eq("id", taskId);
  if (updateError) back(updateError.message);

  await recordStaffAudit(supabase, "patient.setup_item_completed", {
    patient_id: task.patient_id,
    entity_type: "patient_setup_task",
    entity_id: taskId,
    new_value: { item: itemKey, status: nextStatus },
  });

  if (isActivating) {
    await recordStaffAudit(supabase, "patient.activated", {
      patient_id: task.patient_id,
      entity_type: "patient_setup_task",
      entity_id: taskId,
      new_value: { activated_at: nowIso },
    });
  }

  revalidatePath("/new-patients");
}
