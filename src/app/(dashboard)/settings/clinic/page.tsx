import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ClinicProfileTab } from "./ClinicProfileTab";
import { DoctorsTab } from "./DoctorsTab";

export const dynamic = "force-dynamic";

// Settings → Clinic & Doctors: clinic details + the doctor roster.
export default async function ClinicSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [profileRes, doctorsRes] = await Promise.all([
    supabase.from("clinic_profile").select("*").limit(1).maybeSingle(),
    supabase
      .from("doctors")
      .select("*")
      .order("active", { ascending: false })
      .order("name"),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-6">
        <ClinicProfileTab profile={profileRes.data} canEdit />
        <DoctorsTab doctors={doctorsRes.data ?? []} canEdit />
      </div>
    </main>
  );
}
