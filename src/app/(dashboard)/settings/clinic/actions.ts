"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  WEEKDAYS,
  canDisableContactOption,
  isValidContactActionValue,
  moveInOrder,
} from "@/lib/clinic-settings";
import type { Json } from "@/types/database.types";

// Clinic-family tabs span three routes after the Settings reorg — map
// each tab key to the page it now lives on.
function back(tab: string, error?: string): never {
  const route =
    tab === "facilities"
      ? "/settings/partners"
      : tab === "contact" || tab === "templates" || tab === "content"
        ? "/settings/contact"
        : "/settings/clinic";
  redirect(`${route}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

// Every clinic-settings write goes through this. The page is open to all
// staff; table RLS still enforces that only staff can write.
async function requireEditor() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, userId: user.id };
}

// Saves just the after-hours emergency notice (a targeted clinic_profile
// update so the rest of the profile is untouched).
export async function saveAfterHoursNoticeAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const phone = str("after_hours_phone");
  const message = str("after_hours_message");
  const label = str("after_hours_label") || "After hours emergency";
  if (!phone) back("contact", "After-hours phone is required.");
  if (!message) back("contact", "Message text is required.");

  const { data: row } = await supabase
    .from("clinic_profile")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!row) back("contact", "No clinic profile row found.");

  const { error } = await supabase
    .from("clinic_profile")
    .update({
      after_hours_phone: phone,
      after_hours_message: message,
      after_hours_label: label,
    })
    .eq("id", row!.id);
  if (error) back("contact", error.message);

  await recordStaffAudit(supabase, "settings.clinic_profile_updated", {
    entity_type: "clinic_profile",
    entity_id: row!.id,
    new_value: { after_hours_notice: true },
  });
  revalidatePath("/settings/contact");
  back("contact");
}

// ── Tab 1 · Clinic profile ───────────────────────────────────────────────
export async function saveClinicProfileAction(formData: FormData) {
  const { supabase } = await requireEditor();

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const openingHours: Record<string, [string, string] | null> = {};
  for (const [key] of WEEKDAYS) {
    openingHours[key] = formData.get(`${key}_open`)
      ? [str(`${key}_start`) || "09:00", str(`${key}_end`) || "17:00"]
      : null;
  }

  const { data: existing } = await supabase
    .from("clinic_profile")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!existing) back("profile", "Clinic profile row is missing.");

  const { error } = await supabase
    .from("clinic_profile")
    .update({
      name: str("name"),
      abn: str("abn") || null,
      address: str("address"),
      phone: str("phone"),
      after_hours_phone: str("after_hours_phone"),
      email: str("email") || null,
      website: str("website") || null,
      after_hours_message: str("after_hours_message"),
      opening_hours: openingHours as unknown as Json,
    })
    .eq("id", existing!.id);
  if (error) back("profile", error.message);

  await recordStaffAudit(supabase, "settings.clinic_profile_updated", {
    entity_type: "clinic_profile",
    entity_id: existing!.id,
    new_value: { name: str("name") },
  });
  revalidatePath("/settings/clinic");
  back("profile");
}

// ── Tab 2 · Doctors ──────────────────────────────────────────────────────
export async function saveDoctorAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "").trim();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const name = str("name");
  const role = str("role");
  if (!name) back("doctors", "Doctor name is required.");

  // Optional photo upload to the public doctor-photos bucket.
  let photoUrl: string | null = str("photo_url") || null;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from("doctor-photos")
      .upload(path, file, { contentType: file.type || undefined });
    if (upErr) back("doctors", upErr.message);
    photoUrl = supabase.storage.from("doctor-photos").getPublicUrl(path)
      .data.publicUrl;
  }

  const fields = {
    name,
    role,
    email: str("email") || null,
    phone: str("phone") || null,
    bio: str("bio") || null,
    photo_url: photoUrl,
  };

  let docId = id;
  if (id) {
    const { error } = await supabase
      .from("doctors")
      .update(fields)
      .eq("id", id);
    if (error) back("doctors", error.message);
  } else {
    const { data, error } = await supabase
      .from("doctors")
      .insert(fields)
      .select("id")
      .single();
    if (error || !data) back("doctors", error?.message ?? "Could not add.");
    docId = data.id;
  }

  await recordStaffAudit(supabase, "settings.doctor_updated", {
    entity_type: "doctor",
    entity_id: docId,
    new_value: { name, role, change: id ? "updated" : "added" },
  });
  revalidatePath("/settings/clinic");
  back("doctors");
}

// Uploads a doctor's welcome video to the public doctor-videos bucket and
// stores its URL — shown to that doctor's patients in the patient app.
export async function saveDoctorVideoAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) back("doctors", "Missing doctor id.");

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    back("doctors", "Choose a video file to upload.");
  }
  const upload = file as File;
  const safe = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${id}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from("doctor-videos")
    .upload(path, upload, { contentType: upload.type || undefined });
  if (upErr) back("doctors", upErr.message);
  const url = supabase.storage.from("doctor-videos").getPublicUrl(path).data
    .publicUrl;

  const { error } = await supabase
    .from("doctors")
    .update({ welcome_video_url: url })
    .eq("id", id);
  if (error) back("doctors", error.message);

  await recordStaffAudit(supabase, "settings.doctor_updated", {
    entity_type: "doctor",
    entity_id: id,
    new_value: { welcome_video: "uploaded" },
  });
  revalidatePath("/settings/clinic");
  back("doctors");
}

// Removes a doctor from the clinic roster. The doctors table is a
// standalone roster (procedures reference staff_users, not this table),
// so a hard delete is safe.
export async function deleteDoctorAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) back("doctors", "Missing doctor id.");

  const { error } = await supabase.from("doctors").delete().eq("id", id);
  if (error) back("doctors", error.message);

  await recordStaffAudit(supabase, "settings.doctor_updated", {
    entity_type: "doctor",
    entity_id: id,
    new_value: { change: "removed" },
  });
  revalidatePath("/settings/clinic");
  back("doctors");
}

export async function toggleDoctorActiveAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) back("doctors", "Missing doctor id.");

  const { error } = await supabase
    .from("doctors")
    .update({ active })
    .eq("id", id);
  if (error) back("doctors", error.message);

  await recordStaffAudit(supabase, "settings.doctor_updated", {
    entity_type: "doctor",
    entity_id: id,
    new_value: { active, change: active ? "reactivated" : "deactivated" },
  });
  revalidatePath("/settings/clinic");
  back("doctors");
}

// ── Tab 3 · Partner facilities ───────────────────────────────────────────
export async function saveFacilityAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "").trim();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const name = str("name");
  if (!name) back("facilities", "Facility name is required.");

  const fields = {
    name,
    address: str("address") || null,
    liaison_email: str("liaison_email") || null,
    liaison_phone: str("liaison_phone") || null,
    notes: str("notes") || null,
  };

  let facId = id;
  if (id) {
    const { error } = await supabase
      .from("partner_facilities")
      .update(fields)
      .eq("id", id);
    if (error) back("facilities", error.message);
  } else {
    const { data, error } = await supabase
      .from("partner_facilities")
      .insert(fields)
      .select("id")
      .single();
    if (error || !data) back("facilities", error?.message ?? "Could not add.");
    facId = data.id;
  }

  await recordStaffAudit(supabase, "settings.facility_updated", {
    entity_type: "partner_facility",
    entity_id: facId,
    new_value: { name, change: id ? "updated" : "added" },
  });
  revalidatePath("/settings/clinic");
  back("facilities");
}

export async function toggleFacilityActiveAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) back("facilities", "Missing facility id.");

  const { error } = await supabase
    .from("partner_facilities")
    .update({ active })
    .eq("id", id);
  if (error) back("facilities", error.message);

  await recordStaffAudit(supabase, "settings.facility_updated", {
    entity_type: "partner_facility",
    entity_id: id,
    new_value: { active },
  });
  revalidatePath("/settings/clinic");
  back("facilities");
}

// ── Tab 4 · Message templates ────────────────────────────────────────────
export async function saveTemplateAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "").trim();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const label = str("label");
  const body = str("body");
  if (!label || !body) back("templates", "Label and body are required.");

  const fields = { label, body, category: str("category") || "general" };

  let tplId = id;
  if (id) {
    const { error } = await supabase
      .from("message_templates")
      .update(fields)
      .eq("id", id);
    if (error) back("templates", error.message);
  } else {
    const { data, error } = await supabase
      .from("message_templates")
      .insert(fields)
      .select("id")
      .single();
    if (error || !data) back("templates", error?.message ?? "Could not add.");
    tplId = data.id;
  }

  await recordStaffAudit(supabase, "settings.message_template_updated", {
    entity_type: "message_template",
    entity_id: tplId,
    new_value: { label, change: id ? "updated" : "added" },
  });
  revalidatePath("/settings/clinic");
  back("templates");
}

export async function toggleTemplateActiveAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) back("templates", "Missing template id.");

  const { error } = await supabase
    .from("message_templates")
    .update({ active })
    .eq("id", id);
  if (error) back("templates", error.message);

  await recordStaffAudit(supabase, "settings.message_template_updated", {
    entity_type: "message_template",
    entity_id: id,
    new_value: { active },
  });
  revalidatePath("/settings/clinic");
  back("templates");
}

export async function moveTemplateAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const category = String(formData.get("category") ?? "");
  const direction =
    String(formData.get("direction") ?? "") === "up" ? "up" : "down";

  // Reorder within the template's category group.
  const { data: rows } = await supabase
    .from("message_templates")
    .select("id")
    .eq("category", category)
    .order("order_index");
  for (const { id: rowId, order_index } of moveInOrder(
    rows ?? [],
    id,
    direction
  )) {
    await supabase
      .from("message_templates")
      .update({ order_index })
      .eq("id", rowId);
  }
  revalidatePath("/settings/clinic");
  back("templates");
}

// ── Tab 5 · Contact options ──────────────────────────────────────────────
export async function saveContactOptionAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "").trim();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const label = str("label");
  const actionType = str("action_type");
  const actionValue = str("action_value");
  if (!label) back("contact", "Label is required.");
  if (
    actionType !== "custom" &&
    actionValue &&
    !isValidContactActionValue(actionType, actionValue)
  ) {
    back("contact", `That value isn't valid for a "${actionType}" action.`);
  }

  // is_required rows (Call the clinic) can never be disabled.
  let enabled = formData.get("enabled") != null;
  if (id) {
    const { data: existing } = await supabase
      .from("contact_options")
      .select("is_required")
      .eq("id", id)
      .maybeSingle();
    if (existing && !canDisableContactOption(existing)) enabled = true;
  }

  const fields = {
    label,
    subtitle: str("subtitle") || null,
    icon: str("icon") || "phone",
    action_type: actionType,
    action_value: actionValue || null,
    enabled,
  };

  let optId = id;
  if (id) {
    const { error } = await supabase
      .from("contact_options")
      .update(fields)
      .eq("id", id);
    if (error) back("contact", error.message);
  } else {
    const { data, error } = await supabase
      .from("contact_options")
      .insert({ ...fields, is_required: false })
      .select("id")
      .single();
    if (error || !data) back("contact", error?.message ?? "Could not add.");
    optId = data.id;
  }

  await recordStaffAudit(supabase, "settings.contact_options_updated", {
    entity_type: "contact_option",
    entity_id: optId,
    new_value: { label, change: id ? "updated" : "added" },
  });
  revalidatePath("/settings/clinic");
  back("contact");
}

