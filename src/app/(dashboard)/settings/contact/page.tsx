import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ContactOptionsTab } from "../clinic/ContactOptionsTab";
import { TemplatesTab } from "../clinic/TemplatesTab";
import { ContentTab } from "../clinic/ContentTab";
import { saveAfterHoursNoticeAction } from "../clinic/actions";

export const dynamic = "force-dynamic";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary";
const inputClass =
  "mt-1.5 w-full rounded-lg border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm focus:border-fv-accent focus:outline-none";

// Settings → Contact screen: contact options, the after-hours emergency
// notice, message templates and the recovery content library.
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

  const [optionsRes, templatesRes, contentRes, profileRes] = await Promise.all(
    [
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
      supabase
        .from("clinic_profile")
        .select(
          "after_hours_phone, after_hours_message, after_hours_label"
        )
        .limit(1)
        .maybeSingle(),
    ]
  );
  const profile = profileRes.data;

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-6">
        <ContactOptionsTab options={optionsRes.data ?? []} canEdit />

        {/* After-hours emergency notice */}
        {profile ? (
          <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-fv-text-primary">
              After-hours emergency notice
            </h2>
            <p className="mt-0.5 text-xs text-fv-text-secondary">
              Always shown at the bottom of the patient&apos;s Contact screen
              in red. This text is editable below.
            </p>
            <form
              action={saveAfterHoursNoticeAction}
              className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2"
            >
              <label>
                <span className={labelClass}>After-hours phone</span>
                <input
                  name="after_hours_phone"
                  required
                  defaultValue={profile.after_hours_phone}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Display label</span>
                <input
                  name="after_hours_label"
                  defaultValue={profile.after_hours_label}
                  className={inputClass}
                />
              </label>
              <label className="sm:col-span-2">
                <span className={labelClass}>Message text</span>
                <input
                  name="after_hours_message"
                  required
                  defaultValue={profile.after_hours_message}
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                className="self-start rounded-lg bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Save notice
              </button>
            </form>
          </section>
        ) : null}

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
