import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { patientSignOutAction } from "@/app/patient-sign-in/actions";

export const dynamic = "force-dynamic";

// Patient app chrome. `data-theme="calm"` is the default; future theme
// switching will mutate this attribute and the CSS custom properties on
// it. Bottom nav is the primary navigation surface on mobile.
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
  // If signed in but not a patient (e.g. a staff member browsed here),
  // just send them back to the staff dashboard without touching their
  // session. Only the patient-sign-in flow itself signs out non-patients.
  if (!patient) {
    redirect("/");
  }

  return (
    <div data-theme="calm" className="min-h-screen bg-fv-bg-app pb-20">
      <header className="bg-fv-bg-card">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3 text-sm">
          <span className="font-semibold text-fv-text-primary">
            {patient.name}
          </span>
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

      {/* Bottom nav. More tabs land as their pages are built. */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-fv-bg-soft bg-fv-bg-card">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          <Link
            href="/home"
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-fv-text-secondary"
          >
            <span aria-hidden className="text-base">🏠</span>
            Home
          </Link>
          <Link
            href="/medications"
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-fv-text-secondary"
          >
            <span aria-hidden className="text-base">💊</span>
            Meds
          </Link>
          <Link
            href="/check-in"
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-fv-text-secondary"
          >
            <span aria-hidden className="text-base">✓</span>
            Check-in
          </Link>
          <Link
            href="/messages"
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-fv-text-secondary"
          >
            <span aria-hidden className="text-base">💬</span>
            Messages
          </Link>
        </div>
      </nav>
    </div>
  );
}
