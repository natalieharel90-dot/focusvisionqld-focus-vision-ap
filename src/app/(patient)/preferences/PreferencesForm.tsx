"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  BONUS_THEME_IDS,
  LANGUAGES,
  TEXT_SIZES,
  THEMES,
  THEME_IDS,
  pickRandomBonusTheme,
  themeSwatch,
  type ThemeId,
} from "@/lib/theme";
import { savePreferencesAction, type PreferencesPayload } from "./actions";

type Props = {
  initial: PreferencesPayload;
  bonusUnlocked: boolean;
};

// Applies appearance preferences to the patient root container so the
// change is visible instantly — no page reload. 'random' resolves to a
// concrete bonus theme for display; the stored preference stays 'random'.
function applyAppearance(p: PreferencesPayload) {
  const root = document.getElementById("fv-patient-root");
  if (!root) return;
  root.setAttribute(
    "data-theme",
    p.theme === "random" ? pickRandomBonusTheme() : p.theme
  );
  if (p.dark_mode) root.setAttribute("data-dark", "");
  else root.removeAttribute("data-dark");
  root.setAttribute("data-text-size", p.text_size);
  if (p.high_contrast) root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");
  if (p.reduce_motion) root.setAttribute("data-motion", "reduced");
  else root.removeAttribute("data-motion");
}

export function PreferencesForm({ initial, bonusUnlocked }: Props) {
  const [prefs, setPrefs] = useState<PreferencesPayload>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  // Update one or more fields: apply to the DOM instantly, then persist.
  function update(patch: Partial<PreferencesPayload>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyAppearance(next);
    startTransition(async () => {
      const result = await savePreferencesAction(next);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  const card = "rounded-2xl bg-fv-bg-card p-5 shadow-sm";
  const sectionTitle = "text-sm font-semibold text-fv-text-primary";

  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Settings
        </h1>
        <span className="text-xs text-fv-text-secondary">
          {pending
            ? "Saving…"
            : status === "saved"
              ? "Saved ✓"
              : status === "error"
                ? "Save failed"
                : ""}
        </span>
      </header>

      {/* ── Appearance ── */}
      <section className={card}>
        <h2 className={sectionTitle}>Appearance</h2>

        <div className="mt-3">
          <div className="text-xs font-medium text-fv-text-secondary">
            Theme
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {THEME_IDS.map((id: ThemeId) => (
              <ThemeSwatch
                key={id}
                id={id}
                active={prefs.theme === id}
                onSelect={() => update({ theme: id })}
              />
            ))}
          </div>
        </div>

        <ToggleRow
          label="Dark mode"
          checked={prefs.dark_mode}
          onChange={(v) => update({ dark_mode: v })}
        />

        <div className="mt-3">
          <div className="text-xs font-medium text-fv-text-secondary">
            Text size
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TEXT_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => update({ text_size: s.id })}
                className={`rounded-md border py-1.5 text-sm font-medium ${
                  prefs.text_size === s.id
                    ? "border-fv-accent-strong bg-fv-accent-strong text-white"
                    : "border-fv-border text-fv-text-primary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <ToggleRow
          label="High contrast"
          checked={prefs.high_contrast}
          onChange={(v) => update({ high_contrast: v })}
        />
        <ToggleRow
          label="Reduce motion"
          checked={prefs.reduce_motion}
          onChange={(v) => update({ reduce_motion: v })}
        />

        <Link
          href="/home?tour=replay"
          className="mt-3 block rounded-md border border-fv-border py-2 text-center text-sm font-medium text-fv-text-primary hover:bg-fv-bg-soft"
        >
          Replay app tour
        </Link>
      </section>

      {/* ── Bonus theme pack (only after unlock) ── */}
      {bonusUnlocked ? (
        <section className={card}>
          <h2 className={sectionTitle}>Bonus theme pack</h2>
          <p className="mt-1 text-xs text-fv-text-secondary">
            Twelve extra themes you unlocked. ✨
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {BONUS_THEME_IDS.map((id) => (
              <ThemeSwatch
                key={id}
                id={id}
                active={prefs.theme === id}
                onSelect={() => update({ theme: id })}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update({ theme: "random", sparkle: false })}
              className={`rounded-md border py-2 text-xs font-semibold ${
                prefs.theme === "random" && !prefs.sparkle
                  ? "border-fv-accent-strong bg-fv-accent-strong text-white"
                  : "border-fv-border text-fv-text-primary"
              }`}
            >
              🎲 Random
            </button>
            <button
              type="button"
              onClick={() => update({ theme: "random", sparkle: true })}
              className={`rounded-md border py-2 text-xs font-semibold ${
                prefs.theme === "random" && prefs.sparkle
                  ? "border-fv-accent-strong bg-fv-accent-strong text-white"
                  : "border-fv-border text-fv-text-primary"
              }`}
            >
              🎲 Random + Sparkle
            </button>
          </div>
          <ToggleRow
            label="✨ Sparkle overlay"
            checked={prefs.sparkle}
            onChange={(v) => update({ sparkle: v })}
          />
        </section>
      ) : null}

      {/* ── Language ── */}
      <section className={card}>
        <h2 className={sectionTitle}>Language</h2>
        <select
          value={prefs.language}
          onChange={(e) => update({ language: e.target.value })}
          className="mt-3 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm text-fv-text-primary"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </section>

      {/* ── Notifications ── */}
      <section className={card}>
        <h2 className={sectionTitle}>Notifications</h2>
        <p className="mt-1 text-xs text-fv-text-secondary">
          Choices are saved now; delivery wiring lands in a later update.
        </p>
        <ToggleRow
          label="Medication reminders"
          checked={prefs.notify_medication}
          onChange={(v) => update({ notify_medication: v })}
        />
        <ToggleRow
          label="Daily check-in nudge"
          checked={prefs.notify_checkin}
          onChange={(v) => update({ notify_checkin: v })}
        />
        <ToggleRow
          label="Message notifications"
          checked={prefs.notify_messages}
          onChange={(v) => update({ notify_messages: v })}
        />
      </section>
    </div>
  );
}

function ThemeSwatch({
  id,
  active,
  onSelect,
}: {
  id: ThemeId;
  active: boolean;
  onSelect: () => void;
}) {
  const sw = themeSwatch(id);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 ${
        active ? "border-fv-accent-strong" : "border-fv-border"
      }`}
    >
      <span
        className="h-8 w-full rounded"
        style={{
          background: sw.bg,
          borderBottom: `4px solid ${sw.accent}`,
        }}
      />
      <span className="text-[10px] text-fv-text-secondary">
        {THEMES[id].label.split(" ")[0]}
      </span>
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-center justify-between">
      <span className="text-sm text-fv-text-primary">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-fv-border"
      />
    </label>
  );
}
