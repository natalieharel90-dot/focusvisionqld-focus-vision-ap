import { describe, expect, it } from "vitest";

import {
  canDisableContactOption,
  expandMessageTemplate,
  filterContentItems,
  firstName,
  isValidContactActionValue,
  moveInOrder,
} from "./clinic-settings";

describe("expandMessageTemplate — {patient_first_name}", () => {
  it("expands the placeholder with the patient's first name", () => {
    expect(
      expandMessageTemplate("Hi {patient_first_name}, see you soon.", {
        patientFirstName: "Sarah",
      })
    ).toBe("Hi Sarah, see you soon.");
  });

  it("expands every occurrence", () => {
    expect(
      expandMessageTemplate(
        "{patient_first_name}, your drops — thanks {patient_first_name}.",
        { patientFirstName: "Jordan" }
      )
    ).toBe("Jordan, your drops — thanks Jordan.");
  });

  it("falls back to 'there' when no name is available", () => {
    expect(
      expandMessageTemplate("Hi {patient_first_name}.", {
        patientFirstName: null,
      })
    ).toBe("Hi there.");
  });

  it("firstName takes the first token", () => {
    expect(firstName("Sarah Mills")).toBe("Sarah");
    expect(firstName("  Jordan  ")).toBe("Jordan");
  });
});

describe("canDisableContactOption — the Call lock", () => {
  it("a required option (Call the clinic) cannot be disabled", () => {
    expect(canDisableContactOption({ is_required: true })).toBe(false);
  });

  it("a normal option can be disabled", () => {
    expect(canDisableContactOption({ is_required: false })).toBe(true);
  });
});

describe("isValidContactActionValue", () => {
  it.each<[string, string, boolean]>([
    ["call", "(07) 5555 0123", true],
    ["call", "not a phone", false],
    ["url", "https://focusvision.example/book", true],
    ["url", "focusvision.example", false],
    ["book", "https://book.example", true],
    ["message", "/messages", true],
    ["message", "messages", false],
    ["map", "123 Vision Way", true],
    ["custom", "", true],
  ])("%s / %s → %s", (type, value, expected) => {
    expect(isValidContactActionValue(type, value)).toBe(expected);
  });
});

describe("moveInOrder — reorder persistence", () => {
  const items = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
  ];

  it("moving an item up reassigns order_index correctly", () => {
    expect(moveInOrder(items, "c", "up")).toEqual([
      { id: "a", order_index: 0 },
      { id: "c", order_index: 1 },
      { id: "b", order_index: 2 },
      { id: "d", order_index: 3 },
    ]);
  });

  it("moving an item down reassigns order_index correctly", () => {
    expect(moveInOrder(items, "b", "down").map((x) => x.id)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
  });

  it("a no-op move (top item up) keeps a 0..n order_index sequence", () => {
    expect(moveInOrder(items, "a", "up")).toEqual([
      { id: "a", order_index: 0 },
      { id: "b", order_index: 1 },
      { id: "c", order_index: 2 },
      { id: "d", order_index: 3 },
    ]);
  });
});

describe("filterContentItems", () => {
  const items = [
    { id: "1", audience: "pre_op", procedures: ["lasik"], type: "article", active: true },
    { id: "2", audience: "post_op", procedures: ["lasik", "prk"], type: "video", active: true },
    { id: "3", audience: "both", procedures: [], type: "article", active: true },
    { id: "4", audience: "pre_op", procedures: ["lasik"], type: "video", active: false },
  ];

  it("returns active items by default", () => {
    expect(filterContentItems(items, {}).map((i) => i.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("filters by audience", () => {
    expect(
      filterContentItems(items, { audience: "pre_op" }).map((i) => i.id)
    ).toEqual(["1"]);
  });

  it("filters by procedure (membership)", () => {
    expect(
      filterContentItems(items, { procedure: "prk" }).map((i) => i.id)
    ).toEqual(["2"]);
  });

  it("filters by type", () => {
    expect(
      filterContentItems(items, { type: "video" }).map((i) => i.id)
    ).toEqual(["2"]);
  });

  it("can include inactive items", () => {
    expect(
      filterContentItems(items, { includeInactive: true }).map((i) => i.id)
    ).toEqual(["1", "2", "3", "4"]);
  });

  it("'all' is treated as no filter", () => {
    expect(
      filterContentItems(items, { audience: "all", type: "all" })
    ).toHaveLength(3);
  });
});
