"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  BONUS_THEME_IDS,
  THEMES,
  THEME_IDS,
  pickRandomBonusTheme,
  type ThemePreference,
} from "@/lib/theme";
import { updateStaffThemeAction } from "@/app/(dashboard)/theme-actions";

type Props = {
  initialTheme: ThemePreference;
  initialDark: boolean;
  initialSparkle: boolean;
  bonusUnlocked: boolean;
};

// Compact appearance control in the sidebar footer. Applies the change
// to the dashboard root instantly, then persists to staff_users. Bonus
// themes + sparkle appear only after the pack is unlocked.
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

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-fv-text-secondary">
          Theme
        </span>
        <select
          value={theme}
          onChange={(e) => {
            const next = e.target.value as ThemePreference;
            setTheme(next);
            apply(next, dark, sparkle);
          }}
          className="rounded-md border border-fv-border bg-fv-bg-app px-2 py-1 text-xs text-fv-text-primary"
        >
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {THEMES[id].label}
            </option>
          ))}
          {bonusUnlocked ? (
            <optgroup label="Bonus pack ✨">
              {BONUS_THEME_IDS.map((id) => (
                <option key={id} value={id}>
                  {THEMES[id].label}
                </option>
              ))}
              <option value="random">🎲 Random</option>
            </optgroup>
          ) : null}
        </select>
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-fv-text-primary">
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
        <label className="flex cursor-pointer items-center gap-2 text-xs text-fv-text-primary">
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
