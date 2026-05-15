"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { LogoUnlockTrigger } from "@/components/LogoUnlockTrigger";
import { StaffThemePicker } from "@/components/dashboard/StaffThemePicker";
import { unlockStaffBonusPackAction } from "@/app/(dashboard)/theme-actions";
import type { ThemePreference } from "@/lib/theme";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  tier1Only?: boolean;
  analyticsOnly?: boolean;
};

// Order: Procedures sits between Patients and Messages; Analytics +
// Audit come after Settings, both role-gated.
const NAV: ReadonlyArray<NavItem> = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/patients", label: "Patients", icon: "👥" },
  { href: "/new-patients", label: "New patients", icon: "🆕" },
  { href: "/procedures", label: "Procedures", icon: "📋" },
  { href: "/inbox", label: "Messages", icon: "💬" },
  { href: "/bulk-push", label: "Bulk push", icon: "📣" },
  { href: "/triage", label: "Triage", icon: "🚩" },
  { href: "/reviews", label: "Feedback", icon: "⭐" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/analytics", label: "Analytics", icon: "📊", analyticsOnly: true },
  { href: "/audit", label: "Audit log", icon: "🗂️", tier1Only: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  staffName,
  staffRole,
  accessTier,
  themePreference,
  dark,
  sparkle,
  bonusUnlocked,
}: {
  staffName: string;
  staffRole: string;
  accessTier: number;
  themePreference: ThemePreference;
  dark: boolean;
  sparkle: boolean;
  bonusUnlocked: boolean;
}) {
  const pathname = usePathname();
  // Analytics: tier-1 or surgeons. Audit: tier-1 only.
  const canViewAnalytics = accessTier === 1 || staffRole === "surgeon";
  const visibleNav = NAV.filter((item) => {
    if (item.tier1Only && accessTier !== 1) return false;
    if (item.analyticsOnly && !canViewAnalytics) return false;
    return true;
  });

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-fv-bg-soft bg-fv-bg-card">
      <div className="flex items-center gap-2 border-b border-fv-bg-soft px-4 py-4">
        <LogoUnlockTrigger action={unlockStaffBonusPackAction}>
          <FocusVisionLogo size={32} />
        </LogoUnlockTrigger>
        <span className="text-sm font-semibold text-fv-text-primary">
          Staff dashboard
        </span>
      </div>

      <nav className="flex-1 px-2 py-3">
        {visibleNav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-fv-bg-accent-soft text-fv-accent-strong"
                  : "text-fv-text-primary hover:bg-fv-bg-soft"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-fv-bg-soft px-4 py-3">
        <StaffThemePicker
          initialTheme={themePreference}
          initialDark={dark}
          initialSparkle={sparkle}
          bonusUnlocked={bonusUnlocked}
        />
        <div className="mt-3 text-xs">
          <div className="font-medium text-fv-text-primary">{staffName}</div>
          <div className="capitalize text-fv-text-secondary">{staffRole}</div>
        </div>
      </div>
    </aside>
  );
}
