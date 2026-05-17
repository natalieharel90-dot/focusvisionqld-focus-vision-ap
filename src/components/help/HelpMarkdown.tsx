import Link from "next/link";
import type { ReactNode } from "react";

import {
  parseHelpMarkdown,
  type HelpBlock,
  type HelpCalloutKind,
  type HelpInline,
} from "@/lib/help";

const CALLOUT: Record<
  HelpCalloutKind,
  { title: string; wrap: string; head: string }
> = {
  "patient-sees": {
    title: "What the patient sees",
    wrap: "border-sky-500 bg-sky-500/10",
    head: "text-sky-600",
  },
  tip: {
    title: "Tip",
    wrap: "border-emerald-500 bg-emerald-500/10",
    head: "text-emerald-600",
  },
  "watch-out": {
    title: "Watch out for",
    wrap: "border-amber-500 bg-amber-500/10",
    head: "text-amber-600",
  },
};

function renderInline(nodes: HelpInline[]): ReactNode {
  return nodes.map((node, i) => {
    if (node.type === "bold") {
      return (
        <strong key={i} className="font-semibold text-fv-text-primary">
          {node.value}
        </strong>
      );
    }
    if (node.type === "link") {
      const internal = node.href.startsWith("/");
      return internal ? (
        <Link
          key={i}
          href={node.href}
          className="font-medium text-fv-accent-strong underline underline-offset-2"
        >
          {node.text}
        </Link>
      ) : (
        <a
          key={i}
          href={node.href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-fv-accent-strong underline underline-offset-2"
        >
          {node.text}
        </a>
      );
    }
    return <span key={i}>{node.value}</span>;
  });
}

function renderBlock(block: HelpBlock, key: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const cls =
        block.level === 2
          ? "mt-3 text-[18px] font-semibold text-fv-text-primary"
          : block.level === 3
            ? "mt-2 text-[16px] font-semibold text-fv-text-primary"
            : "mt-2 text-[14px] font-semibold text-fv-text-primary";
      if (block.level === 2) {
        return (
          <h2 key={key} className={cls}>
            {renderInline(block.content)}
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3 key={key} className={cls}>
            {renderInline(block.content)}
          </h3>
        );
      }
      return (
        <h4 key={key} className={cls}>
          {renderInline(block.content)}
        </h4>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="text-fv-text-primary">
          {renderInline(block.content)}
        </p>
      );
    case "list": {
      const itemCls = "text-fv-text-primary";
      return block.ordered ? (
        <ol key={key} className="ml-5 flex list-decimal flex-col gap-1.5">
          {block.items.map((item, i) => (
            <li key={i} className={itemCls}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="ml-5 flex list-disc flex-col gap-1.5">
          {block.items.map((item, i) => (
            <li key={i} className={itemCls}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    }
    case "callout": {
      const meta = CALLOUT[block.kind];
      return (
        <div
          key={key}
          className={`flex flex-col gap-2 rounded-xl border-l-4 p-4 ${meta.wrap}`}
        >
          <div
            className={`text-xs font-bold uppercase tracking-wide ${meta.head}`}
          >
            {meta.title}
          </div>
          {block.blocks.map((inner, i) => renderBlock(inner, i))}
        </div>
      );
    }
  }
}

// Renders a help article body (markdown + custom callouts) as styled prose.
export function HelpMarkdown({ body }: { body: string }) {
  const blocks = parseHelpMarkdown(body);
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-[1.7]">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}
