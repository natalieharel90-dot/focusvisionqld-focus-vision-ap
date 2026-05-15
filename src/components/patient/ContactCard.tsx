"use client";

import Link from "next/link";

import type { ContactOption } from "@/lib/contact";
import { logContactCallTapAction } from "@/app/(patient)/contact/actions";

const ICON: Record<string, string> = {
  phone: "📞",
  message: "💬",
  calendar: "📅",
  map: "📍",
  clock: "🕐",
  link: "🔗",
};

// One tappable Contact-screen row. The element rendered depends on the
// action type; only call taps are audit-logged.
export function ContactCard({ option }: { option: ContactOption }) {
  const icon = ICON[option.icon] ?? "📞";
  const value = option.action_value ?? "";

  const inner = (
    <>
      <span aria-hidden className="text-xl">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fv-text-primary">
          {option.label}
        </span>
        {option.subtitle ? (
          <span className="block truncate text-xs text-fv-text-secondary">
            {option.subtitle}
          </span>
        ) : null}
      </span>
      {option.action_type !== "custom" ? (
        <span aria-hidden className="text-fv-text-secondary">
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
