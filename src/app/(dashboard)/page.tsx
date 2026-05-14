import Link from "next/link";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";

export default function StaffDashboardHomePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <FocusVisionLogo size={140} />
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-fv-text-primary">
          Focus Vision Staff Dashboard
        </h1>
        <p className="mt-2 text-sm text-fv-text-secondary">
          Recovery Companion · clinical staff workspace
        </p>
      </div>

      <nav className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/patients"
          className="rounded-xl bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-base font-semibold text-fv-text-primary">
            Patients
          </div>
          <div className="text-xs text-fv-text-secondary">
            Active recoveries · check-in zones
          </div>
        </Link>
        <Link
          href="/inbox"
          className="rounded-xl bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-base font-semibold text-fv-text-primary">
            Inbox
          </div>
          <div className="text-xs text-fv-text-secondary">
            Patient threads · shared by the whole team
          </div>
        </Link>
        <Link
          href="/triage"
          className="rounded-xl bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-base font-semibold text-fv-text-primary">
            Triage queue
          </div>
          <div className="text-xs text-fv-text-secondary">
            Open flags · Red / Orange / Yellow
          </div>
        </Link>
        <Link
          href="/settings"
          className="rounded-xl bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-base font-semibold text-fv-text-primary">
            Settings
          </div>
          <div className="text-xs text-fv-text-secondary">
            Alert thresholds · alert actions · symptoms
          </div>
        </Link>
      </nav>
    </main>
  );
}
