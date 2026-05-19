"use client";

import { useEffect, useState, type ReactNode } from "react";

// Tiny client island that wraps the Staff list and toggles a CSS class
// for "hide deactivated staff". The class is applied to the wrapper;
// CSS in globals.css hides any child with data-staff-active="false".
// Preference persists in localStorage (per browser).
export function HideInactiveStaffToggle({
  inactiveCount,
  children,
}: {
  inactiveCount: number;
  children: ReactNode;
}) {
  const [hide, setHide] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHide(localStorage.getItem("fv_hide_inactive_staff") === "1");
    setHydrated(true);
  }, []);

  function onChange(next: boolean) {
    setHide(next);
    localStorage.setItem("fv_hide_inactive_staff", next ? "1" : "0");
  }

  if (inactiveCount === 0) return <>{children}</>;

  return (
    <div className={hide ? "fv-hide-inactive-staff" : undefined}>
      <label className="mt-2 flex cursor-pointer items-center justify-end gap-2 text-xs font-medium text-fv-text-secondary">
        <input
          type="checkbox"
          checked={hide}
          onChange={(e) => onChange(e.target.checked)}
          disabled={!hydrated}
          className="h-4 w-4 accent-fv-accent-strong"
        />
        Hide deactivated staff ({inactiveCount})
      </label>
      {children}
    </div>
  );
}
