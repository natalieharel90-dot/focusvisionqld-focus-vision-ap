import Link from "next/link";

import {
  HELP_SECTIONS,
  articlesInSection,
  helpArticlePath,
} from "@/lib/help";
import { loadHelpArticles } from "@/lib/help-content";

export const dynamic = "force-dynamic";

export default function HelpHomePage() {
  const articles = loadHelpArticles();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Help centre
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Step-by-step guides to every part of the dashboard — and what each
          action means for the patient. Browse a topic on the left, or search
          above.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {HELP_SECTIONS.map((section) => {
          const sectionArticles = articlesInSection(articles, section.key);
          if (sectionArticles.length === 0) return null;
          return (
            <section
              key={section.key}
              className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fv-accent-strong">
                {section.label}
              </h2>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {sectionArticles.map((a) => (
                  <li key={a.ref}>
                    <Link
                      href={helpArticlePath(a.section, a.slug)}
                      className="text-sm text-fv-text-primary hover:text-fv-accent-strong hover:underline"
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
