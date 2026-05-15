import { TemplateModal, type Template } from "./TemplateModal";
import { moveTemplateAction, toggleTemplateActiveAction } from "./actions";

export function TemplatesTab({
  templates,
  canEdit,
}: {
  templates: Template[];
  canEdit: boolean;
}) {
  // Group by category, preserving the incoming (category, order_index) sort.
  const groups = new Map<string, Template[]>();
  for (const t of templates) {
    const key = t.category ?? "general";
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  return (
    <div className="flex flex-col gap-5">
      {canEdit ? (
        <div className="flex justify-end">
          <TemplateModal template={null} />
        </div>
      ) : null}

      {templates.length === 0 ? (
        <p className="rounded-xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No message templates yet.
        </p>
      ) : (
        [...groups.entries()].map(([category, rows]) => (
          <section key={category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {category}
            </h2>
            <ul className="flex flex-col gap-2">
              {rows.map((t, i) => (
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
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
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
