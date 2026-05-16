"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavBadges = { messages: number; triage: number };

type TabKey = "today" | "messages" | "triage" | "patients" | "me";

const TABS: ReadonlyArray<{ key: TabKey; label: string; href: string }> = [
  { key: "today", label: "Today", href: "/staff-app/today" },
  { key: "messages", label: "Messages", href: "/staff-app/messages" },
  { key: "triage", label: "Triage", href: "/staff-app/triage" },
  { key: "patients", label: "Patients", href: "/staff-app/patients" },
  { key: "me", label: "Me", href: "/staff-app/me" },
];

function useActiveKey(): TabKey {
  const pathname = usePathname();
  const match = TABS.find((t) => pathname.startsWith(t.href));
  return match?.key ?? "today";
}

// The connected text tab strip under the header.
export function TopTabs() {
  const active = useActiveKey();
  return (
    <nav className="flex border-b border-fv-bg-soft bg-fv-bg-card">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`flex-1 whitespace-nowrap border-b-2 px-1 py-3 text-center text-[13px] font-semibold ${
            active === t.key
              ? "border-fv-accent-strong text-fv-text-primary"
              : "border-transparent text-fv-text-secondary"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function Icon({ name }: { name: TabKey }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
  };
  switch (name) {
    case "today":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "messages":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
        </svg>
      );
    case "triage":
      return (
        <svg {...common}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "patients":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
        </svg>
      );
    case "me":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6.5 19a6 6 0 0 1 11 0" />
        </svg>
      );
  }
}

// The fixed bottom navigation bar.
export function BottomNav({ badges }: { badges: NavBadges }) {
  const active = useActiveKey();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-fv-bg-soft bg-fv-bg-card">
      {TABS.map((t) => {
        const badge =
          t.key === "messages"
            ? badges.messages
            : t.key === "triage"
              ? badges.triage
              : 0;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
              active === t.key
                ? "text-fv-accent-strong"
                : "text-fv-text-secondary"
            }`}
          >
            <span className="relative">
              <Icon name={t.key} />
              {badge > 0 ? (
                <span
                  className={`absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${
                    t.key === "triage" ? "bg-orange-500" : "bg-red-600"
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
