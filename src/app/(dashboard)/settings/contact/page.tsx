import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ContactOptionsTab } from "../clinic/ContactOptionsTab";
import { TemplatesTab } from "../clinic/TemplatesTab";
import { ContentTab } from "../clinic/ContentTab";

export const dynamic = "force-dynamic";

// Settings → Contact screen: the patient app's contact options, the
// clinic's quick-reply message templates, and the recovery content
// library (folded in here so each stays one tab click away).
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
