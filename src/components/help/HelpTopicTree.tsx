"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  HELP_SECTIONS,
  articlesInSection,
  helpArticlePath,
  isHelpSectionActive,
  type HelpArticle,
} from "@/lib/help";

function SectionGroup({
  sectionKey,
  label,
  articles,
  pathname,
}: {
  sectionKey: string;
  label: string;
  articles: HelpArticle[];
  pathname: string;
}) {
  const sectionArticles = articlesInSection(articles, sectionKey);
  const active = isHelpSectionActive(pathname, sectionKey);
  // The section holding the open article starts expanded.
  const [open, setOpen] = useState(active);

  if (sectionArticles.length === 0) return null;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold ${
          active
            ? "bg-fv-bg-accent-soft text-fv-accent-strong"
            : "text-fv-text-primary hover:bg-fv-bg-soft"
        }`}
      >
        <span>{label}</span>
        <span aria-hidden className="text-fv-text-secondary">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <ul className="mt-0.5 flex flex-col gap-0.5 border-l border-fv-bg-soft pl-2">
          {sectionArticles.map((a) => {
            const href = helpArticlePath(a.section, a.slug);
            const current = pathname === href;
            return (
              <li key={a.ref}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-md px-2.5 py-1.5 text-[12.5px] leading-snug ${
                    current
                      ? "bg-fv-accent-strong font-semibold text-white"
                      : "text-fv-text-secondary hover:bg-fv-bg-soft hover:text-fv-text-primary"
                  }`}
                >
                  {a.title}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

// The Help topic tree: a sticky sidebar at ≥1100px, a collapsible
// accordion below that. Hidden when printing.
export function HelpTopicTree({ articles }: { articles: HelpArticle[] }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="fv-help-tree print:hidden min-[1100px]:w-60 min-[1100px]:shrink-0">
      <button
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        className="mb-2 flex w-full items-center justify-between rounded-xl border border-fv-border bg-fv-bg-card px-4 py-2.5 text-sm font-semibold text-fv-text-primary min-[1100px]:hidden"
      >
        <span>Browse help topics</span>
        <span aria-hidden>{navOpen ? "−" : "+"}</span>
      </button>

      <nav
        className={`${
          navOpen ? "block" : "hidden"
        } rounded-xl border border-fv-border bg-fv-bg-card p-2 min-[1100px]:sticky min-[1100px]:top-4 min-[1100px]:block`}
      >
        <ul className="flex flex-col gap-0.5">
          {HELP_SECTIONS.map((s) => (
            <SectionGroup
              key={s.key}
              sectionKey={s.key}
              label={s.label}
              articles={articles}
              pathname={pathname}
            />
          ))}
        </ul>
      </nav>
    </div>
  );
}
