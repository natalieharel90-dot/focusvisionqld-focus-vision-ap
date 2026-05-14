import type { Database } from "@/types/database.types";
import type { MessageAttachment } from "@/lib/messages";

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

function fmt(ts: string): string {
  return new Date(ts).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      {messages.map((m) => {
        const isOwnSide = m.sender_type === viewerType;
        const sender =
          m.sender_type === "staff" ? staffById.get(m.sender_id) : null;
        const senderLabel =
          m.sender_type === "patient"
            ? "Patient"
            : sender
              ? `${sender.name} · ${sender.role}`
              : "Focus Vision team";
        const attachments = signedAttachmentsByMessage.get(m.id) ?? [];

        return (
          <li
            key={m.id}
            className={`flex flex-col ${
              isOwnSide ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                isOwnSide
                  ? "bg-fv-accent-strong text-white"
                  : "bg-fv-bg-card text-fv-text-primary"
              }`}
            >
              <div
                className={`mb-1 text-xs ${
                  isOwnSide ? "text-white/80" : "text-fv-text-secondary"
                }`}
              >
                {senderLabel} · {fmt(m.sent_at)}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
              {attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((a) =>
                    a.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        key={a.path}
                        href={a.signed_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={a.signed_url}
                          alt="attachment"
                          className="max-h-48 rounded-md"
                        />
                      </a>
                    ) : (
                      <span
                        key={a.path}
                        className="text-xs italic opacity-75"
                      >
                        (attachment unavailable)
                      </span>
                    )
                  )}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
