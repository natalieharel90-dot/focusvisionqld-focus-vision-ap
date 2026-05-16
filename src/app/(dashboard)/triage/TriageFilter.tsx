"use client";

import { useRouter } from "next/navigation";

const OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All flagged" },
  { value: "red", label: "Red · urgent" },
  { value: "orange", label: "Orange zone" },
  { value: "yellow", label: "Yellow zone" },
];

export function TriageFilter({ value }: { value: string }) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) =>
        router.push(
          e.target.value === "all"
            ? "/triage"
            : `/triage?filter=${e.target.value}`
        )
      }
      className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5 text-sm"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
