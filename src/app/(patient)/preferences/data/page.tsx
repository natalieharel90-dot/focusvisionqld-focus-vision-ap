import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const INCLUDED = [
  "Your profile and procedure details",
  "Every daily check-in you've completed",
  "Your medications and dose history",
  "Appointments",
  "The documents your clinic has shared with you",
  "Feedback you've sent",
  "Your app preferences",
];

export default async function DownloadDataPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link
        href="/preferences"
        className="text-sm font-semibold text-fv-text-secondary"
      >
        ‹ Settings
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          Download my data
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Export a copy of everything you've shared
        </p>
      </header>

      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-fv-text-primary">
          What's included
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {INCLUDED.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 text-sm text-fv-text-primary"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fv-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-fv-text-secondary">
          Your export is a JSON file. Photo and document files themselves
          aren&apos;t included — only their details. Save it somewhere safe;
          it contains your personal health information.
        </p>
      </section>

      <a
        href="/api/me/export"
        download="focus-vision-my-data.json"
        className="rounded-2xl bg-fv-accent-strong px-4 py-4 text-center text-base font-bold text-white hover:opacity-95"
      >
        Download my data
      </a>
    </main>
  );
}
