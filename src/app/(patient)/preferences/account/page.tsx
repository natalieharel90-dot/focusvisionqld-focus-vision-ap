import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { password?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { data: patient } = await supabase
    .from("patients")
    .select("first_name, last_name, email, phone, date_of_birth")
    .eq("id", user.id)
    .maybeSingle();

  const name =
    [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "—";
  const dob = patient?.date_of_birth
    ? new Date(`${patient.date_of_birth}T00:00:00`).toLocaleDateString(
        "en-AU",
        { day: "numeric", month: "long", year: "numeric" }
      )
    : "—";

  const rows: ReadonlyArray<[string, string]> = [
    ["Name", name],
    ["Email", patient?.email ?? "—"],
    ["Phone", patient?.phone ?? "—"],
    ["Date of birth", dob],
  ];

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link
        href="/preferences"
        className="text-sm font-semibold text-fv-text-secondary"
      >
        ‹ Settings
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">Account</h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Your details on file with Focus Vision
        </p>
      </header>

      {searchParams.password === "updated" ? (
        <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">
          Your password has been updated.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-fv-bg-card shadow-sm">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-4 px-4 py-3.5 ${
              i > 0 ? "border-t border-fv-bg-soft" : ""
            }`}
          >
            <span className="shrink-0 text-sm text-fv-text-secondary">
              {label}
            </span>
            <span className="min-w-0 break-words text-right font-medium text-fv-text-primary">
              {value}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/preferences/account/password"
        className="flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fv-bg-soft text-fv-accent-strong">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-fv-text-primary">
            Set your own password
          </div>
          <div className="text-xs text-fv-text-secondary">
            Replace the temporary password from your welcome message
          </div>
        </div>
        <span aria-hidden className="text-fv-text-secondary">
          ›
        </span>
      </Link>

      <div className="flex items-start gap-3 rounded-2xl bg-fv-bg-soft/70 p-4 text-sm text-fv-text-secondary">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-5 w-5 shrink-0 text-fv-accent-strong"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="leading-relaxed">
          To change any of these details,{" "}
          <Link
            href="/messages"
            className="font-semibold text-fv-text-primary underline"
          >
            message your care team
          </Link>
          . We keep your contact details verified for your safety.
        </p>
      </div>
    </main>
  );
}
