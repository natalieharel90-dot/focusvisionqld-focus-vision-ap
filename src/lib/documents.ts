// Patient Documents screen (spec §5.6) — pure helpers for category
// grouping, file-type detection, view-time watermarking, and relative
// timestamps. No DB / React imports, so all of it is unit-testable.

export type DocumentKind = "pdf" | "image" | "other";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "heic",
  "bmp",
]);

// File kind from the filename extension — decides which viewer to use.
export function documentKind(filename: string): DocumentKind {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "other";
}

// Display order for document categories. Categories not listed here sort
// after these, alphabetically.
export const DOCUMENT_CATEGORY_ORDER: ReadonlyArray<string> = [
  "Consent forms",
  "Pre-op instructions",
  "Discharge summary",
  "Surgical report",
  "Post-op care plan",
  "Recovery photos",
  "Videos from your surgeon",
  "Receipts",
  "Personal",
];

export type CategoryGroup<T> = { category: string; documents: T[] };

// Groups documents by category and returns the groups in display order.
export function groupDocumentsByCategory<T extends { category: string }>(
  docs: ReadonlyArray<T>
): CategoryGroup<T>[] {
  const byCategory = new Map<string, T[]>();
  for (const doc of docs) {
    const list = byCategory.get(doc.category) ?? [];
    list.push(doc);
    byCategory.set(doc.category, list);
  }

  const rank = (category: string): number => {
    const index = DOCUMENT_CATEGORY_ORDER.indexOf(category);
    return index === -1 ? DOCUMENT_CATEGORY_ORDER.length : index;
  };

  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, documents]) => ({ category, documents }));
}

// View-time watermark text: patient name + the view date, e.g.
// "Jane Smith · 15 May 2026".
export function watermarkLabel(
  patientName: string,
  date: Date | string | number = Date.now()
): string {
  const formatted = new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${patientName} · ${formatted}`;
}

// Relative timestamp, e.g. "3 days ago". The Documents list prepends
// "uploaded ".
export function relativeTime(
  iso: string,
  now: Date | string | number = Date.now()
): string {
  const diffMs = new Date(now).getTime() - new Date(iso).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// Check-in history (the virtual "Check-in history" category) — newest first.
export function sortCheckInsNewestFirst<T extends { created_at: string }>(
  checkIns: ReadonlyArray<T>
): T[] {
  return [...checkIns].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
