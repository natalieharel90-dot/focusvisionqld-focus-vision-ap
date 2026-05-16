"use client";

import { useRouter } from "next/navigation";

type Props = {
  value: string;
  threadId: string | null;
};

const OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All threads" },
  { value: "unread", label: "Unread" },
  { value: "mine", label: "Assigned to me" },
  { value: "resolved", label: "Resolved" },
];

// Navigates the inbox to the chosen filter, preserving the open thread.
export function InboxFilter({ value, threadId }: Props) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams();
        if (e.target.value !== "all") params.set("filter", e.target.value);
        if (threadId) params.set("thread", threadId);
        const qs = params.toString();
        router.push(qs ? `/inbox?${qs}` : "/inbox");
      }}
      className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1 text-xs"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
