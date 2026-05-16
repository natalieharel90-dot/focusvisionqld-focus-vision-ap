"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/settings/clinic", label: "Clinic & Doctors" },
  { href: "/settings/contact", label: "Contact screen" },
  { href: "/settings/recovery-guidance", label: "Recovery guidance" },
  { href: "/settings/patient-features", label: "Patient app features" },
  { href: "/settings/symptoms", label: "Standard symptoms" },
  { href: "/settings/alert-thresholds", label: "Alert thresholds" },
  { href: "/settings/partners", label: "Day-surgery partners" },
  { href: "/settings/appearance", label: "Appearance" },
];

// A single connected segmented control — all tabs joined on one line.
export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex w-full overflow-x-auto rounded-xl border border-fv-border">
      {TABS.map((t, i) => {
        let active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        // Alert actions is folded under the Alert thresholds tab.
        if (
          t.href === "/settings/alert-thresholds" &&
          pathname.startsWith("/settings/alert-actions")
        ) {
          active = true;
        }
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 whitespace-nowrap px-2 py-2.5 text-center text-[11px] font-semibold ${
              i > 0 ? "border-l border-fv-border" : ""
            } ${
              active
                ? "bg-fv-accent-strong text-white"
                : "bg-fv-bg-card text-fv-text-secondary hover:bg-fv-bg-soft"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
