import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FacilitiesTab } from "../clinic/FacilitiesTab";

export const dynamic = "force-dynamic";

// Settings → Day-surgery partners: the partner facilities roster.
export default async function PartnersSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: facilities } = await supabase
    .from("partner_facilities")
    .select("*")
    .order("active", { ascending: false })
    .order("name");

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}
      <FacilitiesTab facilities={facilities ?? []} canEdit />
    </main>
  );
}
