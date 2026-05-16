import {
  attachmentFilename,
  attachmentKind,
  type MessageAttachment,
} from "@/lib/messages";

// Renders a message's attachments, switching on file type: images show
// inline, videos get a player, anything else is an open/download link.
export function MessageAttachments({
  attachments,
}: {
  attachments: ReadonlyArray<MessageAttachment>;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((a) => {
        if (!a.signed_url) {
          return (
            <span key={a.path} className="text-xs italic opacity-75">
              (attachment unavailable)
            </span>
          );
        }
        const kind = attachmentKind(a.path);
        if (kind === "image") {
          return (
            <a key={a.path} href={a.signed_url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.signed_url}
                alt="attachment"
                className="max-h-48 rounded-md"
              />
            </a>
          );
        }
        if (kind === "video") {
          return (
            <video
              key={a.path}
              src={a.signed_url}
              controls
              className="max-h-56 w-full max-w-xs rounded-md"
            />
          );
        }
        return (
          <a
            key={a.path}
            href={a.signed_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-black/10 px-3 py-2 text-xs font-medium underline"
          >
            📄 {attachmentFilename(a.path)}
          </a>
        );
      })}
    </div>
  );
}
