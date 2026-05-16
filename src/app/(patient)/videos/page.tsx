import { createSupabaseServerClient } from "@/lib/supabase-server";
import { VideosBrowser, type VideoItem } from "./VideosBrowser";

export const dynamic = "force-dynamic";

type ContentItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  media_url: string | null;
  topics: string[];
};

type PinnedRow = {
  id: string;
  ad_hoc_message: string | null;
  content_items: ContentItem | null;
};

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
        "id, ad_hoc_message, content_items(id, title, type, body, media_url, topics)"
      )
      .eq("patient_id", user.id)
      .order("created_at"),
    supabase.rpc("my_postop_content"),
  ]);

  const pinned = (pinnedRes.data ?? []) as PinnedRow[];
  const postop = (postopRes.data ?? []) as ContentItem[];

  // Combine pinned library content + the procedure's post-op guides,
  // deduped by id.
  const byId = new Map<string, VideoItem>();
  for (const p of pinned) {
    if (p.content_items) {
      const c = p.content_items;
      byId.set(c.id, {
        id: c.id,
        type: c.type,
        title: c.title,
        body: c.body,
        media_url: c.media_url,
        topics: c.topics ?? [],
      });
    }
  }
  for (const c of postop) {
    if (!byId.has(c.id)) {
      byId.set(c.id, {
        id: c.id,
        type: c.type,
        title: c.title,
        body: c.body,
        media_url: c.media_url,
        topics: c.topics ?? [],
      });
    }
  }

  const adHoc = pinned
    .filter((p) => !p.content_items && p.ad_hoc_message)
    .map((p) => ({ id: p.id, message: p.ad_hoc_message as string }));

  return (
    <main className="flex flex-col gap-4 px-5 py-5">
      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          Videos &amp; info
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Short, trusted guides — picked for your recovery
        </p>
      </header>

      <VideosBrowser items={[...byId.values()]} adHoc={adHoc} />
    </main>
  );
}
