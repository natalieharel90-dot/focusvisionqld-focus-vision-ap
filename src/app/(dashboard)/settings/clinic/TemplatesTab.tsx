import { TemplateModal, type Template } from "./TemplateModal";
import { moveTemplateAction, toggleTemplateActiveAction } from "./actions";

export function TemplatesTab({
  templates,
  canEdit,
}: {
  templates: Template[];
  canEdit: boolean;
}) {
  // Group by category so the within-category reorder keeps working, but
  // present every template under one "Message Templates" heading.
  const groups = new Map<string, Template[]>();
  for (const t of templates) {
    const key = t.category ?? "general";
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-fv-text-primary">
          Message Templates
        </h2>
        {canEdit ? <TemplateModal template={null} /> : null}
      </div>

      {templates.length === 0 ? (
        <p className="mt-4 rounded-xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No message templates yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {[...groups.entries()].flatMap(([category, rows]) =>
            rows.map((t, i) => (
              <li
                key={t.id}
                className={`rounded-xl bg-fv-bg-card p-4 shadow-sm ${
                  t.active ? "" : "opacity-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-fv-text-primary">
                      {t.label}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-fv-text-secondary">
                      {t.body}
                    </div>
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <ReorderButton
                        id={t.id}
                        category={category}
                        direction="up"
                        disabled={i === 0}
                      />
                      <ReorderButton
                        id={t.id}
                        category={category}
                        direction="down"
                        disabled={i === rows.length - 1}
                      />
                      <form action={toggleTemplateActiveAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={(!t.active).toString()}
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-fv-border px-2 py-1 text-xs text-fv-text-secondary"
                        >
                          {t.active ? "Disable" : "Enable"}
                        </button>
                      </form>
                      <TemplateModal template={t} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}

function ReorderButton({
  id,
  category,
  direction,
  disabled,
}: {
  id: string;
  category: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveTemplateAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="category" value={category} />
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
