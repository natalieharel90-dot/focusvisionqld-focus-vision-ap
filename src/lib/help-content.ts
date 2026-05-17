// Server-only loader for the staff Help centre. Reads the markdown files
// under content/help/<section>/<slug>.md and parses their frontmatter.
import "server-only";
import fs from "node:fs";
import path from "node:path";

import { parseFrontmatter, type HelpArticle } from "./help";

const HELP_DIR = path.join(process.cwd(), "content", "help");

// Loads and parses every help article. The folder name is authoritative
// for the section (the frontmatter section field is informational).
export function loadHelpArticles(): HelpArticle[] {
  if (!fs.existsSync(HELP_DIR)) return [];

  const articles: HelpArticle[] = [];
  for (const section of fs.readdirSync(HELP_DIR)) {
    const sectionDir = path.join(HELP_DIR, section);
    if (!fs.statSync(sectionDir).isDirectory()) continue;

    for (const file of fs.readdirSync(sectionDir)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(sectionDir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      articles.push({
        ...data,
        section,
        slug,
        ref: `${section}/${slug}`,
        body,
      });
    }
  }

  return articles.sort(
    (a, b) => a.section.localeCompare(b.section) || a.order - b.order
  );
}

// Slug segments are restricted to a safe character set — the section and
// slug come straight from the URL, so this also blocks path traversal.
const SAFE_SEGMENT = /^[a-z0-9-]+$/;

// A single article by its section + slug, or null if it doesn't exist.
export function getHelpArticle(
  section: string,
  slug: string
): HelpArticle | null {
  if (!SAFE_SEGMENT.test(section) || !SAFE_SEGMENT.test(slug)) return null;
  const file = path.join(HELP_DIR, section, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  return { ...data, section, slug, ref: `${section}/${slug}`, body };
}
