import { describe, expect, it } from "vitest";

import { HOME_TILES, PATIENT_TABS, isTabActive } from "./patient-shell";

describe("PATIENT_TABS — bottom nav", () => {
  it("has the five tabs in order", () => {
    expect(PATIENT_TABS.map((t) => t.href)).toEqual([
      "/home",
      "/check-in",
      "/medications",
      "/messages",
      "/preferences",
    ]);
  });
  it("every tab has a label and an icon", () => {
    for (const tab of PATIENT_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("isTabActive — active-route highlighting", () => {
  it("matches the exact path", () => {
    expect(isTabActive("/home", "/home")).toBe(true);
    expect(isTabActive("/medications", "/medications")).toBe(true);
  });
  it("matches a nested path under the tab", () => {
    expect(isTabActive("/check-in/done", "/check-in")).toBe(true);
  });
  it("does not match a different tab", () => {
    expect(isTabActive("/messages", "/home")).toBe(false);
    // /home should not match /home-something
    expect(isTabActive("/homepage", "/home")).toBe(false);
  });
});

describe("HOME_TILES — home tile grid", () => {
  it("renders the six tiles", () => {
    expect(HOME_TILES).toHaveLength(6);
  });

  it("includes the expected tiles with icons", () => {
    const keys = HOME_TILES.map((t) => t.key);
    expect(keys).toEqual([
      "check-in",
      "medications",
      "messages",
      "videos",
      "contact",
      "settings",
    ]);
    for (const tile of HOME_TILES) {
      expect(tile.icon.length).toBeGreaterThan(0);
      expect(tile.title.length).toBeGreaterThan(0);
    }
  });

  it("every home tile links to its built screen", () => {
    const byKey = new Map(HOME_TILES.map((t) => [t.key, t]));
    expect(byKey.get("check-in")?.href).toBe("/check-in");
    expect(byKey.get("medications")?.href).toBe("/medications");
    expect(byKey.get("messages")?.href).toBe("/messages");
    expect(byKey.get("settings")?.href).toBe("/preferences");
    expect(byKey.get("videos")?.href).toBe("/videos");
    expect(byKey.get("contact")?.href).toBe("/contact");
  });
});
