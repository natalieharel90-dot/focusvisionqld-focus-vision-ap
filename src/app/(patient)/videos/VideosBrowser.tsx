"use client";

import { useMemo, useState } from "react";

export type VideoItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  media_url: string | null;
  topics: string[];
};

const FOR_YOU = "__for_you__";

// Gradient thumbnails — content_items has no stored thumbnail, so each
// video gets a stable gradient keyed off its id.
const GRADIENTS = [
  "from-teal-500 to-teal-700",
  "from-sky-400 to-teal-600",
  "from-cyan-500 to-teal-700",
  "from-amber-300 via-lime-300 to-teal-500",
  "from-emerald-400 to-teal-700",
];
function gradientFor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return GRADIENTS[h % GRADIENTS.length]!;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function VideosBrowser({
  items,
  adHoc,
}: {
  items: VideoItem[];
  adHoc: { id: string; message: string }[];
}) {
  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) for (const t of i.topics) set.add(t);
    return [...set].sort();
  }, [items]);

  const [active, setActive] = useState(FOR_YOU);

  const filtered =
    active === FOR_YOU
      ? items
      : items.filter((i) => i.topics.includes(active));
  const videos = filtered.filter((i) => i.type === "video");
  const articles = filtered.filter((i) => i.type !== "video");

  const chips = [{ key: FOR_YOU, label: "For you" }, ...topics.map((t) => ({ key: t, label: t }))];

  return (
    <div className="flex flex-col gap-4">
      {/* Ad-hoc reassurance pins from the care team */}
      {adHoc.map((m) => (
        <div
          key={m.id}
          className="flex items-start gap-2.5 rounded-2xl bg-fv-bg-accent-soft p-4"
        >
          <span aria-hidden className="text-lg">
            💬
          </span>
          <p className="text-sm font-medium text-fv-text-primary">
            {m.message}
          </p>
        </div>
      ))}

      {/* Topic filter chips */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
              active === c.key
                ? "bg-fv-text-primary text-white"
                : "border border-fv-border bg-fv-bg-card text-fv-text-primary"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          Nothing here yet — your care team will add guides as you go.
        </p>
      ) : null}

      {/* Video cards */}
      {videos.map((v) => {
        const card = (
          <div className="overflow-hidden rounded-2xl bg-fv-bg-card shadow-sm">
            <div
              className={`relative grid h-44 place-items-center bg-gradient-to-br ${gradientFor(
                v.id
              )}`}
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-fv-accent-strong">
                <PlayIcon />
              </span>
            </div>
            <div className="p-4">
              <div className="font-semibold text-fv-text-primary">
                {v.title}
              </div>
              {v.body ? (
                <div className="mt-0.5 line-clamp-1 text-sm text-fv-text-secondary">
                  {v.body}
                </div>
              ) : null}
            </div>
          </div>
        );
        return v.media_url ? (
          <a key={v.id} href={v.media_url} target="_blank" rel="noreferrer">
            {card}
          </a>
        ) : (
          <div key={v.id}>{card}</div>
        );
      })}

      {/* Reading */}
      {articles.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Reading
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {articles.map((a) => {
              const isFaq = a.topics.some((t) => /faq|question/i.test(t));
              const inner = (
                <>
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fv-bg-accent-soft text-xl"
                  >
                    {isFaq ? "❓" : "📖"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-fv-text-primary">
                      {a.title}
                    </div>
                    {a.body ? (
                      <div className="line-clamp-1 text-sm text-fv-text-secondary">
                        {a.body}
                      </div>
                    ) : null}
                  </div>
                  {a.media_url ? (
                    <span aria-hidden className="text-fv-text-secondary">
                      ›
                    </span>
                  ) : null}
                </>
              );
              return a.media_url ? (
                <a
                  key={a.id}
                  href={a.media_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm"
                >
                  {inner}
                </a>
              ) : (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
