"use server";

import { revalidatePath } from "next/cache";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";

const SIZES = ["small", "normal", "large"];

// Persists the signed-in staff member's dashboard text size.
export async function updateStaffTextSizeAction(formData: FormData) {
  const size = String(formData.get("text_size") ?? "");
  if (!SIZES.includes(size)) return;

  const { supabase, userId } = await requireStaff();

  await supabase
    .from("staff_users")
    .update({ text_size: size })
    .eq("id", userId);

  await recordStaffAudit(supabase, "staff.theme_changed", {
    entity_type: "staff_user",
    entity_id: userId,
    new_value: { text_size: size },
  });

  revalidatePath("/", "layout");
}
