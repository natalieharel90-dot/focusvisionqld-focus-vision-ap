import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

// Full-size viewer for one of the patient's own check-in eye photos.
export default async function PatientPhotoPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { data: photo } = await supabase
    .from("eye_photos")
    .select("id, recovery_day, captured_at, storage_path, patient_id")
    .eq("id", params.id)
    .maybeSingle();

  // RLS already limits this to the patient's own photos; this is a
  // friendly fallback rather than a raw error.
  if (!photo || photo.patient_id !== user.id) {
    return (
      <main className="flex flex-col gap-4 px-5 py-6">
        <Link href="/documents" className="text-sm text-fv-accent-strong">
          ‹ Back to documents
        </Link>
        <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          This photo isn&apos;t available.
        </div>
      </main>
    );
  }

  const { data: signed } = await supabase.storage
    .from("patient-photos")
    .createSignedUrl(photo.storage_path, SIGNED_URL_TTL_SECONDS);

  const captured = new Date(photo.captured_at).toLocaleString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link href="/documents" className="text-sm text-fv-accent-strong">
        ‹ Back to documents
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-fv-text-primary">
          {photo.recovery_day != null
            ? `Day ${photo.recovery_day} — eye photo`
            : "Eye photo"}
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">Taken {captured}</p>
      </header>

      {signed?.signedUrl ? (
        <div className="overflow-hidden rounded-2xl bg-fv-bg-card shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signed.signedUrl}
            alt={`Eye photo${
              photo.recovery_day != null
                ? ` from day ${photo.recovery_day}`
                : ""
            }`}
            className="w-full"
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          This photo couldn&apos;t be loaded. Please try again or contact the
          clinic.
        </div>
      )}
    </main>
  );
}
