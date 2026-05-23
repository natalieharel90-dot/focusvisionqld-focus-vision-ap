import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ContactOptionsTab } from "../clinic/ContactOptionsTab";
import { TemplatesTab } from "../clinic/TemplatesTab";
import { ContentTab } from "../clinic/ContentTab";

export const dynamic = "force-dynamic";

// Settings → Contact screen: contact options, message templates and the
// recovery content library. (The patient-facing after-hours notice now
// reads from the patient's surgeon record, not from a clinic-wide
// editable field — so no after-hours form here.)
export default async function ContactSettingsPage({
  searchParams,
}: {
  searchParams: {
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

  const [optionsRes, templatesRes, contentRes] = await Promise.all([
    supabase.from("contact_options").select("*").order("order_index"),
    supabase
      .from("message_templates")
      .select("*")
      .order("category")
      .order("order_index"),
    supabase
      .from("content_items")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-6">
        <ContactOptionsTab options={optionsRes.data ?? []} canEdit />

        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-4 text-xs text-fv-text-secondary shadow-sm">
          <strong className="text-fv-text-primary">After-hours notice:</strong>{" "}
          The patient&apos;s Contact and check-in screens now tell them to
          go to their nearest emergency department or contact their surgeon
          directly. The surgeon&apos;s name and phone come from the staff
          profile (Settings → Clinic &amp; Doctors → each surgeon&apos;s
          Phone field), so different surgeons surface their own number to
          their own patients.
        </section>

        <TemplatesTab templates={templatesRes.data ?? []} canEdit />
        <ContentTab
          items={contentRes.data ?? []}
          canEdit
          filter={{
            audience: searchParams.audience ?? "all",
            procedure: searchParams.procedure ?? "all",
            type: searchParams.type ?? "all",
          }}
        />
      </div>
    </main>
  );
}
