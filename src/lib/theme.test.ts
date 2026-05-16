import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  THEME_IDS,
  THEMES,
  buildThemeCss,
  isValidTheme,
  resolveThemePreference,
} from "./theme";

// Relative luminance (0 dark – 1 light) for #RRGGBB.
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("THEMES — five themes, palettes lifted from the prototype", () => {
  it("has exactly the five production themes", () => {
    expect(THEME_IDS).toEqual([
      "calm",
      "premium",
      "bright",
      "terracotta",
      "minimal",
    ]);
  });

  it("each theme's light palette carries every token", () => {
    const required = [
      "--fv-bg-app",
      "--fv-bg-card",
      "--fv-bg-soft",
      "--fv-bg-accent-soft",
      "--fv-text-primary",
      "--fv-text-secondary",
      "--fv-text-muted",
      "--fv-accent",
      "--fv-accent-strong",
      "--fv-border",
    ];
    for (const id of THEME_IDS) {
      for (const token of required) {
        expect(THEMES[id].light[token]).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it("applies the exact prototype values per theme", () => {
    expect(THEMES.calm.light["--fv-accent"]).toBe("#4F9DAA");
    expect(THEMES.calm.light["--fv-bg-app"]).toBe("#F0F6F8");
    expect(THEMES.premium.light["--fv-accent"]).toBe("#B8964F");
    expect(THEMES.bright.light["--fv-accent"]).toBe("#F8A185");
    expect(THEMES.terracotta.light["--fv-accent"]).toBe("#C0654D");
    expect(THEMES.minimal.light["--fv-accent"]).toBe("#2563EB");
  });
});

describe("dark mode — darkens surfaces, lightens text", () => {
  it("for every theme, dark bg is darker and dark text is lighter", () => {
    for (const id of THEME_IDS) {
      const t = THEMES[id];
      // surface darkens
      expect(luminance(t.dark["--fv-bg-app"]!)).toBeLessThan(
        luminance(t.light["--fv-bg-app"]!)
      );
      // text lightens
      expect(luminance(t.dark["--fv-text-primary"]!)).toBeGreaterThan(
        luminance(t.light["--fv-text-primary"]!)
      );
    }
  });

  it("keeps the accent character — dark accent stays defined, not greyed out", () => {
    for (const id of THEME_IDS) {
      const t = THEMES[id];
      // dark mode overrides the accent (lighter variant) but it is still
      // a saturated colour, not collapsed to a surface/text token
      expect(t.dark["--fv-accent"]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.dark["--fv-accent"]).not.toBe(t.dark["--fv-bg-app"]);
      expect(t.dark["--fv-accent"]).not.toBe(t.dark["--fv-text-primary"]);
    }
  });

  it("dark blocks do not redefine accent-warm / danger / success", () => {
    // Those cascade from the light rule, preserving accent character.
    for (const id of THEME_IDS) {
      expect(THEMES[id].dark["--fv-accent-warm"]).toBeUndefined();
      expect(THEMES[id].dark["--fv-danger"]).toBeUndefined();
    }
  });
});

describe("isValidTheme", () => {
  it("accepts the five theme ids", () => {
    for (const id of THEME_IDS) expect(isValidTheme(id)).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidTheme("debut")).toBe(false);
    expect(isValidTheme("")).toBe(false);
    expect(isValidTheme(null)).toBe(false);
    expect(isValidTheme(42)).toBe(false);
  });
});

describe("resolveThemePreference — fallback behaviour", () => {
  it("no preferences ⇒ Calm medical, light mode", () => {
    expect(resolveThemePreference(null)).toEqual({
      theme: "calm",
      dark: false,
    });
    expect(resolveThemePreference(undefined)).toEqual({
      theme: DEFAULT_THEME,
      dark: false,
    });
  });

  it("reads a stored theme + dark mode", () => {
    expect(
      resolveThemePreference({ theme: "premium", dark_mode: true })
    ).toEqual({ theme: "premium", dark: true });
  });

  it("an invalid stored theme falls back to Calm medical", () => {
    expect(
      resolveThemePreference({ theme: "not-a-theme", dark_mode: false })
    ).toEqual({ theme: "calm", dark: false });
  });
});

describe("buildThemeCss", () => {
  const css = buildThemeCss();

  it("emits a [data-theme] rule for every theme", () => {
    for (const id of THEME_IDS) {
      expect(css).toContain(`[data-theme="${id}"]{`);
      expect(css).toContain(`[data-theme="${id}"][data-dark]{`);
    }
  });

  it("includes the verbatim prototype values", () => {
    expect(css).toContain("--fv-accent:#4F9DAA;"); // calm light
    expect(css).toContain("--fv-bg-app:#142026;"); // calm dark
    expect(css).toContain("--fv-accent:#2563EB;"); // minimal light
  });
});

import {
  ALL_THEME_IDS,
  BONUS_THEME_IDS,
  BONUS_TOAST_DURATION_MS,
  BONUS_UNLOCK_CLICKS,
  BONUS_UNLOCK_TOAST,
  BONUS_UNLOCK_WINDOW_MS,
  evaluateUnlockClicks,
  isBonusTheme,
  pickRandomBonusTheme,
  shouldShowSparkle,
} from "./theme";

describe("bonus theme pack — twelve extra themes", () => {
  it("has exactly twelve bonus themes, none overlapping the visible five", () => {
    expect(BONUS_THEME_IDS).toHaveLength(12);
    for (const id of BONUS_THEME_IDS) {
      expect(THEME_IDS).not.toContain(id);
    }
    expect(ALL_THEME_IDS).toHaveLength(17);
  });

  it("each bonus theme carries a full light token palette", () => {
    const required = [
      "--fv-bg-app",
      "--fv-bg-card",
      "--fv-text-primary",
      "--fv-accent",
      "--fv-border",
    ];
    for (const id of BONUS_THEME_IDS) {
      for (const token of required) {
        expect(THEMES[id].light[token]).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it("applies the exact prototype palette values per bonus theme", () => {
    expect(THEMES.roots.light["--fv-accent"]).toBe("#4FB0BB");
    expect(THEMES.gilded.light["--fv-accent"]).toBe("#D4A437");
    expect(THEMES.twilight.light["--fv-accent"]).toBe("#7E4DAB");
    expect(THEMES.scarlet.light["--fv-accent"]).toBe("#C13434");
    expect(THEMES.skyline.light["--fv-accent"]).toBe("#5BAAD5");
    expect(THEMES.eclipse.light["--fv-accent"]).toBe("#C8202E");
    expect(THEMES.bloom.light["--fv-accent"]).toBe("#E682B0");
    expect(THEMES.mist.light["--fv-accent"]).toBe("#6E6E6E");
    expect(THEMES.ember.light["--fv-accent"]).toBe("#B8723C");
    expect(THEMES.midnight.light["--fv-accent"]).toBe("#3142A8");
    expect(THEMES.inkwell.light["--fv-accent"]).toBe("#2E2A24");
    expect(THEMES.limelight.light["--fv-accent"]).toBe("#F08A3C");
  });

  it("buildThemeCss emits a rule for every bonus theme", () => {
    const css = buildThemeCss();
    for (const id of BONUS_THEME_IDS) {
      expect(css).toContain(`[data-theme="${id}"]{`);
    }
  });

  it("each bonus theme has a dark variant that stays legible", () => {
    const css = buildThemeCss();
    for (const id of BONUS_THEME_IDS) {
      const t = THEMES[id];
      // Surfaces darken, text lightens — the pack is usable in dark mode.
      expect(luminance(t.dark["--fv-bg-app"]!)).toBeLessThan(
        luminance(t.light["--fv-bg-app"]!)
      );
      expect(luminance(t.dark["--fv-text-primary"]!)).toBeGreaterThan(
        luminance(t.light["--fv-text-primary"]!)
      );
      // The accent keeps its character, not collapsed onto a surface.
      expect(t.dark["--fv-accent"]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.dark["--fv-accent"]).not.toBe(t.dark["--fv-bg-app"]);
      // A dark rule is emitted so dark mode actually applies.
      expect(css).toContain(`[data-theme="${id}"][data-dark]{`);
    }
  });

  it("isBonusTheme distinguishes bonus from visible themes", () => {
    expect(isBonusTheme("roots")).toBe(true);
    expect(isBonusTheme("midnight")).toBe(true);
    expect(isBonusTheme("calm")).toBe(false);
    expect(isBonusTheme("not-a-theme")).toBe(false);
  });
});

describe("evaluateUnlockClicks — 13-click Easter egg", () => {
  it("unlocks on the 13th click within the window", () => {
    let clicks: number[] = [];
    let unlocked = false;
    // 13 clicks, 100ms apart — well within the 5s window.
    for (let i = 0; i < BONUS_UNLOCK_CLICKS; i++) {
      const result = evaluateUnlockClicks(clicks, i * 100);
      clicks = result.clicks;
      unlocked = result.unlocked;
    }
    expect(unlocked).toBe(true);
  });

  it("does not unlock at twelve clicks", () => {
    let clicks: number[] = [];
    let unlocked = false;
    for (let i = 0; i < 12; i++) {
      const result = evaluateUnlockClicks(clicks, i * 100);
      clicks = result.clicks;
      unlocked = result.unlocked;
    }
    expect(unlocked).toBe(false);
  });

  it("resets clicks older than the 5-second window", () => {
    // 12 clicks, then a long gap — the old ones expire.
    let clicks: number[] = [];
    for (let i = 0; i < 12; i++) {
      clicks = evaluateUnlockClicks(clicks, i * 100).clicks;
    }
    expect(clicks).toHaveLength(12);
    // A click well after the window (last prior click was at 1100ms)
    // prunes everything stale, leaving only the fresh click.
    const afterGap = evaluateUnlockClicks(clicks, 10000);
    expect(afterGap.clicks).toHaveLength(1);
    expect(afterGap.unlocked).toBe(false);
  });

  it("the window constant is 5 seconds", () => {
    expect(BONUS_UNLOCK_WINDOW_MS).toBe(5000);
  });
});

describe("pickRandomBonusTheme", () => {
  it("always returns a bonus theme", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(BONUS_THEME_IDS).toContain(pickRandomBonusTheme(() => r));
    }
  });
  it("'random' preference resolves to a bonus theme", () => {
    const resolved = resolveThemePreference(
      { theme: "random", dark_mode: false },
      () => 0.5
    );
    expect(BONUS_THEME_IDS).toContain(resolved.theme);
  });
});

describe("shouldShowSparkle — respects reduce-motion", () => {
  it("shows sparkle when enabled and motion is allowed", () => {
    expect(shouldShowSparkle(true, false)).toBe(true);
  });
  it("hides sparkle when reduce-motion is on, even if enabled", () => {
    expect(shouldShowSparkle(true, true)).toBe(false);
  });
  it("hides sparkle when not enabled", () => {
    expect(shouldShowSparkle(false, false)).toBe(false);
  });
});

describe("unlock toast — text + timing snapshot", () => {
  it("toast copy and timing are stable", () => {
    expect({
      text: BONUS_UNLOCK_TOAST,
      clicks: BONUS_UNLOCK_CLICKS,
      windowMs: BONUS_UNLOCK_WINDOW_MS,
      durationMs: BONUS_TOAST_DURATION_MS,
    }).toMatchInlineSnapshot(`
      {
        "clicks": 13,
        "durationMs": 4000,
        "text": "Bonus theme pack unlocked!",
        "windowMs": 5000,
      }
    `);
  });
});
