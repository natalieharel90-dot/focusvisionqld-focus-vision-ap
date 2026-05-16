import { SettingsTabs } from "./SettingsTabs";

// Shared chrome for every Settings tab: the page title and the tab strip.
// Each tab route renders its own panel content below.
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pb-1 pt-8">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Settings
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Clinic details, doctors, recovery guidance, alert thresholds and
          dashboard appearance.
        </p>
        <div className="mt-4">
          <SettingsTabs />
        </div>
      </div>
      {children}
    </>
  );
}
