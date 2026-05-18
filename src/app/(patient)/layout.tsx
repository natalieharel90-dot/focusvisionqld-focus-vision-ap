import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { ServiceWorkerRegister } from "@/components/patient/ServiceWorkerRegister";
import { LogoUnlockTrigger } from "@/components/LogoUnlockTrigger";
import { SparkleOverlay } from "@/components/SparkleOverlay";
import { BonusUnlockBridge } from "@/components/patient/BonusUnlockBridge";
import { unlockBonusPackAction } from "@/app/(patient)/bonus-actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildThemeCss,
  resolveThemePreference,
  shouldShowSparkle,
} from "@/lib/theme";
import { patientSignOutAction } from "@/app/patient-sign-in/actions";

export const dynamic = "force-dynamic";

// Makes the patient app an installable PWA — required for notifications,
// and on iOS web push only works once the app is added to the home screen.
export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Focus Vision" },
  icons: { apple: "/icon.svg" },
};

// Patient app shell. The theme is read from user_preferences and applied
// as data-theme / data-dark on the root container; the generated theme
// CSS is injected once here. No preferences ⇒ Calm medical, light mode.
export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { data: patient } = await supabase
    .from("patients")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  if (!patient) redirect("/");

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select(
      "theme, dark_mode, text_size, high_contrast, reduce_motion, sparkle, bonus_pack_unlocked"
    )
    .eq("patient_id", user.id)
    .maybeSingle();

  // 'random' resolves to a random bonus theme on every load.
  const { theme, dark } = resolveThemePreference(prefs);
  const showSparkle = shouldShowSparkle(
    prefs?.sparkle ?? false,
    prefs?.reduce_motion ?? false
  );

  return (
    <>
      {/* Theme CSS — all five [data-theme] palettes + dark overrides. */}
      <style dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
      <div
        id="fv-patient-root"
        data-theme={theme}
        data-dark={dark ? "" : undefined}
        data-text-size={prefs?.text_size ?? "normal"}
        data-contrast={prefs?.high_contrast ? "high" : undefined}
        data-motion={prefs?.reduce_motion ? "reduced" : undefined}
        className="min-h-screen bg-fv-bg-app pb-20"
      >
        <header className="bg-fv-bg-card">
          <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3 text-sm">
            <div className="flex items-center gap-2">
              <LogoUnlockTrigger
                action={unlockBonusPackAction}
                bridgeKey="fv_bonus_unlock"
              >
                <FocusVisionLogo size={28} />
              </LogoUnlockTrigger>
              <span className="font-semibold text-fv-text-primary">
                {patient.name}
              </span>
            </div>
            <form action={patientSignOutAction}>
              <button
                type="submit"
                className="text-xs font-medium text-fv-text-secondary hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="mx-auto max-w-md">{children}</div>

        <PatientBottomNav />
        <ServiceWorkerRegister />
        {showSparkle ? <SparkleOverlay /> : null}
        <BonusUnlockBridge
          alreadyUnlocked={prefs?.bonus_pack_unlocked ?? false}
        />
      </div>
    </>
  );
}
