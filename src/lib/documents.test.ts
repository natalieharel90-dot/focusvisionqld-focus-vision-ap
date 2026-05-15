import { describe, expect, it } from "vitest";

import {
  DOCUMENT_CATEGORY_ORDER,
  documentKind,
  groupDocumentsByCategory,
  relativeTime,
  sortCheckInsNewestFirst,
  watermarkLabel,
} from "./documents";

describe("documentKind", () => {
  it.each<[string, "pdf" | "image" | "other"]>([
    ["consent.pdf", "pdf"],
    ["scan.PDF", "pdf"],
    ["eye.jpg", "image"],
    ["eye.jpeg", "image"],
    ["photo.PNG", "image"],
    ["report.docx", "other"],
    ["notes.txt", "other"],
    ["noextension", "other"],
  ])("%s → %s", (filename, expected) => {
    expect(documentKind(filename)).toBe(expected);
  });
});

describe("groupDocumentsByCategory — display order", () => {
  it("orders known categories per DOCUMENT_CATEGORY_ORDER", () => {
    const docs = [
      { id: "1", category: "Receipts" },
      { id: "2", category: "Consent forms" },
      { id: "3", category: "Surgical report" },
      { id: "4", category: "Pre-op instructions" },
    ];
    expect(groupDocumentsByCategory(docs).map((g) => g.category)).toEqual([
      "Consent forms",
      "Pre-op instructions",
      "Surgical report",
      "Receipts",
    ]);
  });

  it("places unknown categories last, alphabetically", () => {
    const docs = [
      { id: "1", category: "Zebra notes" },
      { id: "2", category: "Receipts" },
      { id: "3", category: "Aardvark notes" },
    ];
    expect(groupDocumentsByCategory(docs).map((g) => g.category)).toEqual([
      "Receipts",
      "Aardvark notes",
      "Zebra notes",
    ]);
  });

  it("keeps every document within its category group", () => {
    const docs = [
      { id: "a", category: "Receipts" },
      { id: "b", category: "Receipts" },
      { id: "c", category: "Consent forms" },
    ];
    const groups = groupDocumentsByCategory(docs);
    expect(groups[0]!.category).toBe("Consent forms");
    expect(groups[1]!.documents.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("DOCUMENT_CATEGORY_ORDER leads with the clinical categories", () => {
    expect(DOCUMENT_CATEGORY_ORDER[0]).toBe("Consent forms");
  });
});

describe("watermarkLabel", () => {
  it("combines patient name and the view date", () => {
    expect(watermarkLabel("Jane Smith", new Date(2026, 4, 15))).toBe(
      "Jane Smith · 15 May 2026"
    );
  });
});

describe("relativeTime", () => {
  const NOW = new Date("2026-05-15T12:00:00Z");
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it.each<[string, string]>([
    [ago(30 * 1000), "just now"],
    [ago(1 * MIN), "1 minute ago"],
    [ago(5 * MIN), "5 minutes ago"],
    [ago(3 * HOUR), "3 hours ago"],
    [ago(1 * DAY), "1 day ago"],
    [ago(3 * DAY), "3 days ago"],
    [ago(14 * DAY), "2 weeks ago"],
    [ago(60 * DAY), "2 months ago"],
    [ago(400 * DAY), "1 year ago"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(iso, NOW)).toBe(expected);
  });
});

describe("sortCheckInsNewestFirst", () => {
  it("orders check-ins newest first", () => {
    const checkIns = [
      { id: "old", created_at: "2026-05-10T08:00:00Z" },
      { id: "new", created_at: "2026-05-14T08:00:00Z" },
      { id: "mid", created_at: "2026-05-12T08:00:00Z" },
    ];
    expect(sortCheckInsNewestFirst(checkIns).map((c) => c.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("does not mutate the input array", () => {
    const checkIns = [
      { id: "a", created_at: "2026-05-10T08:00:00Z" },
      { id: "b", created_at: "2026-05-14T08:00:00Z" },
    ];
    sortCheckInsNewestFirst(checkIns);
    expect(checkIns.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
