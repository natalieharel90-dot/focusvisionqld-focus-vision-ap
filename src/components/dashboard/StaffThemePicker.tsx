"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  BONUS_THEME_IDS,
  THEMES,
  THEME_IDS,
  pickRandomBonusTheme,
  themeSwatch,
  type ThemeId,
  type ThemePreference,
} from "@/lib/theme";
import { updateStaffThemeAction } from "@/app/(dashboard)/theme-actions";

type Props = {
  initialTheme: ThemePreference;
  initialDark: boolean;
  initialSparkle: boolean;
  bonusUnlocked: boolean;
};

// Appearance control on Settings → Appearance. Applies the change to the
// dashboard root instantly, then persists to staff_users. Bonus themes +
// sparkle appear only after the pack is unlocked.
export function StaffThemePicker({
  initialTheme,
  initialDark,
  initialSparkle,
  bonusUnlocked,
}: Props) {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);
  const [dark, setDark] = useState(initialDark);
  const [sparkle, setSparkle] = useState(initialSparkle);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function apply(
    nextTheme: ThemePreference,
    nextDark: boolean,
    nextSparkle: boolean
  ) {
    const root = document.getElementById("fv-dashboard-root");
    if (root) {
      root.setAttribute(
        "data-theme",
        nextTheme === "random" ? pickRandomBonusTheme() : nextTheme
      );
      if (nextDark) root.setAttribute("data-dark", "");
      else root.removeAttribute("data-dark");
    }
    const sparkleChanged = nextSparkle !== sparkle;
    startTransition(async () => {
      const result = await updateStaffThemeAction(
        nextTheme,
        nextDark,
        nextSparkle
      );
      // The sparkle overlay is server-rendered by the layout; refresh so
      // it appears/disappears without a manual reload.
      if (result.ok && sparkleChanged) router.refresh();
    });
  }

  function selectTheme(next: ThemePreference) {
    setTheme(next);
    apply(next, dark, sparkle);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {THEME_IDS.map((id) => (
          <ThemeButton
            key={id}
            id={id}
            label={THEMES[id].label}
            active={theme === id}
            onSelect={() => selectTheme(id)}
          />
        ))}
      </div>

      {bonusUnlocked ? (
        <div>
          <div className="text-xs font-medium text-fv-text-secondary">
            Bonus pack ✨
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {BONUS_THEME_IDS.map((id) => (
              <ThemeButton
                key={id}
                id={id}
                label={THEMES[id].label}
                active={theme === id}
                onSelect={() => selectTheme(id)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => selectTheme("random")}
            className={`mt-2 rounded-lg border-2 px-4 py-1.5 text-xs font-semibold ${
              theme === "random"
                ? "border-fv-accent-strong bg-fv-accent-strong text-white"
                : "border-fv-border text-fv-text-primary hover:border-fv-accent"
            }`}
          >
            🎲 Random
          </button>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-center gap-2 text-sm text-fv-text-primary">
        <input
          type="checkbox"
          checked={dark}
          onChange={(e) => {
            setDark(e.target.checked);
            apply(theme, e.target.checked, sparkle);
          }}
          className="h-4 w-4 rounded border-fv-border"
        />
        Dark mode
      </label>
      {bonusUnlocked ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fv-text-primary">
          <input
            type="checkbox"
            checked={sparkle}
            onChange={(e) => {
              setSparkle(e.target.checked);
              apply(theme, dark, e.target.checked);
            }}
            className="h-4 w-4 rounded border-fv-border"
          />
          ✨ Sparkle overlay
        </label>
      ) : null}
    </div>
  );
}

function ThemeButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const sw = themeSwatch(id);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 ${
        active
          ? "border-fv-accent-strong"
          : "border-fv-border hover:border-fv-accent"
      }`}
    >
      <span
        className="h-9 w-full rounded"
        style={{ background: sw.bg, borderBottom: `4px solid ${sw.accent}` }}
      />
      <span className="text-center text-[11px] font-medium leading-tight text-fv-text-secondary">
        {label}
      </span>
    </button>
  );
}
