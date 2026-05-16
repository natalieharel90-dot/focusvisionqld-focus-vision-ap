import { describe, expect, it } from "vitest";

import {
  type ContactOption,
  type OpeningHours,
  contactHeroTagline,
  isAfterHours,
  summariseHours,
  visibleContactOptions,
} from "./contact";

function option(o: Partial<ContactOption> & { id: string }): ContactOption {
  return {
    label: "Option",
    subtitle: null,
    icon: "phone",
    action_type: "custom",
    action_value: null,
    order_index: 0,
    enabled: true,
    is_required: false,
    ...o,
  };
}

describe("visibleContactOptions", () => {
  it("hides a disabled, non-required option", () => {
    const opts = [
      option({ id: "a", enabled: true, order_index: 1 }),
      option({ id: "b", enabled: false, order_index: 2 }),
    ];
    expect(visibleContactOptions(opts).map((o) => o.id)).toEqual(["a"]);
  });

  it("keeps a required option even when disabled (Call the clinic)", () => {
    const opts = [
      option({ id: "msg", enabled: false, is_required: false, order_index: 2 }),
      option({
        id: "call",
        enabled: false,
        is_required: true,
        action_type: "call",
        order_index: 1,
      }),
    ];
    const visible = visibleContactOptions(opts);
    expect(visible.map((o) => o.id)).toEqual(["call"]);
  });

  it("orders by order_index", () => {
    const opts = [
      option({ id: "third", order_index: 3 }),
      option({ id: "first", order_index: 1 }),
      option({ id: "second", order_index: 2 }),
    ];
    expect(visibleContactOptions(opts).map((o) => o.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});

describe("isAfterHours — clinic timezone aware", () => {
  // Mon-Fri 08:00-17:00, Sat 09:00-13:00, Sun closed.
  const HOURS: OpeningHours = {
    mon: ["08:00", "17:00"],
    tue: ["08:00", "17:00"],
    wed: ["08:00", "17:00"],
    thu: ["08:00", "17:00"],
    fri: ["08:00", "17:00"],
    sat: ["09:00", "13:00"],
    sun: null,
  };
  const TZ = "Australia/Brisbane"; // UTC+10, no DST

  it.each<[string, string, boolean]>([
    // Friday 2026-05-15, Brisbane = UTC+10
    ["Fri 10:00 — open", "2026-05-15T00:00:00Z", false],
    ["Fri 19:00 — after close", "2026-05-15T09:00:00Z", true],
    ["Fri 07:00 — before open", "2026-05-14T21:00:00Z", true],
    ["Fri 17:00 — exactly close", "2026-05-15T07:00:00Z", true],
    // Saturday 2026-05-16
    ["Sat 10:00 — open", "2026-05-16T00:00:00Z", false],
    ["Sat 14:00 — after close", "2026-05-16T04:00:00Z", true],
    // Sunday 2026-05-17 — closed all day
    ["Sun 12:00 — closed", "2026-05-17T02:00:00Z", true],
  ])("%s", (_label, iso, expected) => {
    expect(isAfterHours(HOURS, new Date(iso), TZ)).toBe(expected);
  });
});

describe("contactHeroTagline — Contact hero", () => {
  // Mon-Fri 08:00-17:00, Sat 09:00-13:00, Sun closed.
  const HOURS: OpeningHours = {
    mon: ["08:00", "17:00"],
    tue: ["08:00", "17:00"],
    wed: ["08:00", "17:00"],
    thu: ["08:00", "17:00"],
    fri: ["08:00", "17:00"],
    sat: ["09:00", "13:00"],
    sun: null,
  };

  it("collapses runs of identical hours into ranges", () => {
    expect(summariseHours(HOURS)).toBe("Mon–Fri 8AM–5PM · Sat 9AM–1PM");
  });

  it("prefixes service areas before the hours summary", () => {
    expect(contactHeroTagline("Brisbane & Gold Coast", HOURS)).toBe(
      "Brisbane & Gold Coast · Mon–Fri 8AM–5PM · Sat 9AM–1PM"
    );
  });

  it("falls back to hours-only when service areas is null", () => {
    expect(contactHeroTagline(null, HOURS)).toBe(
      "Mon–Fri 8AM–5PM · Sat 9AM–1PM"
    );
  });

  it("treats an empty / whitespace service-areas string as unset", () => {
    expect(contactHeroTagline("   ", HOURS)).toBe(
      "Mon–Fri 8AM–5PM · Sat 9AM–1PM"
    );
  });

  it("shows service areas alone when there are no opening hours", () => {
    expect(contactHeroTagline("Brisbane & Gold Coast", {})).toBe(
      "Brisbane & Gold Coast"
    );
  });
});
