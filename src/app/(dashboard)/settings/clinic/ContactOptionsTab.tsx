import { visibleContactOptions } from "@/lib/contact";
import { ContactOptionModal, type ContactOption } from "./ContactOptionModal";
import { deleteContactOptionAction, moveContactOptionAction } from "./actions";

const ICON_GLYPH: Record<string, string> = {
  phone: "📞",
  message: "💬",
  calendar: "📅",
  map: "📍",
  clock: "🕐",
  link: "🔗",
};

export function ContactOptionsTab({
  options,
  canEdit,
}: {
  options: ContactOption[];
  canEdit: boolean;
}) {
  const preview = visibleContactOptions(options);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      {/* Editor list */}
      <div className="flex flex-col gap-3">
        {canEdit ? (
          <div className="flex justify-end">
            <ContactOptionModal option={null} />
          </div>
        ) : null}

        <ul className="flex flex-col gap-2">
          {options.map((o, i) => (
            <li
              key={o.id}
              className={`flex items-center gap-3 rounded-xl bg-fv-bg-card p-4 shadow-sm ${
                o.enabled ? "" : "opacity-50"
              }`}
            >
              <span aria-hidden className="text-lg">
                {ICON_GLYPH[o.icon] ?? "•"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fv-text-primary">
                  {o.label}
                  {o.is_required ? " 🔒" : ""}
                  {o.enabled ? "" : " · disabled"}
                </span>
                {o.subtitle ? (
                  <span className="block truncate text-xs text-fv-text-secondary">
                    {o.subtitle}
                  </span>
                ) : null}
              </span>
              {canEdit ? (
                <span className="flex shrink-0 items-center gap-1">
                  <MoveButton id={o.id} direction="up" disabled={i === 0} />
                  <MoveButton
                    id={o.id}
                    direction="down"
                    disabled={i === options.length - 1}
                  />
                  <ContactOptionModal option={o} />
                  {!o.is_required ? (
                    <form action={deleteContactOptionAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                      >
                        Delete
                      </button>
                    </form>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Live preview of the patient Contact screen */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
          Patient preview
        </div>
        <div className="mt-2 flex flex-col gap-2 rounded-2xl bg-fv-bg-app p-3">
          {preview.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-2 rounded-xl bg-fv-bg-card p-3 shadow-sm"
            >
              <span aria-hidden>{ICON_GLYPH[o.icon] ?? "•"}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fv-text-primary">
                  {o.label}
                </span>
                {o.subtitle ? (
                  <span className="block truncate text-xs text-fv-text-secondary">
                    {o.subtitle}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoveButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveContactOptionAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md border border-fv-border px-2 py-1 text-xs text-fv-text-secondary disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}
