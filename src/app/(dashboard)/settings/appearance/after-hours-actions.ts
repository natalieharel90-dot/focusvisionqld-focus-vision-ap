"use server";

import { revalidatePath } from "next/cache";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";

// Per-staff opt-in for after-hours alert pushes. When on, the alert
// dispatcher will include this staff member in the "override" push set
// for any zone whose actions have "Include the patient's surgeon"
// turned on (and the patient's surgeon_id matches them).
export async function updateAfterHoursOptInAction(formData: FormData) {
  const { supabase, userId } = await requireStaff();
  const enabled = formData.get("notify_after_hours") === "on";

  await supabase
    .from("staff_users")
    .update({ notify_after_hours: enabled })
    .eq("id", userId);

  await recordStaffAudit(supabase, "staff.notify_after_hours_updated", {
    entity_type: "staff_user",
    entity_id: userId,
    new_value: { notify_after_hours: enabled },
  });

  revalidatePath("/settings/appearance");
}
