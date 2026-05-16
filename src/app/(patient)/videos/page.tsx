import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type ContentItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  media_url: string | null;
};

type PinnedRow = {
  id: string;
  ad_hoc_message: string | null;
  content_items: {
    id: string;
    title: string;
    type: string;
    body: string | null;
    media_url: string | null;
  } | null;
};

// One content card — links out to media when there is a URL.
function ContentCard({
  icon,
  title,
  sub,
  mediaUrl,
}: {
  icon: string;
  title: string;
  sub: string;
  mediaUrl: string | null;
}) {
  const inner: ReactNode = (
    <>
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fv-bg-accent-soft text-xl"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-fv-text-primary">
          {title}
        </div>
        <div className="text-xs text-fv-text-secondary">{sub}</div>
      </div>
      {mediaUrl ? (
        <span aria-hidden className="text-fv-text-secondary">
          ›
        </span>
      ) : null}
    </>
  );
  return mediaUrl ? (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm hover:shadow"
    >
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm">
      {inner}
    </div>
  );
}

export default async function PatientVideosPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [pinnedRes, postopRes] = await Promise.all([
    supabase
      .from("patient_pinned_content")
      .select(
        "id, ad_hoc_message, content_items(id, title, type, body, media_url)"
      )
      .eq("patient_id", user.id)
      .order("created_at"),
    supabase.rpc("my_postop_content"),
  ]);

  const pinned = (pinnedRes.data ?? []) as PinnedRow[];
  const postop = (postopRes.data ?? []) as ContentItem[];
  const empty = pinned.length === 0 && postop.length === 0;

  const icon = (type: string) => (type === "video" ? "📺" : "📄");

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Videos &amp; info
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Recovery guides for you, plus anything your care team has pinned.
        </p>
      </header>

      {empty ? (
        <p className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          Nothing here yet — your care team will add recovery guides as you
          go.
        </p>
      ) : null}

      {/* Pinned by the clinic for this patient */}
      {pinned.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Pinned for you
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {pinned.map((p) => {
              const c = p.content_items;
              if (c) {
                return (
                  <ContentCard
                    key={p.id}
                    icon={icon(c.type)}
                    title={c.title}
                    sub={c.type === "video" ? "Video" : "Article"}
                    mediaUrl={c.media_url}
                  />
                );
              }
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-fv-bg-accent-soft p-4 shadow-sm"
                >
                  <span aria-hidden className="text-xl">
                    💬
                  </span>
                  <p className="text-sm font-medium text-fv-text-primary">
                    {p.ad_hoc_message}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Post-op content from the patient's procedure template */}
      {postop.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Your recovery guides
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {postop.map((c) => (
              <ContentCard
                key={c.id}
                icon={icon(c.type)}
                title={c.title}
                sub={c.type === "video" ? "Video" : "Article"}
                mediaUrl={c.media_url}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
