"use client";

import { useMemo, useRef, useState } from "react";

import { pinContentAction } from "./actions";

export type ContentOption = {
  id: string;
  type: string;
  title: string;
  audience: string;
  procedures: string[];
};

const AUDIENCES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "post_op", label: "Post-op" },
  { value: "pre_op", label: "Pre-op" },
  { value: "both", label: "Both" },
];

// "+ Push content" button + a tabbed picker: pin a content_items row
// from the library, or pin a one-off ad-hoc reassurance message.
export function PushContentModal({
  patientId,
  options,
  patientProcedure,
}: {
  patientId: string;
  options: ContentOption[];
  patientProcedure: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"library" | "adhoc">("library");
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("all");
  const [thisProcedure, setThisProcedure] = useState(patientProcedure != null);
  const [selected, setSelected] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => {
      if (audience !== "all" && o.audience !== audience) return false;
      if (q && !o.title.toLowerCase().includes(q)) return false;
      if (thisProcedure && patientProcedure) {
        const relevant =
          o.procedures.length === 0 ||
          o.procedures.includes(patientProcedure);
        if (!relevant) return false;
      }
      return true;
    });
  }, [options, query, audience, thisProcedure, patientProcedure]);

  const inputCls =
    "w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-md border border-fv-border bg-fv-bg-card px-3 py-1.5 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
      >
        + Push content
      </button>

      <dialog
        ref={ref}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3 p-5">
          <h2 className="text-base font-semibold text-fv-text-primary">
            Push content to this patient
          </h2>

          {/* Tabs */}
          <div className="flex rounded-lg border border-fv-bg-soft p-0.5">
            {(["library", "adhoc"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${
                  tab === t
                    ? "bg-fv-accent-strong text-white"
                    : "text-fv-text-secondary"
                }`}
              >
                {t === "library" ? "Pick from library" : "Ad-hoc message"}
              </button>
            ))}
          </div>

          {tab === "library" ? (
            <form
              action={pinContentAction}
              onSubmit={() => ref.current?.close()}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="patient_id" value={patientId} />

              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the content library…"
                className={inputCls}
              />
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAudience(a.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      audience === a.value
                        ? "bg-fv-accent-strong text-white"
                        : "border border-fv-border text-fv-text-secondary"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {patientProcedure ? (
                <label className="flex items-center gap-2 text-xs text-fv-text-secondary">
                  <input
                    type="checkbox"
                    checked={thisProcedure}
                    onChange={(e) => setThisProcedure(e.target.checked)}
                    className="h-4 w-4 rounded border-fv-border"
                  />
                  Only content for {patientProcedure.toUpperCase()}
                </label>
              ) : null}

              <div className="max-h-60 overflow-y-auto rounded-lg border border-fv-bg-soft">
                {filtered.length === 0 ? (
                  <p className="p-4 text-center text-sm text-fv-text-secondary">
                    No matching content.
                  </p>
                ) : (
                  filtered.map((o) => (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-fv-bg-soft px-3 py-2 last:border-0 hover:bg-fv-bg-soft/50"
                    >
                      <input
                        type="radio"
                        name="content_id"
                        value={o.id}
                        onChange={() => setSelected(o.id)}
                        className="h-4 w-4"
                      />
                      <span className="text-base" aria-hidden>
                        {o.type === "video" ? "📺" : "📄"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fv-text-primary">
                          {o.title}
                        </span>
                        <span className="block text-[11px] capitalize text-fv-text-secondary">
                          {o.type} · {o.audience.replace("_", "-")}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => ref.current?.close()}
                  className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selected}
                  className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Pin this guide
                </button>
              </div>
            </form>
          ) : (
            <form
              action={pinContentAction}
              onSubmit={() => ref.current?.close()}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="patient_id" value={patientId} />
              <label>
                <span className="text-xs font-medium text-fv-text-secondary">
                  Reassurance message
                </span>
                <textarea
                  name="ad_hoc_message"
                  required
                  rows={3}
                  placeholder='e.g. "Avoid screens until 6 PM"'
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => ref.current?.close()}
                  className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
                >
                  Pin message
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
