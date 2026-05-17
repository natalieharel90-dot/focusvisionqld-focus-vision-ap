"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";

import {
  BONUS_THEME_IDS,
  LANGUAGES,
  TEXT_SIZES,
  THEMES,
  THEME_IDS,
  pickRandomBonusTheme,
  type ThemeId,
} from "@/lib/theme";
import { savePreferencesAction, type PreferencesPayload } from "./actions";

type Account = {
  name: string;
  email: string | null;
  phone: string | null;
};

type Props = {
  initial: PreferencesPayload;
  bonusUnlocked: boolean;
  account: Account;
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

// Three representative colours per theme for the swatch row.
function themePalette(id: ThemeId): string[] {
  const p = THEMES[id].light;
  return [p["--fv-accent"]!, p["--fv-accent-2"]!, p["--fv-bg-app"]!];
}

const card = "rounded-2xl bg-fv-bg-card p-4 shadow-sm";

export function PreferencesForm({ initial, bonusUnlocked, account }: Props) {
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

  const langLabel =
    LANGUAGES.find((l) => l.id === prefs.language)?.label ?? "English";

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold text-fv-text-primary">Settings</h1>
          <span className="mt-2 shrink-0 text-xs text-fv-text-secondary">
            {pending
              ? "Saving…"
              : status === "saved"
                ? "Saved ✓"
                : status === "error"
                  ? "Save failed"
                  : ""}
          </span>
        </div>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Make the app comfortable for your eyes
        </p>
      </header>

      {/* ── Appearance ── */}
      <Section title="Appearance">
        <ToggleCard
          title="Dark mode"
          sub="Easier in low light & post-op sensitivity"
          checked={prefs.dark_mode}
          onChange={(v) => update({ dark_mode: v })}
        />
      </Section>

      {/* ── Colour theme ── */}
      <Section title="Colour theme">
        <div className="grid grid-cols-2 gap-3">
          {THEME_IDS.map((id) => (
            <ThemeCard
              key={id}
              id={id}
              active={prefs.theme === id}
              onSelect={() => update({ theme: id })}
            />
          ))}
        </div>
      </Section>

      {/* ── Bonus theme pack (only after unlock) ── */}
      {bonusUnlocked ? (
        <Section title="Bonus theme pack">
          <p className="-mt-1 text-xs text-fv-text-secondary">
            Twelve extra themes you unlocked. ✨
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BONUS_THEME_IDS.map((id) => (
              <ThemeCard
                key={id}
                id={id}
                active={prefs.theme === id}
                onSelect={() => update({ theme: id })}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update({ theme: "random", sparkle: false })}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${
                prefs.theme === "random" && !prefs.sparkle
                  ? "border-fv-accent-strong text-fv-text-primary"
                  : "border-transparent bg-fv-bg-card text-fv-text-primary shadow-sm"
              }`}
            >
              🎲 Random
            </button>
            <button
              type="button"
              onClick={() => update({ theme: "random", sparkle: true })}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${
                prefs.theme === "random" && prefs.sparkle
                  ? "border-fv-accent-strong text-fv-text-primary"
                  : "border-transparent bg-fv-bg-card text-fv-text-primary shadow-sm"
              }`}
            >
              🎲 Random + Sparkle
            </button>
          </div>
          <ToggleCard
            title="✨ Sparkle overlay"
            sub="A little celebration shimmer"
            checked={prefs.sparkle}
            onChange={(v) => update({ sparkle: v })}
          />
        </Section>
      ) : null}

      {/* ── Reminders ── */}
      <Section title="Reminders">
        <ToggleCard
          title="Medication reminders"
          sub="Notifications + reminder sound"
          checked={prefs.notify_medication}
          onChange={(v) => update({ notify_medication: v })}
        />
        <ChoiceCard
          title="Snooze duration"
          sub="When you tap Snooze, the reminder fires again after this long."
        >
          <Segmented
            value={prefs.snooze_minutes}
            onChange={(v) => update({ snooze_minutes: v })}
            options={[5, 10, 15, 30].map((n) => ({
              value: n,
              label: `${n} min`,
            }))}
          />
        </ChoiceCard>
        <ToggleCard
          title="Daily check-in reminder"
          sub="Every morning at 9:00 AM"
          checked={prefs.notify_checkin}
          onChange={(v) => update({ notify_checkin: v })}
        />
        <ToggleCard
          title="Message notifications"
          sub="When your care team replies to you"
          checked={prefs.notify_messages}
          onChange={(v) => update({ notify_messages: v })}
        />
        <ToggleCard
          title="Friendly nudge if I forget"
          sub="If I haven't done my check-in by mid-afternoon, send me a gentle reminder. Off by default."
          checked={prefs.notify_checkin_nudge}
          onChange={(v) => update({ notify_checkin_nudge: v })}
        />
        <ToggleCard
          title="Quiet hours"
          sub="No reminders 10 PM – 7 AM"
          checked={prefs.quiet_hours}
          onChange={(v) => update({ quiet_hours: v })}
        />
        <ToggleCard
          title="Travelling? Lock to original timezone"
          sub="Off (default): reminders follow your phone's clock. On: reminders stay on Brisbane time even if you travel."
          checked={prefs.lock_timezone}
          onChange={(v) => update({ lock_timezone: v })}
        />
        <ToggleCard
          title="Lock screen widget"
          sub="Show your next dose on your phone's lock screen — no need to unlock."
          checked={prefs.lock_screen_widget}
          onChange={(v) => update({ lock_screen_widget: v })}
        />
      </Section>

      {/* ── Language ── */}
      <Section title="Language">
        <div className={`flex items-center gap-3 ${card}`}>
          <div className="shrink-0">
            <div className="font-semibold text-fv-text-primary">
              App language
            </div>
            <div className="mt-0.5 text-sm text-fv-text-secondary">
              Currently in {langLabel}
            </div>
          </div>
          <select
            value={prefs.language}
            onChange={(e) => update({ language: e.target.value })}
            className="ml-auto min-w-0 flex-1 rounded-xl border border-fv-border bg-fv-bg-app px-3 py-2.5 text-sm font-medium text-fv-text-primary"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* ── Accessibility ── */}
      <Section title="Accessibility">
        <ChoiceCard
          title="Larger text"
          sub="Increase the size of text throughout the app"
        >
          <Segmented
            value={prefs.text_size}
            onChange={(v) => update({ text_size: v })}
            options={TEXT_SIZES.map((s) => ({ value: s.id, label: s.label }))}
          />
        </ChoiceCard>
        <ToggleCard
          title="Higher contrast"
          sub="Stronger colour contrast for easier reading"
          checked={prefs.high_contrast}
          onChange={(v) => update({ high_contrast: v })}
        />
        <ToggleCard
          title="Reduce motion"
          sub="Minimise animations and transitions"
          checked={prefs.reduce_motion}
          onChange={(v) => update({ reduce_motion: v })}
        />
        <ToggleCard
          title="Voice control"
          sub="Hands-free check-ins and medication marking"
          checked={prefs.voice_control}
          onChange={(v) => update({ voice_control: v })}
        />
        <InfoNote icon={<InfoIcon />}>
          Fully optimised for VoiceOver (iPhone) and TalkBack (Android). All
          app features remain accessible with screen readers.
        </InfoNote>
        <LinkCard
          title="Replay app tour"
          sub="See the welcome walkthrough again"
          href="/home?tour=replay"
        />
      </Section>

      {/* ── Account ── */}
      <Section title="Account">
        <Link
          href="/preferences/account"
          className={`flex items-center justify-between gap-3 ${card}`}
        >
          <div className="min-w-0">
            <div className="font-semibold text-fv-text-primary">
              {account.name}
            </div>
            <div className="mt-0.5 truncate text-sm text-fv-text-secondary">
              {[account.email, account.phone].filter(Boolean).join(" · ") ||
                "No contact details on file"}
            </div>
          </div>
          <Chevron />
        </Link>
      </Section>

      {/* ── Privacy & data ── */}
      <Section title="Privacy & data">
        <LinkCard
          title="Privacy policy"
          sub="How we handle your information"
          href="/preferences/privacy"
        />
        <LinkCard
          title="Download my data"
          sub="Export a copy of everything you've shared"
          href="/preferences/data"
        />
        <LinkCard
          title="Delete my account"
          sub="Request account deletion (clinical records retained per law)"
          href="/preferences/delete"
        />
        <InfoNote icon={<LockIcon />}>
          Your information is encrypted at rest and in transit. Data is stored
          in Australia and never shared outside Focus Vision and your care
          team.
        </InfoNote>
      </Section>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-fv-text-secondary">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-fv-accent-strong" : "bg-fv-bg-soft"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ToggleCard({
  title,
  sub,
  checked,
  onChange,
}: {
  title: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${card}`}>
      <div className="min-w-0">
        <div className="font-semibold text-fv-text-primary">{title}</div>
        {sub ? (
          <div className="mt-0.5 text-sm text-fv-text-secondary">{sub}</div>
        ) : null}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function ChoiceCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className={card}>
      <div className="font-semibold text-fv-text-primary">{title}</div>
      {sub ? (
        <div className="mt-0.5 text-sm text-fv-text-secondary">{sub}</div>
      ) : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-fv-bg-soft p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${
            value === o.value
              ? "bg-fv-bg-card text-fv-text-primary shadow-sm"
              : "text-fv-text-secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ThemeCard({
  id,
  active,
  onSelect,
}: {
  id: ThemeId;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-3 rounded-2xl border-2 bg-fv-bg-card p-4 text-left shadow-sm ${
        active ? "border-fv-accent-strong" : "border-transparent"
      }`}
    >
      <span className="font-semibold text-fv-text-primary">
        {THEMES[id].label}
      </span>
      <span className="flex gap-1.5">
        {themePalette(id).map((colour, i) => (
          <span
            key={i}
            className="h-9 flex-1 rounded-lg"
            style={{ background: colour }}
          />
        ))}
      </span>
    </button>
  );
}

function LinkCard({
  title,
  sub,
  href,
}: {
  title: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 ${card}`}
    >
      <div className="min-w-0">
        <div className="font-semibold text-fv-text-primary">{title}</div>
        <div className="mt-0.5 text-sm text-fv-text-secondary">{sub}</div>
      </div>
      <Chevron />
    </Link>
  );
}

function InfoNote({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-fv-bg-soft/70 p-4 text-sm text-fv-text-secondary">
      <span className="mt-0.5 shrink-0 text-fv-accent-strong">{icon}</span>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function Chevron() {
  return (
    <span aria-hidden className="shrink-0 text-lg text-fv-text-secondary">
      ›
    </span>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
