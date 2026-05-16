"use server";

import { revalidatePath } from "next/cache";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const SIZES = ["small", "normal", "large"];

// Persists the signed-in staff member's dashboard text size.
export async function updateStaffTextSizeAction(formData: FormData) {
  const size = String(formData.get("text_size") ?? "");
  if (!SIZES.includes(size)) return;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("staff_users")
    .update({ text_size: size })
    .eq("id", user.id);

  await recordStaffAudit(supabase, "staff.theme_changed", {
    entity_type: "staff_user",
    entity_id: user.id,
    new_value: { text_size: size },
  });

  revalidatePath("/", "layout");
}
