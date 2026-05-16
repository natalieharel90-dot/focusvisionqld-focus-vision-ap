import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ContactCard } from "@/components/patient/ContactCard";
import {
  isAfterHours,
  visibleContactOptions,
  type ContactOption,
  type OpeningHours,
} from "@/lib/contact";

export const dynamic = "force-dynamic";

const WEEKDAYS: ReadonlyArray<[string, string]> = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
];

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h ?? 0;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

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

  const openingHours = (clinic?.opening_hours ?? {}) as OpeningHours;
  const afterHours = clinic
    ? isAfterHours(openingHours, new Date(), clinic.timezone)
    : false;

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          {clinic?.name ?? "Contact the clinic"}
        </h1>
        {clinic ? (
          <p className="mt-1 text-sm text-fv-text-secondary">
            {clinic.address}
          </p>
        ) : null}
      </header>

      {afterHours && clinic ? (
        <div className="rounded-2xl border border-fv-accent-warm bg-fv-bg-accent-soft p-4">
          <h2 className="text-sm font-semibold text-fv-text-primary">
            We&apos;re closed right now
          </h2>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Here&apos;s how to reach us after hours.
          </p>
          <a
            href={`tel:${clinic.after_hours_phone.replace(/[^\d+]/g, "")}`}
            className="mt-3 flex items-center justify-center gap-2 rounded-md bg-fv-accent-strong px-4 py-2.5 text-sm font-semibold text-white"
          >
            📞 {clinic.after_hours_label} · {clinic.after_hours_phone}
          </a>
          <p className="mt-2 text-xs text-fv-text-secondary">
            {clinic.after_hours_message}
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        {options.length === 0 ? (
          <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
            No contact options are configured.
          </div>
        ) : (
          options.map((option) => (
            <ContactCard key={option.id} option={option} />
          ))
        )}
      </section>

      {clinic ? (
        <section className="rounded-2xl bg-fv-bg-card p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Opening hours
          </h2>
          <dl className="mt-2 flex flex-col gap-1 text-sm">
            {WEEKDAYS.map(([key, label]) => {
              const day = openingHours[key];
              return (
                <div key={key} className="flex justify-between">
                  <dt className="text-fv-text-secondary">{label}</dt>
                  <dd className="text-fv-text-primary">
                    {day ? `${to12h(day[0])} – ${to12h(day[1])}` : "Closed"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
