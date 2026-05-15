"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  FEEDBACK_TARGETS,
  type FeedbackSection,
  type FeedbackTarget,
} from "@/lib/feedback";
import { submitFeedbackAction } from "./actions";

type SectionState = {
  rating: number;
  comment: string;
  staffMention: string;
  contactRequested: boolean;
};

const EMPTY: SectionState = {
  rating: 0,
  comment: "",
  staffMention: "",
  contactRequested: false,
};

const META: Record<
  FeedbackTarget,
  {
    title: string;
    hasStaffMention: boolean;
    hasFollowUp: boolean;
    placeholder?: string;
  }
> = {
  clinic: {
    title: "Rate your Focus Vision clinic experience",
    hasStaffMention: true,
    hasFollowUp: true,
    placeholder: "e.g. Dr Chen, Receptionist Hannah, Nurse Mark",
  },
  hospital: {
    title: "Rate your hospital experience",
    hasStaffMention: true,
    hasFollowUp: false,
    placeholder: "e.g. theatre nurse, anaesthetist",
  },
  app: { title: "Rate this app", hasStaffMention: false, hasFollowUp: true },
};

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2 flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star === value ? 0 : star)}
          className={`text-3xl leading-none ${
            star <= value ? "text-fv-accent-warm" : "text-fv-bg-soft"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function FeedbackForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<FeedbackTarget>("clinic");
  const [sections, setSections] = useState<Record<FeedbackTarget, SectionState>>(
    { clinic: { ...EMPTY }, hospital: { ...EMPTY }, app: { ...EMPTY } }
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const state = sections[selected];
  const meta = META[selected];

  const update = (patch: Partial<SectionState>) =>
    setSections((s) => ({ ...s, [selected]: { ...s[selected], ...patch } }));

  function submit() {
    setError(null);
    const payload: FeedbackSection[] = [
      {
        target: selected,
        rating: state.rating,
        comment: state.comment,
        staffMention: state.staffMention,
        contactRequested: state.contactRequested,
      },
    ];
    startTransition(async () => {
      const result = await submitFeedbackAction(payload);
      if (result.ok) router.push("/feedback?done=1");
      else setError(result.error);
    });
  }

  const inputClass =
    "mt-2 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-4">
      {/* Target picker */}
      <div className="flex gap-2">
        {FEEDBACK_TARGETS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSelected(t.key)}
            className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${
              selected === t.key
                ? "border-fv-accent-strong bg-fv-accent-strong text-white"
                : "border-fv-border text-fv-text-primary hover:bg-fv-bg-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Selected section */}
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fv-text-primary">
          {meta.title}
        </h2>
        <StarPicker
          value={state.rating}
          onChange={(rating) => update({ rating })}
        />

        <textarea
          value={state.comment}
          onChange={(e) => update({ comment: e.target.value })}
          rows={4}
          placeholder="What went well? What could be better? (optional)"
          className={inputClass}
        />

        {meta.hasStaffMention ? (
          <label className="mt-3 block text-sm">
            <span className="text-fv-text-secondary">
              Mention a staff member who helped you (optional)
            </span>
            <input
              type="text"
              value={state.staffMention}
              onChange={(e) => update({ staffMention: e.target.value })}
              maxLength={120}
              placeholder={meta.placeholder}
              className={inputClass}
            />
          </label>
        ) : null}

        {meta.hasFollowUp ? (
          <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
            <span className="text-fv-text-primary">
              Would you like the team to follow up?
            </span>
            <input
              type="checkbox"
              checked={state.contactRequested}
              onChange={(e) => update({ contactRequested: e.target.checked })}
              className="h-5 w-5 rounded border-fv-border"
            />
          </label>
        ) : null}
      </section>

      <p className="text-center text-xs text-fv-text-secondary">
        Your feedback is private. We&apos;ll only contact you back if you ask
        us to.
      </p>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={state.rating === 0 || pending}
        onClick={submit}
        className="rounded-md bg-fv-accent-strong px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit feedback"}
      </button>
    </div>
  );
}
