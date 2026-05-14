"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  threadId: string;
  // Who is viewing — used to decide whether to fire a notification (only
  // for messages from the OTHER party, not our own echoes).
  viewerType: "patient" | "staff";
  notificationTitle: string;
};

// Subscribes to INSERTs on public.messages filtered by thread_id. On a
// new message, refreshes the route (so the server-rendered message list
// re-fetches) and fires a foreground Notification if the message is from
// the other side. Returns null — this component renders no UI; it also
// surfaces the notification permission control.
export function ThreadRealtime({
  threadId,
  viewerType,
  notificationTitle,
}: Props) {
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          router.refresh();
          const row = payload.new as {
            sender_type: "patient" | "staff";
            body: string;
          };
          // Only notify on messages from the OTHER side.
          if (
            row.sender_type !== viewerType &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification(notificationTitle, {
              body: row.body.slice(0, 140),
              tag: `thread:${threadId}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, viewerType, notificationTitle, router]);

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (permission === null || permission === "granted") return null;
  if (permission === "denied") {
    return (
      <p className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
        Message notifications are blocked. Enable them in your browser settings
        to be alerted when a new reply arrives.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={requestPermission}
      className="rounded-md border border-fv-accent-strong px-3 py-2 text-xs font-semibold text-fv-accent-strong"
    >
      Turn on message notifications
    </button>
  );
}
