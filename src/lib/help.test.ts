import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  activeHelpSection,
  helpArticleAuditPayload,
  isHelpSectionActive,
  parseFrontmatter,
  parseHelpMarkdown,
  parseInline,
  relatedArticles,
  searchArticles,
  type HelpArticle,
} from "./help";

function article(
  over: Partial<HelpArticle> & { slug: string; section: string }
): HelpArticle {
  return {
    title: "Untitled",
    order: 1,
    video_url: null,
    video_duration_seconds: null,
    keywords: [],
    related: [],
    body: "",
    ...over,
    ref: `${over.section}/${over.slug}`,
  };
}

describe("parseFrontmatter", () => {
  it("parses scalars, null, numbers and lists", () => {
    const { data, body } = parseFrontmatter(
      [
        "---",
        'title: "Signing in"',
        'section: "getting-started"',
        "order: 3",
        "video_url: null",
        "video_duration_seconds: null",
        'keywords: ["sign in", "login"]',
        'related: ["patients/opening-a-patient-record"]',
        "---",
        "",
        "Body text here.",
      ].join("\n")
    );
    expect(data.title).toBe("Signing in");
    expect(data.section).toBe("getting-started");
    expect(data.order).toBe(3);
    expect(data.video_url).toBeNull();
    expect(data.video_duration_seconds).toBeNull();
    expect(data.keywords).toEqual(["sign in", "login"]);
    expect(data.related).toEqual(["patients/opening-a-patient-record"]);
    expect(body.trim()).toBe("Body text here.");
  });
});

describe("parseInline", () => {
  it("tokenises bold and links", () => {
    const nodes = parseInline("See **this** and [that](/help/x/y).");
    expect(nodes).toEqual([
      { type: "text", value: "See " },
      { type: "bold", value: "this" },
      { type: "text", value: " and " },
      { type: "link", text: "that", href: "/help/x/y" },
      { type: "text", value: "." },
    ]);
  });
});

describe("parseHelpMarkdown — blocks and custom callouts", () => {
  const blocks = parseHelpMarkdown(
    [
      "## A heading",
      "",
      "A paragraph of text.",
      "",
      "- one",
      "- two",
      "",
      "1. first step",
      "2. second step",
      "",
      ":::patient-sees",
      "The patient sees a calm screen.",
      ":::",
      "",
      ":::watch-out",
      "Do not skip this.",
      ":::",
    ].join("\n")
  );

  it("parses headings, paragraphs and both list kinds", () => {
    expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true });
  });

  it("renders the three custom callout blocks", () => {
    const patientSees = blocks[4]!;
    expect(patientSees.type).toBe("callout");
    expect(patientSees).toMatchObject({ type: "callout", kind: "patient-sees" });
    // Callout body is itself parsed into blocks.
    expect((patientSees as { blocks: unknown[] }).blocks[0]).toMatchObject({
      type: "paragraph",
    });
    expect(blocks[5]).toMatchObject({ type: "callout", kind: "watch-out" });
  });
});

describe("searchArticles", () => {
  const articles: HelpArticle[] = [
    article({
      section: "routing",
      slug: "the-four-option-router",
      title: "The four-option router",
      keywords: ["routing", "alert", "red"],
      body: "Off, yellow, orange and red explained — feeds the triage flow.",
    }),
    article({
      section: "check-ins",
      slug: "reading-the-triage-queue",
      title: "Reading the triage queue",
      keywords: ["triage", "queue"],
      body: "The triage queue lists patients whose routing produced an alert.",
    }),
    article({
      section: "messaging",
      slug: "the-shared-inbox",
      title: "The shared inbox",
      keywords: ["inbox", "messages"],
      body: "Every staff member sees the same inbox.",
    }),
  ];

  it("returns relevant results across multiple sections", () => {
    const results = searchArticles(articles, "routing");
    const sections = results.map((r) => r.article.section);
    expect(sections).toContain("routing");
    expect(sections).toContain("check-ins");
    expect(sections).not.toContain("messaging");
  });

  it("ranks a title match above a body-only match", () => {
    // "triage" is in one article's title and only in the other's body.
    const results = searchArticles(articles, "triage");
    expect(results.map((r) => r.article.slug)).toEqual([
      "reading-the-triage-queue",
      "the-four-option-router",
    ]);
  });

  it("returns a snippet and nothing for an empty query", () => {
    expect(searchArticles(articles, "")).toEqual([]);
    expect(searchArticles(articles, "inbox")[0]!.snippet.length).toBeGreaterThan(
      0
    );
  });
});

describe("topic tree — active section", () => {
  it("identifies the section of the open article", () => {
    expect(activeHelpSection("/help/routing/the-four-option-router")).toBe(
      "routing"
    );
    expect(activeHelpSection("/help")).toBeNull();
  });

  it("highlights the current section only", () => {
    const path = "/help/patients/opening-a-patient-record";
    expect(isHelpSectionActive(path, "patients")).toBe(true);
    expect(isHelpSectionActive(path, "routing")).toBe(false);
  });
});

describe("helpArticleAuditPayload", () => {
  it("records the article ref as the audited entity", () => {
    const payload = helpArticleAuditPayload(
      article({ section: "audit-log", slug: "whats-auditable" })
    );
    expect(payload).toEqual({
      entity_type: "help_article",
      entity_id: "audit-log/whats-auditable",
    });
  });
});

describe("relatedArticles", () => {
  const all: HelpArticle[] = [
    article({ section: "routing", slug: "a", order: 1, related: ["routing/b"] }),
    article({ section: "routing", slug: "b", order: 2 }),
    article({ section: "routing", slug: "c", order: 3 }),
  ];

  it("resolves curated related refs", () => {
    expect(relatedArticles(all[0]!, all).map((a) => a.slug)).toEqual(["b"]);
  });

  it("falls back to other articles in the section", () => {
    expect(relatedArticles(all[1]!, all).map((a) => a.slug)).toEqual(["a", "c"]);
  });
});

describe("print stylesheet", () => {
  it("hides the dashboard sidebar and the Help topic tree", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8"
    );
    const at = css.indexOf("@media print");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at);
    expect(block).toContain(".fv-dash-sidebar");
    expect(block).toContain(".fv-help-tree");
    expect(block).toContain(".fv-help-search");
    expect(block).toContain("display: none");
  });
});
