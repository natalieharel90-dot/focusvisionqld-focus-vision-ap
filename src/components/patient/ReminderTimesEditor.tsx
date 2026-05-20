"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/SubmitButton";

export type ReminderTimesEditorProps = {
  initialMedicationTimes: string[]; // HH:MM, ordered chronologically
  maxMedicationSlots: number; // 0 = no meds; otherwise 1–6
  initialCheckinTime: string;
  initialNudgeTime: string;
  nudgeEnabled: boolean;
  action: (formData: FormData) => void;
  // When true, the form is the post-onboarding setup; copy is welcoming
  // and the cancel link goes home. False = inside Settings.
  isOnboarding?: boolean;
};

const SLOT_LABELS = [
  "Morning",
  "Mid-morning",
  "Midday",
  "Afternoon",
  "Evening",
  "Night",
];

// Patient-facing editor for medication / check-in / nudge reminder
// times. Used by both the post-onboarding setup page and the regular
// Settings preferences page.
export function ReminderTimesEditor(props: ReminderTimesEditorProps) {
  // Pad initial array up to maxMedicationSlots in case the patient adds
  // a more-frequent medication later.
  const padded = [...props.initialMedicationTimes];
  while (padded.length < props.maxMedicationSlots) {
    padded.push(defaultSlotTime(padded.length));
  }
  const [times, setTimes] = useState<string[]>(
    padded.slice(0, Math.max(props.maxMedicationSlots, 0))
  );
  const [checkin, setCheckin] = useState(props.initialCheckinTime);
  const [nudge, setNudge] = useState(props.initialNudgeTime);

  function updateSlot(i: number, value: string) {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }

  const inputCls =
    "rounded-xl border border-fv-border bg-fv-bg-card px-4 py-2.5 text-base font-medium text-fv-text-primary focus:border-fv-accent focus:outline-none";
  const cardCls = "rounded-2xl bg-fv-bg-card p-5 shadow-sm";

  return (
    <form action={props.action} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="medication_times"
        value={times.join(",")}
      />
      <input type="hidden" name="checkin_time" value={checkin} />
      <input type="hidden" name="nudge_time" value={nudge} />

      {props.maxMedicationSlots > 0 ? (
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-fv-text-primary">
            Medication reminder times
          </h2>
          <p className="mt-1 text-sm text-fv-text-secondary">
            We&apos;ll send your medication reminders at these times. Your
            most-frequent drop needs {props.maxMedicationSlots} reminders a
            day — less frequent drops only use the earliest slots.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {times.map((t, i) => (
              <label
                key={i}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-fv-text-primary">
                  {SLOT_LABELS[i] ?? `Reminder ${i + 1}`}
                </span>
                <input
                  type="time"
                  value={t}
                  required
                  onChange={(e) => updateSlot(i, e.target.value)}
                  className={inputCls}
                />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      <section className={cardCls}>
        <h2 className="text-base font-semibold text-fv-text-primary">
          Daily check-in reminder
        </h2>
        <p className="mt-1 text-sm text-fv-text-secondary">
          When should we remind you to do your daily check-in?
        </p>
        <label className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-fv-text-primary">
            Reminder time
          </span>
          <input
            type="time"
            value={checkin}
            required
            onChange={(e) => setCheckin(e.target.value)}
            className={inputCls}
          />
        </label>
      </section>

      {props.nudgeEnabled ? (
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-fv-text-primary">
            Friendly nudge time
          </h2>
          <p className="mt-1 text-sm text-fv-text-secondary">
            If you haven&apos;t checked in by this time, we&apos;ll send a
            gentle reminder.
          </p>
          <label className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-fv-text-primary">
              Nudge time
            </span>
            <input
              type="time"
              value={nudge}
              required
              onChange={(e) => setNudge(e.target.value)}
              className={inputCls}
            />
          </label>
        </section>
      ) : null}

      <SubmitButton
        pendingLabel="Saving…"
        className="rounded-xl bg-fv-accent-strong px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
      >
        {props.isOnboarding ? "Save and continue" : "Save reminder times"}
      </SubmitButton>
    </form>
  );
}

// Reasonable defaults for the Nth slot when the patient hasn't set one.
// Evenly spaced across the day starting at 06:00.
function defaultSlotTime(i: number): string {
  const hour = 6 + i * 3;
  return `${String(Math.min(hour, 23)).padStart(2, "0")}:00`;
}
