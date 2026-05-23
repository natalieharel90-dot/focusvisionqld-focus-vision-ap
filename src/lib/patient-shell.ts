// Patient app shell metadata — bottom-nav tabs and home tiles. Pure data
// + helpers so the nav/tile structure is unit-testable.
//
// Note: the patient Settings screen lives at /preferences, not /settings
// — /settings is the staff dashboard's Settings route and two route
// groups can't resolve to the same URL.

export type NavIconName = "home" | "check" | "pill" | "message" | "gear";

export type PatientTab = {
  href: string;
  label: string;
  icon: NavIconName;
};

export const PATIENT_TABS: ReadonlyArray<PatientTab> = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/check-in", label: "Check-in", icon: "check" },
  { href: "/medications", label: "Meds", icon: "pill" },
  { href: "/messages", label: "Messages", icon: "message" },
  { href: "/preferences", label: "Settings", icon: "gear" },
];

export function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type HomeTile = {
  key: string;
  title: string;
  icon: string;
  // null ⇒ the screen isn't built yet (rendered as a "coming soon" tile).
  href: string | null;
};

// Snapshot of the home tiles that ALWAYS render (the live home page
// also conditionally adds Feedback when the feature flag is on). The
// real /home page builds its tiles inline; this constant exists for
// the patient-shell tests and for any future reuse.
export const HOME_TILES: ReadonlyArray<HomeTile> = [
  { key: "check-in", title: "Daily check-in", icon: "✓", href: "/check-in" },
  { key: "medications", title: "Medications", icon: "💊", href: "/medications" },
  { key: "messages", title: "Messages", icon: "💬", href: "/messages" },
  { key: "videos", title: "Videos & info", icon: "🎬", href: "/videos" },
  { key: "contact", title: "Contact clinic", icon: "📞", href: "/contact" },
  { key: "settings", title: "Settings", icon: "⚙️", href: "/preferences" },
];
