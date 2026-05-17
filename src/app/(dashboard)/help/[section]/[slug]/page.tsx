import Link from "next/link";
import { notFound } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  helpArticleAuditPayload,
  helpArticlePath,
  helpSectionLabel,
  relatedArticles,
} from "@/lib/help";
import { getHelpArticle, loadHelpArticles } from "@/lib/help-content";
import { HelpMarkdown } from "@/components/help/HelpMarkdown";
import { HelpPrintButton } from "@/components/help/HelpPrintButton";

export const dynamic = "force-dynamic";

export default async function HelpArticlePage({
  params,
}: {
  params: { section: string; slug: string };
}) {
  const article = getHelpArticle(params.section, params.slug);
  if (!article) notFound();

  // Audit-log the view — staff actor + article ref + timestamp.
  const supabase = createSupabaseServerClient();
  await recordStaffAudit(
    supabase,
    "help.article_viewed",
    helpArticleAuditPayload(article)
  );

  const related = relatedArticles(article, loadHelpArticles());

  return (
    <article className="flex flex-col gap-4">
      {/* Breadcrumbs */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-fv-text-secondary">
        <Link href="/help" className="hover:text-fv-accent-strong hover:underline">
          Help
        </Link>
        <span aria-hidden>›</span>
        <span>{helpSectionLabel(article.section)}</span>
        <span aria-hidden>›</span>
        <span className="text-fv-text-primary">{article.title}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          {article.title}
        </h1>
        <HelpPrintButton />
      </div>

      {/* Video slot — placeholder until walkthroughs are recorded. */}
      {article.video_url ? (
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <iframe
            src={article.video_url}
            title={`${article.title} — video walkthrough`}
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="print:hidden flex items-center gap-3 rounded-2xl border border-dashed border-fv-border bg-fv-bg-soft/50 px-4 py-3 text-sm text-fv-text-secondary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0 text-fv-accent-strong"
          >
            <path d="m23 7-7 5 7 5z" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
          <span>
            Video walkthrough coming soon
            {article.video_duration_seconds
              ? ` (${article.video_duration_seconds}s)`
              : ""}
            .
          </span>
        </div>
      )}

      <HelpMarkdown body={article.body} />

      {/* Related articles */}
      {related.length > 0 ? (
        <section className="mt-2 rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fv-accent-strong">
            Related articles
          </h2>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {related.map((r) => (
              <li key={r.ref}>
                <Link
                  href={helpArticlePath(r.section, r.slug)}
                  className="text-sm text-fv-text-primary hover:text-fv-accent-strong hover:underline"
                >
                  {r.title}
                </Link>
                <span className="ml-2 text-xs text-fv-text-secondary">
                  {helpSectionLabel(r.section)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
