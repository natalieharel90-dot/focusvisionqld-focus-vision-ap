import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadPatientFeatures } from "@/lib/patient-features-server";
import { FeedbackForm } from "./FeedbackForm";

export const dynamic = "force-dynamic";

export default async function PatientFeedbackPage({
  searchParams,
}: {
  searchParams: { done?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  // The Feedback tile/route is gated by the feedback_tile feature flag.
  const features = await loadPatientFeatures(supabase, user.id);
  if (!features.feedback_tile) redirect("/home");

  // The day hospital the patient's procedure was performed at — names the
  // "Day Hospital" feedback blurb.
  const { data: procedure } = await supabase
    .from("procedures")
    .select("facility_id")
    .eq("patient_id", user.id)
    .eq("status", "active")
    .order("surgery_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let facilityName: string | null = null;
  if (procedure?.facility_id) {
    const { data: facility } = await supabase
      .from("partner_facilities")
      .select("name")
      .eq("id", procedure.facility_id)
      .maybeSingle();
    facilityName = facility?.name ?? null;
  }

  if (searchParams.done) {
    return (
      <main className="flex flex-col gap-4 px-5 py-6">
        <section className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-fv-accent to-fv-accent-strong px-5 py-9 text-center text-white shadow-sm">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h1 className="mt-4 text-2xl font-bold">
            Thank you for your feedback
          </h1>
          <p className="mt-1.5 text-sm text-white/85">
            Our practice manager reads every response.
          </p>
        </section>

        <p className="text-center text-sm text-fv-text-secondary">
          We&apos;ll only get in touch if you asked us to.
        </p>

        <Link
          href="/home"
          className="rounded-2xl bg-fv-accent-strong px-4 py-4 text-center text-base font-bold text-white hover:opacity-95"
        >
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          Leave feedback
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Help us improve your care. Your feedback is read by our practice
          manager.
        </p>
      </header>

      <FeedbackForm facilityName={facilityName} />
    </main>
  );
}
