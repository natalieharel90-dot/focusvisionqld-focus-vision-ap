import type { Database } from "@/types/database.types";
import type { MessageAttachment } from "@/lib/messages";
import { MessageAttachments } from "./MessageAttachments";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type StaffSummary = Pick<
  Database["public"]["Tables"]["staff_users"]["Row"],
  "id" | "name" | "role"
>;

type Props = {
  messages: ReadonlyArray<Message>;
  staffById: ReadonlyMap<string, StaffSummary>;
  // Attachments per-message id, signed for display.
  signedAttachmentsByMessage: ReadonlyMap<string, ReadonlyArray<MessageAttachment>>;
  // The viewer's role decides which side messages bubble on.
  viewerType: "patient" | "staff";
};

// Local calendar-day key, e.g. "2026-05-17".
function dayKey(ts: string): string {
  return new Date(ts).toLocaleDateString("en-CA");
}

// "Today" / "Yesterday" / "Mon 12 May" for a day separator.
function dayLabel(ts: string): string {
  const key = dayKey(ts);
  if (key === new Date().toLocaleDateString("en-CA")) return "Today";
  if (key === new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA")) {
    return "Yesterday";
  }
  return new Date(ts).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function titleCase(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export function MessageList({
  messages,
  staffById,
  signedAttachmentsByMessage,
  viewerType,
}: Props) {
  if (messages.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-fv-text-secondary">
        No messages yet. Send one below to start the conversation.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {messages.map((m, i) => {
        const isOwnSide = m.sender_type === viewerType;
        const sender =
          m.sender_type === "staff" ? staffById.get(m.sender_id) : null;

        // Sender + time + (own only) delivery status — shown below the
        // bubble, aligned to its side.
        let meta: string;
        if (isOwnSide) {
          meta = `You · ${fmtTime(m.sent_at)} · ${
            m.read_at ? "Read ✓" : "Sent"
          }`;
        } else if (m.sender_type === "patient") {
          meta = `Patient · ${fmtTime(m.sent_at)}`;
        } else if (m.bulk_push_id || !sender) {
          meta = `Focus Vision team · ${fmtTime(m.sent_at)}`;
        } else {
          meta = `${sender.name} (${titleCase(sender.role)}) · ${fmtTime(
            m.sent_at
          )}`;
        }

        const attachments = signedAttachmentsByMessage.get(m.id) ?? [];
        const prev = i > 0 ? messages[i - 1] : null;
        const showDay = !prev || dayKey(prev.sent_at) !== dayKey(m.sent_at);

        return (
          <li key={m.id} className="flex flex-col gap-3">
            {showDay ? (
              <div className="text-center text-xs font-semibold text-fv-text-secondary">
                {dayLabel(m.sent_at)}
              </div>
            ) : null}
            <div
              className={`flex flex-col ${
                isOwnSide ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  isOwnSide
                    ? "bg-fv-accent-strong text-white"
                    : "bg-fv-bg-soft text-fv-text-primary"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.body}
                </div>
                <MessageAttachments attachments={attachments} />
              </div>
              <div className="mt-1 px-1 text-xs text-fv-text-secondary">
                {meta}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
