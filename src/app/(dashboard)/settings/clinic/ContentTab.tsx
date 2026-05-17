import { filterContentItems } from "@/lib/clinic-settings";
import { ContentModal, type ContentItem } from "./ContentModal";
import { toggleContentItemActiveAction } from "./actions";

const selectClass =
  "rounded-md border border-fv-border bg-fv-bg-app px-2 py-1 text-sm";

export function ContentTab({
  items,
  canEdit,
  filter,
}: {
  items: ContentItem[];
  canEdit: boolean;
  filter: { audience: string; procedure: string; type: string };
}) {
  const visible = filterContentItems(items, {
    audience: filter.audience,
    procedure: filter.procedure,
    type: filter.type,
    includeInactive: true,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters — a GET form reloads the tab with query params. */}
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="content" />
          <select name="audience" defaultValue={filter.audience} className={selectClass}>
            <option value="all">All audiences</option>
            <option value="pre_op">Pre-op</option>
            <option value="post_op">Post-op</option>
            <option value="both">Both</option>
          </select>
          <select name="procedure" defaultValue={filter.procedure} className={selectClass}>
            <option value="all">All procedures</option>
            {["lasik", "prk", "smile", "cataract", "icl"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={filter.type} className={selectClass}>
            <option value="all">All types</option>
            <option value="article">Article</option>
            <option value="video">Video</option>
            <option value="faq">FAQ</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-fv-border px-3 py-1 text-sm font-medium text-fv-text-primary"
          >
            Filter
          </button>
        </form>
        {canEdit ? <ContentModal item={null} /> : null}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No content items match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li
              key={item.id}
              className={`flex items-start justify-between gap-3 rounded-xl bg-fv-bg-card p-4 shadow-sm ${
                item.active ? "" : "opacity-50"
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-fv-text-primary">
                  {item.type === "video" ? "▶️" : "📄"} {item.title}
                  {item.active ? "" : " · archived"}
                </div>
                <div className="mt-0.5 text-xs text-fv-text-secondary">
                  {item.audience}
                  {item.procedures.length
                    ? ` · ${item.procedures.join(", ")}`
                    : ""}
                  {item.days_range ? ` · days ${item.days_range}` : ""}
                </div>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 items-center gap-2">
                  <form action={toggleContentItemActiveAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={(!item.active).toString()}
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-fv-border px-2 py-1 text-xs text-fv-text-secondary"
                    >
                      {item.active ? "Archive" : "Restore"}
                    </button>
                  </form>
                  <ContentModal item={item} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
