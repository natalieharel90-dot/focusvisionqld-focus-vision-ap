// Pure helpers for the new-patient onboarding queue (/new-patients).
// No DB / React imports — directly unit-testable.

export type ChecklistItemKey =
  | "mfa_verified"
  | "template_applied"
  | "welcome_sent"
  | "first_appointment_booked"
  | "preop_content_assigned";

export type ChecklistEntry = {
  done: boolean;
  done_at: string | null;
  done_by: string | null;
};

export type Checklist = Record<ChecklistItemKey, ChecklistEntry>;

export type SetupStatus =
  | "mfa_pending"
  | "awaiting_setup"
  | "partial"
  | "activated";

export const CHECKLIST_ITEMS: ReadonlyArray<{
  key: ChecklistItemKey;
  label: string;
  action: string;
}> = [
  {
    key: "mfa_verified",
    label: "Phone verified (MFA)",
    action: "Resend MFA link",
  },
  {
    key: "template_applied",
    label: "Procedure template applied",
    action: "Apply procedure template",
  },
  {
    key: "welcome_sent",
    label: "Welcome message sent",
    action: "Send welcome SMS",
  },
  {
    key: "first_appointment_booked",
    label: "First appointment booked",
    action: "Schedule first appointment",
  },
  {
    key: "preop_content_assigned",
    label: "Pre-op content assigned",
    action: "Assign pre-op content",
  },
];

// Items other than MFA — these decide awaiting_setup vs partial.
const SETUP_KEYS: ReadonlyArray<ChecklistItemKey> = [
  "template_applied",
  "welcome_sent",
  "first_appointment_booked",
  "preop_content_assigned",
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function emptyEntry(): ChecklistEntry {
  return { done: false, done_at: null, done_by: null };
}

// Checklist for a freshly-created patient: template_applied is already
// done (the Set up new patient flow applies it on creation); the rest
// are pending. Status therefore starts at mfa_pending.
export function freshChecklist(now: string): Checklist {
  return {
    mfa_verified: emptyEntry(),
    template_applied: { done: true, done_at: now, done_by: null },
    welcome_sent: emptyEntry(),
    first_appointment_booked: emptyEntry(),
    preop_content_assigned: emptyEntry(),
  };
}

// Status is derived from the checklist — never set manually.
export function deriveStatus(checklist: Checklist): SetupStatus {
  const mfaDone = checklist.mfa_verified.done;
  const setupDoneCount = SETUP_KEYS.filter((k) => checklist[k].done).length;
  const allDone = mfaDone && setupDoneCount === SETUP_KEYS.length;
  if (allDone) return "activated";
  if (!mfaDone) return "mfa_pending";
  if (setupDoneCount > 0) return "partial";
  return "awaiting_setup";
}

// Mark one item done — returns a new checklist (no mutation).
export function markItemDone(
  checklist: Checklist,
  key: ChecklistItemKey,
  staffId: string,
  now: string
): Checklist {
  return {
    ...checklist,
    [key]: { done: true, done_at: now, done_by: staffId },
  };
}

export function pendingItemKeys(checklist: Checklist): ChecklistItemKey[] {
  return CHECKLIST_ITEMS.filter((i) => !checklist[i.key].done).map(
    (i) => i.key
  );
}

export const KANBAN_COLUMNS: ReadonlyArray<{
  status: SetupStatus;
  label: string;
}> = [
  { status: "mfa_pending", label: "MFA pending" },
  { status: "awaiting_setup", label: "Awaiting setup" },
  { status: "partial", label: "Partial" },
  { status: "activated", label: "Activated" },
];

// Activated patients drop off the kanban 7 days after activation. They
// remain in /patients indefinitely — this only affects the queue board.
export function isVisibleInKanban(
  task: { status: SetupStatus; activated_at: string | null },
  now: Date = new Date()
): boolean {
  if (task.status !== "activated") return true;
  if (!task.activated_at) return false;
  return (
    now.getTime() - new Date(task.activated_at).getTime() <= SEVEN_DAYS_MS
  );
}

// Median (in ms) of activated_at - created_at, over tasks activated in
// the last 30 days. Returns null when there are none.
export function medianTimeToActivateMs(
  tasks: ReadonlyArray<{ created_at: string; activated_at: string | null }>,
  now: Date = new Date()
): number | null {
  const durations: number[] = [];
  for (const t of tasks) {
    if (!t.activated_at) continue;
    const activatedMs = new Date(t.activated_at).getTime();
    if (now.getTime() - activatedMs > THIRTY_DAYS_MS) continue;
    durations.push(activatedMs - new Date(t.created_at).getTime());
  }
  if (durations.length === 0) return null;
  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  if (durations.length % 2 === 0) {
    return (durations[mid - 1]! + durations[mid]!) / 2;
  }
  return durations[mid]!;
}

export function formatDuration(ms: number): string {
  const days = ms / (24 * 60 * 60 * 1000);
  if (days >= 1) {
    const d = Math.round(days * 10) / 10;
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  const hours = Math.round(ms / (60 * 60 * 1000));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export type SetupCardFilters = {
  surgeonId: string | null;
  surgeryFrom: string | null; // YYYY-MM-DD
  surgeryTo: string | null;
  nameSearch: string | null;
};

export type SetupCardLike = {
  patient_name: string;
  surgeon_id: string | null;
  surgery_date: string | null;
};

export function cardMatchesFilters(
  card: SetupCardLike,
  filters: SetupCardFilters
): boolean {
  if (filters.surgeonId && card.surgeon_id !== filters.surgeonId) {
    return false;
  }
  if (
    filters.surgeryFrom &&
    (card.surgery_date == null || card.surgery_date < filters.surgeryFrom)
  ) {
    return false;
  }
  if (
    filters.surgeryTo &&
    (card.surgery_date == null || card.surgery_date > filters.surgeryTo)
  ) {
    return false;
  }
  if (filters.nameSearch) {
    const needle = filters.nameSearch.trim().toLowerCase();
    if (needle && !card.patient_name.toLowerCase().includes(needle)) {
      return false;
    }
  }
  return true;
}

// Parse a JSONB checklist column into a typed Checklist, defaulting any
// missing entries.
export function parseChecklist(raw: unknown): Checklist {
  const obj =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const result = {} as Checklist;
  for (const item of CHECKLIST_ITEMS) {
    const entry = obj[item.key];
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      result[item.key] = {
        done: e.done === true,
        done_at: typeof e.done_at === "string" ? e.done_at : null,
        done_by: typeof e.done_by === "string" ? e.done_by : null,
      };
    } else {
      result[item.key] = emptyEntry();
    }
  }
  return result;
}
