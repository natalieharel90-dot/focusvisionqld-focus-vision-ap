"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { LogoUnlockTrigger } from "@/components/LogoUnlockTrigger";
import { unlockStaffBonusPackAction } from "@/app/(dashboard)/theme-actions";

type IconKey =
  | "home"
  | "patients"
  | "newpatients"
  | "procedures"
  | "messages"
  | "triage"
  | "analytics"
  | "reports"
  | "feedback"
  | "bulkpush"
  | "settings"
  | "audit";

type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  tier1Only?: boolean;
  tier12Only?: boolean;
  analyticsOnly?: boolean;
};

// Feather-style line icons, lifted to match the prototype's dash sidebar.
const ICON_PATHS: Record<IconKey, string> = {
  home: '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 22V12h6v10"/>',
  patients:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  newpatients:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  procedures:
    '<path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
  messages:
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  triage:
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  analytics:
    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  feedback:
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bulkpush: '<path d="M3 11 21 3l-8 18-2-8-8-2z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  audit:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
  reports:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 18v-4"/><path d="M12 18v-7"/><path d="M16 18v-2"/>',
};

// Order follows the prototype's dash sidebar. Schedule / Alerts / Reports
// from the prototype are omitted — no routes exist for them.
const NAV: ReadonlyArray<NavItem> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/patients", label: "Patients", icon: "patients" },
  { href: "/new-patients", label: "New patients", icon: "newpatients" },
  { href: "/procedures", label: "Procedures", icon: "procedures" },
  { href: "/inbox", label: "Messages", icon: "messages" },
  { href: "/triage", label: "Triage", icon: "triage" },
  { href: "/analytics", label: "Analytics", icon: "analytics", analyticsOnly: true },
  { href: "/reports", label: "Reports", icon: "reports", tier12Only: true },
  { href: "/reviews", label: "Feedback", icon: "feedback" },
  { href: "/bulk-push", label: "Bulk push", icon: "bulkpush" },
  { href: "/audit", label: "Audit log", icon: "audit", tier1Only: true },
  { href: "/settings", label: "Settings", icon: "settings" },
];

// Badge pill colours, matching the prototype's dash sidebar.
const BADGE_COLOR: Record<string, string> = {
  "/new-patients": "#D8A82A",
  "/inbox": "#D04A3A",
  "/triage": "#D67E3B",
  "/reviews": "#4FA38A",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ icon }: { icon: IconKey }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[icon] }}
    />
  );
}

// Fixed dark-green chrome (matches the prototype's dash sidebar). The
// theme picker still themes the main content area to its right.
export function Sidebar({
  staffName,
  staffRole,
  accessTier,
  navBadges,
}: {
  staffName: string;
  staffRole: string;
  accessTier: number;
  navBadges: Record<string, number>;
}) {
  const pathname = usePathname();
  const canViewAnalytics = accessTier === 1 || staffRole === "surgeon";
  const visibleNav = NAV.filter((item) => {
    if (item.tier1Only && accessTier !== 1) return false;
    if (item.tier12Only && accessTier !== 1 && accessTier !== 2) return false;
    if (item.analyticsOnly && !canViewAnalytics) return false;
    return true;
  });

  return (
    <aside className="fv-dash-sidebar flex w-60 shrink-0 flex-col text-white">
      <div className="flex flex-col items-start gap-1.5 px-[18px] pb-6 pt-6">
        <LogoUnlockTrigger action={unlockStaffBonusPackAction}>
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white p-0.5">
            <FocusVisionLogo size={66} />
          </span>
        </LogoUnlockTrigger>
        <span className="mt-1 text-[11px] text-white/65">
          Clinical staff portal
        </span>
      </div>

      <nav className="flex-1 px-[14px]">
        <ul className="flex flex-col gap-1">
          {visibleNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold ${
                    active
                      ? "bg-white/[.12] text-white"
                      : "text-white/70 hover:bg-white/[.06] hover:text-white"
                  }`}
                >
                  <NavIcon icon={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {navBadges[item.href] ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: BADGE_COLOR[item.href] ?? "#D04A3A" }}
                    >
                      {navBadges[item.href]}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="m-3 rounded-xl bg-black/15 p-3 text-xs">
        <div className="font-semibold text-white">{staffName}</div>
        <div className="capitalize text-white/55">{staffRole}</div>
      </div>
    </aside>
  );
}
