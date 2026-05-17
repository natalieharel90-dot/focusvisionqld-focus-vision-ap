"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  helpArticlePath,
  helpSectionLabel,
  searchArticles,
  type HelpArticle,
} from "@/lib/help";

// Wraps each query-term occurrence in <mark> for result highlighting.
function highlight(text: string, terms: string[]): ReactNode {
  const cleaned = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (cleaned.length === 0) return text;
  const re = new RegExp(`(${cleaned.join("|")})`, "ig");
  return text.split(re).map((part, i) =>
    re.test(part) ? (
      <mark key={i} className="rounded bg-amber-200 px-0.5 text-fv-text-primary">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function HelpSearch({ articles }: { articles: HelpArticle[] }) {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");

  // Debounce — search runs 200ms after the last keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(raw), 200);
    return () => clearTimeout(timer);
  }, [raw]);

  const results = useMemo(
    () => searchArticles(articles, query),
    [articles, query]
  );
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return (
    <div className="fv-help-search relative">
      <input
        type="search"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Search help articles…"
        className="w-full rounded-xl border border-fv-border bg-fv-bg-card px-4 py-2.5 text-sm text-fv-text-primary placeholder:text-fv-text-secondary focus:border-fv-accent focus:outline-none"
      />

      {query.trim() !== "" ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-fv-border bg-fv-bg-card shadow-sm">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fv-text-secondary">
              No articles match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-fv-bg-soft overflow-y-auto">
              {results.slice(0, 20).map((r) => (
                <li key={r.article.ref}>
                  <Link
                    href={helpArticlePath(r.article.section, r.article.slug)}
                    onClick={() => setRaw("")}
                    className="block px-4 py-3 hover:bg-fv-bg-soft"
                  >
                    <div className="text-sm font-semibold text-fv-text-primary">
                      {highlight(r.article.title, terms)}
                    </div>
                    <div className="text-xs font-medium uppercase tracking-wide text-fv-accent-strong">
                      {helpSectionLabel(r.article.section)}
                    </div>
                    <div className="mt-0.5 text-xs leading-relaxed text-fv-text-secondary">
                      {highlight(r.snippet, terms)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
