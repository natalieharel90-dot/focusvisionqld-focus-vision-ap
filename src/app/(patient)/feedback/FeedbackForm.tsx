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
    tab: string;
    blurb: string;
    hasStaffMention: boolean;
    staffPlaceholder?: string;
  }
> = {
  clinic: {
    tab: "Focus Vision",
    blurb:
      "Feedback about Focus Vision — your consultations, follow-up care, communication, and overall experience with our staff.",
    hasStaffMention: true,
    staffPlaceholder: "Optional — name or role of the staff member",
  },
  hospital: {
    tab: "Day Hospital",
    blurb:
      "Feedback about the day hospital where your procedure was performed — admission, theatre staff, recovery room and facilities.",
    hasStaffMention: true,
    staffPlaceholder: "Optional — e.g. theatre nurse, anaesthetist",
  },
  app: {
    tab: "This app",
    blurb:
      "Feedback about this Recovery Companion app — ease of use, missing features, bugs, design suggestions.",
    hasStaffMention: false,
  },
};

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

const sectionHeading =
  "text-sm font-bold uppercase tracking-wide text-fv-text-secondary";
const inputClass =
  "w-full rounded-2xl border border-fv-border bg-fv-bg-card px-4 py-3 text-sm text-fv-text-primary placeholder:text-fv-text-secondary";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star === value ? 0 : star)}
            className={`text-4xl leading-none transition-transform hover:scale-110 ${
              star <= value ? "text-fv-accent-warm" : "text-fv-bg-soft"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-sm font-medium text-fv-text-secondary">
        {value > 0 ? RATING_WORDS[value] : "Tap to rate"}
      </p>
    </div>
  );
}

export function FeedbackForm({
  facilityName,
}: {
  facilityName?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<FeedbackTarget>("clinic");
  const [sections, setSections] = useState<Record<FeedbackTarget, SectionState>>(
    { clinic: { ...EMPTY }, hospital: { ...EMPTY }, app: { ...EMPTY } }
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const state = sections[selected];
  const meta = META[selected];

  // Name the actual day hospital in the blurb when we know it.
  const blurb =
    selected === "hospital" && facilityName
      ? `Feedback about ${facilityName}, where your procedure was performed — admission, theatre staff, recovery room and facilities.`
      : meta.blurb;

  const update = (patch: Partial<SectionState>) =>
    setSections((s) => ({ ...s, [selected]: { ...s[selected], ...patch } }));

  function submit() {
    setError(null);
    // Submit every rated section, not just the visible tab — the action
    // keeps only sections with a 1-5 rating.
    const payload: FeedbackSection[] = FEEDBACK_TARGETS.map((t) => ({
      target: t.key,
      rating: sections[t.key].rating,
      comment: sections[t.key].comment,
      staffMention: sections[t.key].staffMention,
      contactRequested: sections[t.key].contactRequested,
    }));
    startTransition(async () => {
      const result = await submitFeedbackAction(payload);
      if (result.ok) router.push("/feedback?done=1");
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Who is the feedback about */}
      <section>
        <h2 className={sectionHeading}>Who is your feedback about?</h2>
        <div className="mt-2 flex gap-1 rounded-2xl bg-fv-bg-soft p-1">
          {FEEDBACK_TARGETS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelected(t.key)}
              className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold ${
                selected === t.key
                  ? "bg-fv-bg-card text-fv-text-primary shadow-sm"
                  : "text-fv-text-secondary"
              }`}
            >
              {META[t.key].tab}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-r-2xl rounded-bl-2xl border-l-4 border-fv-accent bg-fv-bg-accent-soft p-4 text-sm leading-relaxed text-fv-accent-strong">
          {blurb}
        </div>
      </section>

      {/* Star rating */}
      <section>
        <h2 className={sectionHeading}>How would you rate your experience?</h2>
        <div className="mt-3">
          <StarPicker
            value={state.rating}
            onChange={(rating) => update({ rating })}
          />
        </div>
      </section>

      {/* Staff mention */}
      {meta.hasStaffMention ? (
        <section>
          <h2 className={sectionHeading}>
            Any staff member you&apos;d like to mention?
          </h2>
          <input
            type="text"
            value={state.staffMention}
            onChange={(e) => update({ staffMention: e.target.value })}
            maxLength={120}
            placeholder={meta.staffPlaceholder}
            className={`mt-2 ${inputClass}`}
          />
        </section>
      ) : null}

      {/* Free-text feedback */}
      <section>
        <h2 className={sectionHeading}>Your feedback</h2>
        <textarea
          value={state.comment}
          onChange={(e) => update({ comment: e.target.value })}
          rows={5}
          placeholder="What went well? What could be better? Any specific moments you want to share?"
          className={`mt-2 ${inputClass} resize-none`}
        />
      </section>

      {/* Privacy note */}
      <div className="flex items-start gap-3 rounded-2xl bg-fv-bg-soft/70 p-4 text-sm text-fv-text-secondary">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-5 w-5 shrink-0 text-fv-text-primary"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p>
          Feedback is private. We&apos;ll only contact you if you ask us to.
        </p>
      </div>

      {/* Follow-up request */}
      <label className="flex cursor-pointer items-center gap-3 text-sm text-fv-text-primary">
        <input
          type="checkbox"
          checked={state.contactRequested}
          onChange={(e) => update({ contactRequested: e.target.checked })}
          className="h-5 w-5 shrink-0 rounded-full border-2 border-fv-border accent-fv-accent-strong"
        />
        <span>Please contact me to discuss this feedback.</span>
      </label>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={
          !FEEDBACK_TARGETS.some((t) => sections[t.key].rating >= 1) ||
          pending
        }
        onClick={submit}
        className="rounded-2xl bg-fv-accent-strong px-4 py-4 text-base font-bold text-white hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </div>
  );
}
