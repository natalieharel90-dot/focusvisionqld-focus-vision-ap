"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PATIENT_TABS, isTabActive } from "@/lib/patient-shell";

// Reusable bottom nav for the patient app. Active tab highlighted with
// theme tokens (fv-accent-strong vs fv-text-secondary).
export function PatientBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-fv-border bg-fv-bg-card">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {PATIENT_TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium ${
                active
                  ? "text-fv-accent-strong"
                  : "text-fv-text-secondary"
              }`}
            >
              <span aria-hidden className="text-base">
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
