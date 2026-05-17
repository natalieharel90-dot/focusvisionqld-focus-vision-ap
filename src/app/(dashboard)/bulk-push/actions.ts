"use server";

import { revalidatePath } from "next/cache";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaffTier } from "@/lib/require-staff";
import { canSendBulkPush, type CohortFilter } from "@/lib/bulk-push";
import type { Json } from "@/types/database.types";

export type SendBulkPushInput = {
  cohortFilter: CohortFilter;
  cohortSummary: string;
  contentType: "message" | "content" | "both";
  contentItemIds: string[];
  messageTitle: string;
  messageBody: string;
  attachmentPaths: string[];
  scheduleMode: "now" | "later";
  scheduledAt: string | null; // ISO; required when scheduleMode === 'later'
  recipientCount: number; // preview count the sender saw — recorded in audit
};

export type SendBulkPushResult =
  | { ok: true; pushId: string }
  | { ok: false; error: string };

// Creates a bulk_pushes row and, for "send now", fires the fan-out
// immediately. Enforces the access_tier <= 2 send permission server-side.
// Existing content is composed into the delivered message body, so the
// fan-out (fire_bulk_push) needs no awareness of content.
export async function sendBulkPushAction(
  input: SendBulkPushInput
): Promise<SendBulkPushResult> {
  // Bulk-push send is a tier-2-or-better action. requireStaffTier redirects
  // non-staff / under-tier callers before any work runs.
  const { supabase, userId, staff } = await requireStaffTier(2);
  // Defensive: keep the existing canSendBulkPush check as the source of truth.
  if (!canSendBulkPush(staff.access_tier)) {
    return {
      ok: false,
      error: "You do not have permission to send a bulk push.",
    };
  }

  const needsMessage =
    input.contentType === "message" || input.contentType === "both";
  const needsContent =
    input.contentType === "content" || input.contentType === "both";

  const title = input.messageTitle.trim();
  const body = input.messageBody.trim();
  if (needsMessage && (!title || !body)) {
    return { ok: false, error: "A title and message are required." };
  }
  if (needsContent && input.contentItemIds.length === 0) {
    return { ok: false, error: "Select at least one content item." };
  }

  // Compose the delivered message. Existing content is appended as a list
  // of titles + links so it lands in the patient's thread like any message.
  let finalTitle = title;
  let finalBody = body;
  let contentItemIds: string[] = [];
  if (needsContent) {
    // Re-fetch by id, but constrain to deliverable content: only post-op /
    // both audiences, and only active items — so pre-op-only or archived
    // content can't be slipped into a post-op cohort push.
    const { data: items } = await supabase
      .from("content_items")
      .select("id, type, title, body, media_url")
      .in("id", input.contentItemIds)
      .in("audience", ["post_op", "both"])
      .eq("active", true);
    const found = items ?? [];
    contentItemIds = found.map((i) => i.id);
    const block = found
      .map((i) => {
        const detail = i.media_url
          ? `\n${i.media_url}`
          : i.body
            ? `\n${i.body}`
            : "";
        return `• ${i.title}${detail}`;
      })
      .join("\n\n");
    if (input.contentType === "content") {
      finalTitle = "Recommended for you";
      finalBody = `Your care team has shared some content with you:\n\n${block}`;
    } else {
      finalBody = `${body}\n\n${block}`;
    }
  }

  let scheduledAt: string;
  if (input.scheduleMode === "later") {
    if (!input.scheduledAt) {
      return { ok: false, error: "Pick a date and time to schedule." };
    }
    const when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime())) {
      return { ok: false, error: "Invalid schedule time." };
    }
    if (when.getTime() <= Date.now()) {
      return { ok: false, error: "Schedule time must be in the future." };
    }
    scheduledAt = when.toISOString();
  } else {
    scheduledAt = new Date().toISOString();
  }

  const { data: push, error: insertError } = await supabase
    .from("bulk_pushes")
    .insert({
      sender_staff_id: userId,
      cohort_filter: input.cohortFilter as unknown as Json,
      cohort_summary: input.cohortSummary,
      content_type: input.contentType,
      content_item_ids: contentItemIds,
      message_title: finalTitle,
      message_body: finalBody,
      attachment_paths: input.attachmentPaths,
      scheduled_at: scheduledAt,
    })
    .select("id")
    .single();
  if (insertError || !push) {
    return {
      ok: false,
      error: insertError?.message ?? "Could not create the push.",
    };
  }

  if (input.scheduleMode === "now") {
    const { error: fireError } = await supabase.rpc("send_bulk_push_now", {
      p_push_id: push.id,
    });
    if (fireError) {
      return {
        ok: false,
        error: `Push created but delivery failed: ${fireError.message}`,
      };
    }
  }

  await recordStaffAudit(supabase, "bulkpush.sent", {
    entity_type: "bulk_push",
    entity_id: push.id,
    new_value: {
      cohort_filter: input.cohortFilter,
      cohort_summary: input.cohortSummary,
      content_type: input.contentType,
      content_item_count: contentItemIds.length,
      attachment_count: input.attachmentPaths.length,
      recipient_count: input.recipientCount,
      scheduled_at: scheduledAt,
      mode: input.scheduleMode,
    } as unknown as Json,
  });

  revalidatePath("/bulk-push");
  return { ok: true, pushId: push.id };
}
