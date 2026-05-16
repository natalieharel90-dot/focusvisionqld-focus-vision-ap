"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  EMPTY_COHORT_FILTER,
  cohortSummary,
  initials,
  recoveryDay,
  selectCohort,
  type CohortFilter,
  type CohortPatient,
  type FlagStatus,
  type ZoneFilter,
} from "@/lib/bulk-push";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { attachmentFilename, attachmentKind } from "@/lib/messages";
import { sendBulkPushAction } from "./actions";

const ATTACHMENT_ICON = { image: "🖼️", video: "🎬", document: "📄" } as const;

export type ContentLibraryItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
};

type Props = {
  patients: CohortPatient[];
  procedureTypes: string[];
  surgeons: { id: string; name: string }[];
  today: string;
  canSend: boolean;
  contentLibrary: ContentLibraryItem[];
};

type ContentMode = "message" | "content" | "both";

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

const chip = (selected: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium ${
    selected
      ? "border-fv-accent-strong bg-fv-accent-strong text-white"
      : "border-fv-border text-fv-text-primary hover:bg-fv-bg-soft"
  }`;

export function ComposeTab({
  patients,
  procedureTypes,
  surgeons,
  today,
  canSend,
  contentLibrary,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<CohortFilter>(EMPTY_COHORT_FILTER);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contentMode, setContentMode] = useState<ContentMode>("message");
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleAttachmentChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking / adding more
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      // Staff may write anywhere in message-attachments; the fan-out
      // copies these paths onto every delivered message.
      const objectPath = `bulk-push/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("message-attachments")
        .upload(objectPath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadErr) throw uploadErr;
      setAttachmentPaths((prev) => [...prev, objectPath]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  const [pending, startTransition] = useTransition();

  const hits = useMemo(
    () => selectCohort(patients, filter, today),
    [patients, filter, today]
  );
  const count = hits.length;

  const set = (patch: Partial<CohortFilter>) =>
    setFilter((f) => ({ ...f, ...patch }));

  const needsMessage = contentMode === "message" || contentMode === "both";
  const needsContent = contentMode === "content" || contentMode === "both";
  const canSubmit =
    canSend &&
    count > 0 &&
    (!needsMessage || (title.trim().length > 0 && body.trim().length > 0)) &&
    (!needsContent || selectedContentIds.length > 0) &&
    (scheduleMode === "now" || scheduledAt.length > 0);

  function confirmSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendBulkPushAction({
        cohortFilter: filter,
        cohortSummary: cohortSummary(filter, count),
        contentType: contentMode,
        contentItemIds: selectedContentIds,
        messageTitle: title,
        messageBody: body,
        attachmentPaths,
        scheduleMode,
        scheduledAt:
          scheduleMode === "later" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
        recipientCount: count,
      });
      if (result.ok) {
        setModalOpen(false);
        router.push("/bulk-push?tab=history");
      } else {
        setError(result.error);
        setModalOpen(false);
      }
    });
  }

  const card = "rounded-xl border border-fv-bg-soft bg-fv-bg-card p-5";
  const sectionTitle = "text-sm font-semibold text-fv-text-primary";
  const fieldLabel =
    "text-xs font-medium uppercase tracking-wide text-fv-text-secondary";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        {/* ── 1 · Cohort filter ── */}
        <section className={card}>
          <h2 className={sectionTitle}>1 · Choose your cohort</h2>

          <div className="mt-4">
            <div className={fieldLabel}>Procedure</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {procedureTypes.length === 0 ? (
                <span className="text-xs text-fv-text-secondary">
                  No active procedures.
                </span>
              ) : (
                procedureTypes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set({ procedures: toggle(filter.procedures, p) })}
                    className={chip(filter.procedures.includes(p))}
                  >
                    {p}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className={fieldLabel}>Surgeon</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {surgeons.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    set({ surgeonIds: toggle(filter.surgeonIds, s.id) })
                  }
                  className={chip(filter.surgeonIds.includes(s.id))}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className={fieldLabel}>Recovery day range</div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                value={filter.recoveryDayMin ?? ""}
                onChange={(e) =>
                  set({
                    recoveryDayMin:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="any"
                className="w-20 rounded-md border border-fv-border bg-fv-bg-app px-2 py-1.5"
              />
              <span className="text-fv-text-secondary">to</span>
              <input
                type="number"
                min={0}
                value={filter.recoveryDayMax ?? ""}
                onChange={(e) =>
                  set({
                    recoveryDayMax:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="any"
                className="w-20 rounded-md border border-fv-border bg-fv-bg-app px-2 py-1.5"
              />
              <span className="text-fv-text-secondary">days post-op</span>
            </div>
          </div>

          <div className="mt-4">
            <div className={fieldLabel}>Surgery date range</div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="date"
                value={filter.surgeryDateFrom ?? ""}
                onChange={(e) =>
                  set({ surgeryDateFrom: e.target.value || null })
                }
                className="rounded-md border border-fv-border bg-fv-bg-app px-2 py-1.5"
              />
              <span className="text-fv-text-secondary">to</span>
              <input
                type="date"
                value={filter.surgeryDateTo ?? ""}
                onChange={(e) => set({ surgeryDateTo: e.target.value || null })}
                className="rounded-md border border-fv-border bg-fv-bg-app px-2 py-1.5"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-5">
            <div>
              <div className={fieldLabel}>Manual flag status</div>
              <select
                value={filter.flagStatus}
                onChange={(e) =>
                  set({ flagStatus: e.target.value as FlagStatus })
                }
                className="mt-2 rounded-md border border-fv-border bg-fv-bg-app px-2 py-1.5 text-sm"
              >
                <option value="any">Any</option>
                <option value="none">No open flag</option>
                <option value="yellow">Yellow flag</option>
                <option value="orange">Orange flag</option>
                <option value="red">Red flag</option>
              </select>
            </div>
            <div>
              <div className={fieldLabel}>Last check-in zone</div>
              <select
                value={filter.lastCheckInZone}
                onChange={(e) =>
                  set({ lastCheckInZone: e.target.value as ZoneFilter })
                }
                className="mt-2 rounded-md border border-fv-border bg-fv-bg-app px-2 py-1.5 text-sm"
              >
                <option value="any">Any</option>
                <option value="green">Green</option>
                <option value="yellow">Yellow</option>
                <option value="orange">Orange</option>
              </select>
            </div>
          </div>
        </section>

        {/* ── 2 · Content ── */}
        <section className={card}>
          <h2 className={sectionTitle}>2 · Compose</h2>

          <div className="mt-4">
            <div className={fieldLabel}>What are you sending?</div>
            <div className="mt-2 flex gap-2">
              {(["message", "content", "both"] as ContentMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setContentMode(m)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    contentMode === m
                      ? "border-fv-accent-strong bg-fv-accent-strong text-white"
                      : "border-fv-border text-fv-text-primary hover:bg-fv-bg-soft"
                  }`}
                >
                  {m === "message"
                    ? "Custom message"
                    : m === "content"
                      ? "Existing content"
                      : "Both"}
                </button>
              ))}
            </div>
          </div>

          {needsContent ? (
            <div className="mt-4">
              <div className={fieldLabel}>Existing content</div>
              {contentLibrary.length === 0 ? (
                <p className="mt-2 text-xs text-fv-text-secondary">
                  No content items are available yet.
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {contentLibrary.map((item) => {
                    const selected = selectedContentIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setSelectedContentIds((ids) => toggle(ids, item.id))
                        }
                        className={`flex items-center gap-2 rounded-md border p-2 text-left text-xs ${
                          selected
                            ? "border-fv-accent-strong bg-fv-bg-accent-soft"
                            : "border-fv-border hover:bg-fv-bg-soft"
                        }`}
                      >
                        <span aria-hidden>
                          {item.type === "video" ? "▶️" : "📄"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-fv-text-primary">
                            {item.title}
                          </span>
                          {item.body ? (
                            <span className="block truncate text-fv-text-secondary">
                              {item.body}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-fv-accent-strong">
                          {selected ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {needsMessage ? (
            <>
              <div className="mt-4">
                <div className={fieldLabel}>Title</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="A heads-up about halos at this stage"
                  className="mt-2 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4">
                <div className={fieldLabel}>Message</div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Write a friendly note from the care team…"
                  className="mt-2 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4">
                <div className={fieldLabel}>Attachments (optional)</div>
                {attachmentPaths.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {attachmentPaths.map((p) => (
                      <li
                        key={p}
                        className="flex items-center justify-between gap-2 rounded-md border border-fv-border bg-fv-bg-card px-3 py-1.5 text-xs"
                      >
                        <span className="truncate text-fv-text-primary">
                          {ATTACHMENT_ICON[attachmentKind(p)]}{" "}
                          {attachmentFilename(p)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachmentPaths((prev) =>
                              prev.filter((x) => x !== p)
                            )
                          }
                          className="shrink-0 font-medium text-fv-text-secondary hover:text-fv-text-primary"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <label className="cursor-pointer rounded-md border border-fv-border bg-fv-bg-card px-3 py-1.5 font-medium text-fv-text-primary hover:bg-fv-bg-soft">
                    {uploading
                      ? "Uploading…"
                      : "📎 Add image, video or document"}
                    <input
                      type="file"
                      accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.txt"
                      onChange={handleAttachmentChange}
                      disabled={uploading}
                      className="sr-only"
                    />
                  </label>
                  {uploadError ? (
                    <span className="text-red-600">{uploadError}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-fv-text-secondary">
                  Delivered with the message to every recipient.
                </p>
              </div>
            </>
          ) : null}

          <p className="mt-3 text-xs text-fv-text-secondary">
            Delivered into each patient&apos;s message thread, labelled
            &ldquo;From Focus Vision team&rdquo;.
          </p>
        </section>

        {/* ── 3 · Scheduling ── */}
        <section className={card}>
          <h2 className={sectionTitle}>3 · When to send</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="schedule"
                checked={scheduleMode === "now"}
                onChange={() => setScheduleMode("now")}
              />
              <span className="text-fv-text-primary">Send now</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="schedule"
                checked={scheduleMode === "later"}
                onChange={() => setScheduleMode("later")}
              />
              <span className="text-fv-text-primary">Schedule for later</span>
            </label>
            {scheduleMode === "later" ? (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="ml-6 w-fit rounded-md border border-fv-border bg-fv-bg-app px-2 py-1.5"
              />
            ) : null}
          </div>
          <p className="mt-3 text-xs text-fv-text-secondary">
            Scheduled pushes that overlap with patient quiet hours are deferred
            to the next allowed window automatically.
          </p>
        </section>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          {canSend ? (
            <button
              type="button"
              disabled={!canSubmit || pending}
              onClick={() => setModalOpen(true)}
              className="rounded-md bg-fv-accent-strong px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scheduleMode === "now"
                ? `Send to ${count} patient${count === 1 ? "" : "s"}`
                : `Schedule for ${count} patient${count === 1 ? "" : "s"}`}
            </button>
          ) : (
            <p className="text-sm text-fv-text-secondary">
              You have view-only access — ask an admin or surgeon to send.
            </p>
          )}
        </div>
      </div>

      {/* ── Live preview ── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl bg-fv-accent-strong p-5 text-white">
          <div className="text-4xl font-bold">{count}</div>
          <div className="text-sm opacity-90">
            patient{count === 1 ? "" : "s"} match this cohort
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            {hits.slice(0, 5).map((h) => (
              <div
                key={h.patient.id}
                className="flex items-center gap-2 text-xs"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 font-semibold">
                  {initials(h.patient.name)}
                </span>
                <span className="opacity-90">
                  {h.patient.procedureType} · day{" "}
                  {recoveryDay(h.patient.surgeryDate as string, today)}
                </span>
              </div>
            ))}
            {count > 5 ? (
              <div className="mt-1 text-xs opacity-75">
                + {count - 5} more
              </div>
            ) : null}
            {count === 0 ? (
              <div className="text-xs opacity-75">
                Adjust the filters to target patients.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-fv-bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-fv-text-primary">
              {scheduleMode === "now"
                ? `Send to ${count} patient${count === 1 ? "" : "s"} now?`
                : `Schedule this push for ${count} patient${
                    count === 1 ? "" : "s"
                  }?`}
            </h3>
            <p className="mt-2 text-sm text-fv-text-secondary">
              Each recipient gets &ldquo;{title.trim()}&rdquo; in their message
              thread.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary hover:bg-fv-bg-soft disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmSend}
                className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
