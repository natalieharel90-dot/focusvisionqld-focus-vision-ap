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

  if (searchParams.done) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div aria-hidden className="text-5xl">
          💚
        </div>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Thank you
        </h1>
        <p className="max-w-sm text-sm text-fv-text-secondary">
          Your feedback helps us improve. We read every response — and we&apos;ll
          only get in touch if you asked us to.
        </p>
        <Link
          href="/home"
          className="mt-2 rounded-md bg-fv-accent-strong px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Share your feedback
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Tell us how things went. Rate any of the areas below — you can skip
          the ones that don&apos;t apply.
        </p>
      </header>

      <FeedbackForm />
    </main>
  );
}
