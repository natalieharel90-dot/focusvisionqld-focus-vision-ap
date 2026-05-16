// Settings → Clinic & Doctors (spec §6) — pure helpers and curated
// option sets shared across the six tabs. The page is open to all staff.

// ── Curated option sets ──────────────────────────────────────────────────
export const MESSAGE_TEMPLATE_CATEGORIES = [
  "general",
  "follow-up",
  "appointment",
  "pre-op",
  "post-op",
] as const;

export const CONTENT_TOPICS = [
  "pain management",
  "vision",
  "medications",
  "activity",
  "wellbeing",
  "general",
] as const;

export const CONTACT_ICONS = [
  "phone",
  "message",
  "calendar",
  "map",
  "clock",
  "link",
] as const;

export const CONTACT_ACTION_TYPES = [
  "call",
  "message",
  "book",
  "map",
  "url",
  "custom",
] as const;

export const WEEKDAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

// ── Message template placeholders ────────────────────────────────────────
// Templates may contain {patient_first_name}; it expands at send time.
export function expandMessageTemplate(
  body: string,
  vars: { patientFirstName?: string | null }
): string {
  const name = vars.patientFirstName?.trim();
  return body.replace(/\{patient_first_name\}/g, name && name.length > 0 ? name : "there");
}

// First name from a full name, for {patient_first_name} expansion.
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

// ── Contact options ──────────────────────────────────────────────────────
// A required option (Call the clinic) can never be disabled or deleted.
export function canDisableContactOption(option: {
  is_required: boolean;
}): boolean {
  return !option.is_required;
}

// Validates a contact option's action_value against its action_type.
export function isValidContactActionValue(
  actionType: string,
  value: string
): boolean {
  const v = value.trim();
  switch (actionType) {
    case "call":
      return /\d/.test(v) && /^[\d+()\s-]+$/.test(v);
    case "url":
    case "book":
      return /^https?:\/\/\S+/.test(v);
    case "message":
      return v.startsWith("/");
    case "map":
      return v.length > 0;
    case "custom":
      return true;
    default:
      return false;
  }
}

// ── Reordering ───────────────────────────────────────────────────────────
// Moves the item one place up or down and returns the full id→order_index
// mapping to persist. Used by the up/down reorder controls.
export function moveInOrder<T extends { id: string }>(
  items: ReadonlyArray<T>,
  id: string,
  direction: "up" | "down"
): { id: string; order_index: number }[] {
  const ordered = [...items];
  const index = ordered.findIndex((x) => x.id === id);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index !== -1 && target >= 0 && target < ordered.length) {
    const a = ordered[index]!;
    const b = ordered[target]!;
    ordered[index] = b;
    ordered[target] = a;
  }
  return ordered.map((x, i) => ({ id: x.id, order_index: i }));
}

// ── Content library filter ───────────────────────────────────────────────
export type ContentFilter = {
  audience?: string;
  procedure?: string;
  type?: string;
  includeInactive?: boolean;
};

export function filterContentItems<
  T extends {
    audience: string;
    procedures: string[];
    type: string;
    active: boolean;
  },
>(items: ReadonlyArray<T>, filter: ContentFilter): T[] {
  const any = (v: string | undefined) => !v || v === "all";
  return items.filter(
    (item) =>
      (filter.includeInactive || item.active) &&
      (any(filter.audience) || item.audience === filter.audience) &&
      (any(filter.type) || item.type === filter.type) &&
      (any(filter.procedure) ||
        item.procedures.includes(filter.procedure as string))
  );
}
