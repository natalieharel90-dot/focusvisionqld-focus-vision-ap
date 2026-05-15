import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ClinicProfileTab } from "./ClinicProfileTab";
import { DoctorsTab } from "./DoctorsTab";
import { FacilitiesTab } from "./FacilitiesTab";
import { TemplatesTab } from "./TemplatesTab";
import { ContactOptionsTab } from "./ContactOptionsTab";
import { ContentTab } from "./ContentTab";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "profile", label: "Clinic profile" },
  { key: "doctors", label: "Doctors" },
  { key: "facilities", label: "Partner facilities" },
  { key: "templates", label: "Message templates" },
  { key: "contact", label: "Contact options" },
  { key: "content", label: "Content library" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ClinicSettingsPage({
  searchParams,
}: {
  searchParams: {
    tab?: string;
    error?: string;
    audience?: string;
    procedure?: string;
    type?: string;
  };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Clinic & Doctors settings are open to all staff.
  const canEdit = true;
  const tab: TabKey = (TABS.find((t) => t.key === searchParams.tab)?.key ??
    "profile") as TabKey;

  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium ${
      active
        ? "border-b-2 border-fv-accent-strong text-fv-accent-strong"
        : "text-fv-text-secondary hover:text-fv-text-primary"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/settings"
        className="text-xs font-semibold text-fv-text-secondary hover:underline"
      >
        ← Settings
      </Link>
      <h1 className="mb-1 mt-1 text-2xl font-semibold text-fv-text-primary">
        Clinic &amp; Doctors
      </h1>

      {searchParams.error ? (
        <p className="mb-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-fv-bg-soft">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/settings/clinic?tab=${t.key}`}
            className={tabClass(t.key === tab)}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "profile" ? (
        <ClinicProfileTab
          profile={
            (
              await supabase
                .from("clinic_profile")
                .select("*")
                .limit(1)
                .maybeSingle()
            ).data
          }
          canEdit={canEdit}
        />
      ) : null}

      {tab === "doctors" ? (
        <DoctorsTab
          doctors={
            (
              await supabase
                .from("doctors")
                .select("*")
                .order("active", { ascending: false })
                .order("name")
            ).data ?? []
          }
          canEdit={canEdit}
        />
      ) : null}

      {tab === "facilities" ? (
        <FacilitiesTab
          facilities={
            (
              await supabase
                .from("partner_facilities")
                .select("*")
                .order("active", { ascending: false })
                .order("name")
            ).data ?? []
          }
          canEdit={canEdit}
        />
      ) : null}

      {tab === "templates" ? (
        <TemplatesTab
          templates={
            (
              await supabase
                .from("message_templates")
                .select("*")
                .order("category")
                .order("order_index")
            ).data ?? []
          }
          canEdit={canEdit}
        />
      ) : null}

      {tab === "contact" ? (
        <ContactOptionsTab
          options={
            (
              await supabase
                .from("contact_options")
                .select("*")
                .order("order_index")
            ).data ?? []
          }
          canEdit={canEdit}
        />
      ) : null}

      {tab === "content" ? (
        <ContentTab
          items={
            (
              await supabase
                .from("content_items")
                .select("*")
                .order("created_at", { ascending: false })
            ).data ?? []
          }
          canEdit={canEdit}
          filter={{
            audience: searchParams.audience ?? "all",
            procedure: searchParams.procedure ?? "all",
            type: searchParams.type ?? "all",
          }}
        />
      ) : null}
    </main>
  );
}
