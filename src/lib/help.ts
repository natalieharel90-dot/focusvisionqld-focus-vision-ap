// Staff Help centre — pure helpers. Articles are version-controlled
// markdown files under content/help/<section>/<slug>.md. Everything here
// is framework-free and unit-testable: frontmatter parsing, a small
// markdown-block parser (incl. three custom callouts), and search.

// ── Sections ─────────────────────────────────────────────────────────────

export type HelpSectionMeta = { key: string; label: string };

// Display order of the topic tree.
export const HELP_SECTIONS: ReadonlyArray<HelpSectionMeta> = [
  { key: "getting-started", label: "Getting started" },
  { key: "patients", label: "Patients" },
  { key: "check-ins", label: "Daily check-ins & triage" },
  { key: "messaging", label: "Messaging" },
  { key: "routing", label: "Routing rules" },
  { key: "recovery-guidance", label: "Recovery guidance" },
  { key: "procedures", label: "Procedures & content" },
  { key: "bulk-push", label: "Bulk push" },
  { key: "analytics", label: "Analytics & reports" },
  { key: "audit-log", label: "Audit log" },
  { key: "settings", label: "Settings" },
  { key: "patient-experience", label: "The patient experience" },
  { key: "privacy", label: "Privacy & compliance" },
  { key: "troubleshooting", label: "Troubleshooting" },
];

