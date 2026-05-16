"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { ContactOption } from "@/lib/contact";
import { logContactCallTapAction } from "@/app/(patient)/contact/actions";

type IconName = "phone" | "message" | "calendar" | "map" | "clock" | "link";

function CardIcon({ name }: { name: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
  };
  const paths: Record<IconName, ReactNode> = {
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    message: (
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    map: (
      <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
      </>
    ),
  };
  const key = (name in paths ? name : "phone") as IconName;
  return <svg {...props}>{paths[key]}</svg>;
}

// One tappable Contact-screen row. The element rendered depends on the
// action type; only call taps are audit-logged.
export function ContactCard({ option }: { option: ContactOption }) {
  const value = option.action_value ?? "";

  const inner = (
    <>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-fv-bg-accent-soft text-fv-accent-strong">
        <CardIcon name={option.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-fv-text-primary">
          {option.label}
        </span>
        {option.subtitle ? (
          <span className="block text-sm text-fv-text-secondary">
            {option.subtitle}
          </span>
        ) : null}
      </span>
      {option.action_type !== "custom" ? (
        <span aria-hidden className="shrink-0 text-lg text-fv-text-secondary">
          ›
        </span>
      ) : null}
    </>
  );

  const rowClass =
    "flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm";
  const tappableClass = `${rowClass} hover:bg-fv-bg-soft`;

  if (option.action_type === "call") {
    return (
      <a
        href={`tel:${value.replace(/[^\d+]/g, "")}`}
        onClick={() => {
          void logContactCallTapAction(option.id);
        }}
        className={tappableClass}
      >
        {inner}
      </a>
    );
  }

  if (option.action_type === "message") {
    return (
      <Link href={value || "/messages"} className={tappableClass}>
        {inner}
      </Link>
    );
  }

  if (
    option.action_type === "book" ||
    option.action_type === "map" ||
    option.action_type === "url"
  ) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className={tappableClass}
      >
        {inner}
      </a>
    );
  }

  // custom — informational only, no action.
  return <div className={rowClass}>{inner}</div>;
}
