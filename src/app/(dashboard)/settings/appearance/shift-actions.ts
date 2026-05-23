"use server";

import { revalidatePath } from "next/cache";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";

// Per-staff on-shift toggle. The alert dispatcher's general in-app
// push skips staff who are off-shift; the override push for selected
// roles still reaches them.
export async function updateOnShiftAction(formData: FormData) {
  const { supabase, userId } = await requireStaff();
  const onShift = formData.get("on_shift") === "on";

  await supabase
    .from("staff_users")
    .update({ on_shift: onShift })
    .eq("id", userId);

  await recordStaffAudit(supabase, "staff.on_shift_updated", {
    entity_type: "staff_user",
    entity_id: userId,
    new_value: { on_shift: onShift },
  });

  revalidatePath("/settings/appearance");
  revalidatePath("/staff-app/me");
}

// Per-staff personal quiet-hours window. Same semantics as patient
// quiet hours — wraps past midnight if start > end. General alert
// pushes skip staff in their window; override pushes do not.
const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function back(): never {
  // Surfaced as a generic error — the page reloads with the form's
  // values, the staff can just try again.
  throw new Error("Invalid quiet-hours time");
}

export async function updateStaffQuietHoursAction(formData: FormData) {
  const { supabase, userId } = await requireStaff();
  const enabled = formData.get("quiet_hours") === "on";
  const start = String(formData.get("quiet_hours_start") ?? "22:00").trim();
  const end = String(formData.get("quiet_hours_end") ?? "07:00").trim();
  const overrideOrange =
    formData.get("quiet_hours_override_orange") === "on";
  const overrideRed = formData.get("quiet_hours_override_red") === "on";

  if (!HHMM.test(start) || !HHMM.test(end)) back();

  await supabase
    .from("staff_users")
    .update({
      quiet_hours: enabled,
      quiet_hours_start: start,
      quiet_hours_end: end,
      quiet_hours_override_orange: overrideOrange,
      quiet_hours_override_red: overrideRed,
    })
    .eq("id", userId);

  await recordStaffAudit(supabase, "staff.quiet_hours_updated", {
    entity_type: "staff_user",
    entity_id: userId,
    new_value: {
      quiet_hours: enabled,
      start,
      end,
      overrideOrange,
      overrideRed,
    },
  });

  revalidatePath("/settings/appearance");
  revalidatePath("/staff-app/me");
}