export function helpSectionLabel(key: string): string {
  return HELP_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

// ── Article types ────────────────────────────────────────────────────────

export type HelpFrontmatter = {
  title: string;
  section: string;
  order: number;
  video_url: string | null;
  video_duration_seconds: number | null;
  keywords: string[];
  related: string[];
};

export type HelpArticle = HelpFrontmatter & {
  slug: string; // file slug, e.g. "signing-in-first-time"
  ref: string; // canonical "<section>/<slug>"
  body: string; // raw markdown body
};

export function helpArticlePath(section: string, slug: string): string {
  return `/help/${section}/${slug}`;
}

// ── Frontmatter parsing ──────────────────────────────────────────────────

function parseScalar(raw: string): string | number | null {
  const v = raw.trim();
  if (v === "null" || v === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  if (inner === "") return [];
  return inner
    .split(",")
    .map((s) => {
      const t = s.trim();
      return (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
        ? t.slice(1, -1)
        : t;
    })
    .filter((s) => s.length > 0);
}

// Splits a help markdown file into its frontmatter object and body text.
export function parseFrontmatter(raw: string): {
  data: HelpFrontmatter;
  body: string;
} {
  const normalised = raw.replace(/\r\n/g, "\n");
  const fields: Record<string, string | number | null | string[]> = {};
  let body = normalised;

  if (normalised.startsWith("---\n")) {
    const end = normalised.indexOf("\n---", 4);
    if (end !== -1) {
      const block = normalised.slice(4, end);
      body = normalised.slice(end + 4).replace(/^\n+/, "");
      for (const line of block.split("\n")) {
        const colon = line.indexOf(":");
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        fields[key] = value.startsWith("[")
          ? parseList(value)
          : parseScalar(value);
      }
    }
  }

  return {
    data: {
      title: String(fields.title ?? ""),
      section: String(fields.section ?? ""),
      order: typeof fields.order === "number" ? fields.order : 0,
      video_url:
        typeof fields.video_url === "string" ? fields.video_url : null,
      video_duration_seconds:
        typeof fields.video_duration_seconds === "number"
          ? fields.video_duration_seconds
          : null,
      keywords: Array.isArray(fields.keywords) ? fields.keywords : [],
      related: Array.isArray(fields.related) ? fields.related : [],
    },
    body,
  };
}

// ── Markdown block parser ────────────────────────────────────────────────

export type HelpInline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; text: string; href: string };

export type HelpCalloutKind = "patient-sees" | "tip" | "watch-out";

export type HelpBlock =
  | { type: "heading"; level: 2 | 3 | 4; content: HelpInline[] }
  | { type: "paragraph"; content: HelpInline[] }
  | { type: "list"; ordered: boolean; items: HelpInline[][] }
  | { type: "callout"; kind: HelpCalloutKind; blocks: HelpBlock[] };

const INLINE_RE = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/;

// Tokenises a line into text / bold / link runs.
export function parseInline(text: string): HelpInline[] {
  const out: HelpInline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest);
    if (!m) {
      out.push({ type: "text", value: rest });
      break;
    }
    if (m.index > 0) {
      out.push({ type: "text", value: rest.slice(0, m.index) });
    }
    if (m[2] !== undefined) {
      out.push({ type: "bold", value: m[2] });
    } else {
      out.push({ type: "link", text: m[4]!, href: m[5]! });
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out.filter((t) => !(t.type === "text" && t.value === ""));
}

const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+/;
const ORDERED_RE = /^\d+\.\s+/;
const CALLOUT_OPEN_RE = /^:::(patient-sees|tip|watch-out)\s*$/;

function parseBlocks(lines: string[]): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = (lines[i] ?? "").trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    const calloutOpen = CALLOUT_OPEN_RE.exec(trimmed);
    if (calloutOpen) {
      const kind = calloutOpen[1] as HelpCalloutKind;
      const inner: string[] = [];
      i++;
      while (i < lines.length && (lines[i] ?? "").trim() !== ":::") {
        inner.push(lines[i] ?? "");
        i++;
      }
      i++; // skip the closing :::
      blocks.push({ type: "callout", kind, blocks: parseBlocks(inner) });
      continue;
    }

    const heading = HEADING_RE.exec(trimmed);
    if (heading) {
      const hashes = heading[1]!.length;
      const level: 2 | 3 | 4 = hashes <= 2 ? 2 : hashes === 3 ? 3 : 4;
      blocks.push({
        type: "heading",
        level,
        content: parseInline(heading[2]!),
      });
      i++;
      continue;
    }

    if (BULLET_RE.test(trimmed)) {
      const items: HelpInline[][] = [];
      while (i < lines.length && BULLET_RE.test((lines[i] ?? "").trim())) {
        items.push(
          parseInline((lines[i] ?? "").trim().replace(BULLET_RE, ""))
        );
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (ORDERED_RE.test(trimmed)) {
      const items: HelpInline[][] = [];
      while (i < lines.length && ORDERED_RE.test((lines[i] ?? "").trim())) {
        items.push(
          parseInline((lines[i] ?? "").trim().replace(ORDERED_RE, ""))
        );
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Paragraph — consume consecutive non-structural lines.
    const para: string[] = [];
    while (i < lines.length) {
      const t = (lines[i] ?? "").trim();
      if (
        t === "" ||
        t.startsWith(":::") ||
        HEADING_RE.test(t) ||
        BULLET_RE.test(t) ||
        ORDERED_RE.test(t)
      ) {
        break;
      }
      para.push(t);
      i++;
    }
    blocks.push({ type: "paragraph", content: parseInline(para.join(" ")) });
  }

  return blocks;
}

// Parses a help article body into a block AST.
export function parseHelpMarkdown(body: string): HelpBlock[] {
  return parseBlocks(body.replace(/\r\n/g, "\n").split("\n"));
}

// ── Search ───────────────────────────────────────────────────────────────

export type HelpSearchResult = {
  article: HelpArticle;
  snippet: string;
  score: number;
};

// Plain-text-ish version of a body for snippet extraction.
function stripMarkdown(body: string): string {
  return body
    .replace(/:::(patient-sees|tip|watch-out)?/g, " ")
    .replace(/[#*>`]/g, "")
    .replace(/^\s*[-]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(body: string, terms: string[]): string {
  const text = stripMarkdown(body);
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx !== -1 && (at === -1 || idx < at)) at = idx;
  }
  if (at === -1) return text.slice(0, 140) + (text.length > 140 ? "…" : "");
  const start = Math.max(0, at - 50);
  const end = Math.min(text.length, at + 110);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, end).trim() +
    (end < text.length ? "…" : "")
  );
}

// Ranks articles against a free-text query. Title hits weigh most,
// keywords next, body least. Returns highest-scoring first.
export function searchArticles(
  articles: ReadonlyArray<HelpArticle>,
  query: string
): HelpSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const results: HelpSearchResult[] = [];
  for (const article of articles) {
    const title = article.title.toLowerCase();
    const keywords = article.keywords.join(" ").toLowerCase();
    const body = article.body.toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      if (keywords.includes(term)) score += 3;
      if (body.includes(term)) score += 1;
    }
    if (score === 0) continue;

    results.push({ article, snippet: makeSnippet(article.body, terms), score });
  }

  return results.sort(
    (a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title)
  );
}

// ── Topic-tree helpers ───────────────────────────────────────────────────

// The section key for the article currently open, or null on the Help home.
export function activeHelpSection(pathname: string): string | null {
  const m = /^\/help\/([^/]+)\/[^/]+\/?$/.exec(pathname);
  return m ? m[1]! : null;
}

export function isHelpSectionActive(
  pathname: string,
  sectionKey: string
): boolean {
  return activeHelpSection(pathname) === sectionKey;
}

// Articles in a section, ordered by their `order` field.
export function articlesInSection(
  articles: ReadonlyArray<HelpArticle>,
  sectionKey: string
): HelpArticle[] {
  return articles
    .filter((a) => a.section === sectionKey)
    .sort((a, b) => a.order - b.order);
}

// The "Related articles" list: curated `related` refs resolved to real
// articles, falling back to other articles in the same section.
export function relatedArticles(
  article: HelpArticle,
  all: ReadonlyArray<HelpArticle>
): HelpArticle[] {
  const byRef = new Map(all.map((a) => [a.ref, a]));
  const curated = article.related
    .map((ref) => byRef.get(ref))
    .filter((a): a is HelpArticle => a != null && a.ref !== article.ref);
  if (curated.length > 0) return curated.slice(0, 5);

  return articlesInSection(all, article.section)
    .filter((a) => a.ref !== article.ref)
    .slice(0, 4);
}

// Audit payload for a viewed article — see help-content audit logging.
export function helpArticleAuditPayload(article: HelpArticle): {
  entity_type: string;
  entity_id: string;
} {
  return { entity_type: "help_article", entity_id: article.ref };
}
