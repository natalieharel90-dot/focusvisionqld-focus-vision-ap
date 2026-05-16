import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ContactCard } from "@/components/patient/ContactCard";
import {
  contactHeroTagline,
  visibleContactOptions,
  type ContactOption,
  type OpeningHours,
} from "@/lib/contact";

export const dynamic = "force-dynamic";

export default async function PatientContactPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const [{ data: clinic }, { data: optionRows }] = await Promise.all([
    supabase.from("clinic_profile").select("*").limit(1).maybeSingle(),
    supabase.from("contact_options").select("*"),
  ]);

  const options = visibleContactOptions(
    (optionRows ?? []) as ContactOption[]
  );

  const tagline = clinic
    ? contactHeroTagline(
        clinic.service_areas,
        (clinic.opening_hours ?? {}) as OpeningHours
      )
    : "";

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      {/* Clinic hero */}
      <section className="rounded-2xl bg-gradient-to-br from-fv-accent to-fv-accent-strong p-5 text-white shadow-sm">
        <h1 className="text-2xl font-bold">
          {clinic?.name ?? "Contact the clinic"}
        </h1>
        {tagline ? (
          <p className="mt-1 text-sm text-white/85">{tagline}</p>
        ) : null}
      </section>

      {/* Contact options */}
      {options.length === 0 ? (
        <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No contact options are configured.
        </div>
      ) : (
        options.map((option) => (
          <ContactCard key={option.id} option={option} />
        ))
      )}

      {/* After-hours emergency notice */}
      {clinic ? (
        <div className="rounded-r-2xl rounded-bl-2xl border-l-4 border-red-400 bg-red-50 p-4 text-sm font-medium leading-relaxed text-red-700">
          After hours emergency? Call{" "}
          <a
            href={`tel:${clinic.after_hours_phone.replace(/[^\d+]/g, "")}`}
            className="font-bold underline"
          >
            {clinic.after_hours_phone}
          </a>
          . {clinic.after_hours_message}
        </div>
      ) : null}
    </main>
  );
}
