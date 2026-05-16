"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  isActivityFeedEvent,
  relativeTime,
  type ActivityTone,
} from "@/lib/home-dashboard";

export type FeedItem = {
  id: string;
  tone: ActivityTone;
  summary: string;
  createdAt: string;
};

const TONE_DOT: Record<ActivityTone, string> = {
  info: "bg-fv-accent-strong",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

// The home activity feed. Server-rendered with the latest events; it then
// subscribes to audit_events INSERTs and refreshes when a new meaningful
// event lands, so the feed stays live without a manual reload.
export function ActivityFeed({ items }: { items: ReadonlyArray<FeedItem> }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("home-activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_events" },
        (payload) => {
          const type = (payload.new as { event_type?: string }).event_type;
          if (type && isActivityFeedEvent(type)) router.refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <section className="flex flex-col rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fv-text-primary">Activity</h3>
        <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
          Last 24 hours
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-fv-text-secondary">
          No recent activity.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 border-b border-fv-bg-soft/60 py-2.5 last:border-0"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`}
              />
              <span className="min-w-0 flex-1 text-[13px] text-fv-text-primary">
                {item.summary}
              </span>
              <span className="shrink-0 text-[11px] text-fv-text-secondary">
                {relativeTime(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/audit"
        className="mt-3 text-xs font-semibold text-fv-accent-strong hover:underline"
      >
        View audit log →
      </Link>
    </section>
  );
}