export async function deleteContactOptionAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  if (!id) back("contact", "Missing option id.");

  const { data: existing } = await supabase
    .from("contact_options")
    .select("is_required")
    .eq("id", id)
    .maybeSingle();
  if (existing?.is_required) {
    back("contact", "The Call the clinic option is required and can't be removed.");
  }

  const { error } = await supabase
    .from("contact_options")
    .delete()
    .eq("id", id);
  if (error) back("contact", error.message);

  await recordStaffAudit(supabase, "settings.contact_options_updated", {
    entity_type: "contact_option",
    entity_id: id,
    new_value: { change: "deleted" },
  });
  revalidatePath("/settings/clinic");
  back("contact");
}

export async function moveContactOptionAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const direction =
    String(formData.get("direction") ?? "") === "up" ? "up" : "down";

  const { data: rows } = await supabase
    .from("contact_options")
    .select("id")
    .order("order_index");
  for (const { id: rowId, order_index } of moveInOrder(
    rows ?? [],
    id,
    direction
  )) {
    await supabase
      .from("contact_options")
      .update({ order_index })
      .eq("id", rowId);
  }
  revalidatePath("/settings/clinic");
  back("contact");
}

// ── Tab 6 · Content library ──────────────────────────────────────────────
export async function saveContentItemAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "").trim();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const title = str("title");
  const type = str("type");
  if (!title) back("content", "Title is required.");

  const fields = {
    type,
    title,
    body: str("body") || null,
    media_url: str("media_url") || null,
    procedures: formData.getAll("procedures").map(String),
    topics: formData.getAll("topics").map(String),
    days_range: str("days_range") || null,
    audience: str("audience") || "both",
  };

  let itemId = id;
  if (id) {
    const { error } = await supabase
      .from("content_items")
      .update(fields)
      .eq("id", id);
    if (error) back("content", error.message);
  } else {
    const { data, error } = await supabase
      .from("content_items")
      .insert(fields)
      .select("id")
      .single();
    if (error || !data) back("content", error?.message ?? "Could not add.");
    itemId = data.id;
  }

  await recordStaffAudit(supabase, "settings.content_item_updated", {
    entity_type: "content_item",
    entity_id: itemId,
    new_value: { title, change: id ? "updated" : "added" },
  });
  revalidatePath("/settings/clinic");
  back("content");
}

export async function toggleContentItemActiveAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) back("content", "Missing content id.");

  const { error } = await supabase
    .from("content_items")
    .update({ active })
    .eq("id", id);
  if (error) back("content", error.message);

  await recordStaffAudit(supabase, "settings.content_item_updated", {
    entity_type: "content_item",
    entity_id: id,
    new_value: { active },
  });
  revalidatePath("/settings/clinic");
  back("content");
}
