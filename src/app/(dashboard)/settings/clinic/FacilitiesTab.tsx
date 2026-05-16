import { FacilityModal, type Facility } from "./FacilityModal";
import { deleteFacilityAction } from "./actions";

// Initials of every word, capped at four — e.g. "South Brisbane Day
// Hospital" → "SBDH".
function facilityInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 4);
}

// Solid avatar colours — all dark enough to carry white initials. Picked
// per facility by hashing the name so each keeps a stable distinct hue.
const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-sky-700",
  "bg-violet-600",
  "bg-rose-600",
  "bg-teal-700",
  "bg-indigo-600",
  "bg-orange-700",
  "bg-fuchsia-700",
];

function colorFor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

export function FacilitiesTab({
  facilities,
  canEdit,
}: {
  facilities: Facility[];
  canEdit: boolean;
}) {
  return (
    <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-fv-text-primary">
            Day-surgery partner facilities
          </h2>
          <p className="mt-0.5 text-xs text-fv-text-secondary">
            Partner facilities where Focus Vision procedures are performed.
            These appear as feedback options in the patient app.
          </p>
        </div>
        {canEdit ? <FacilityModal facility={null} /> : null}
      </div>

      {facilities.length === 0 ? (
        <p className="mt-4 rounded-xl bg-fv-bg-soft/50 p-6 text-center text-sm text-fv-text-secondary">
          No partner facilities yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {facilities.map((facility) => (
            <div
              key={facility.id}
              className={`flex flex-wrap items-center gap-3.5 rounded-xl bg-fv-bg-soft/40 px-3.5 pb-3.5 pt-6 ${
                facility.active ? "" : "opacity-60"
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ${colorFor(
                  facility.name
                )}`}
              >
                {facilityInitials(facility.name)}
              </span>
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Name" value={facility.name} />
                <Field
                  label="Liaison email"
                  value={facility.liaison_email ?? "—"}
                />
                <Field label="Active" value={facility.active ? "Yes" : "No"} />
              </div>

              {canEdit ? (
                <div className="flex shrink-0 items-start gap-2">
                  <FacilityModal facility={facility} />
                  <details>
                    <summary className="cursor-pointer list-none rounded-lg border border-red-200 px-3 py-1.5 text-center text-xs font-semibold text-red-600 hover:bg-red-50">
                      Remove
                    </summary>
                    <form action={deleteFacilityAction} className="mt-1.5">
                      <input type="hidden" name="id" value={facility.id} />
                      <button
                        type="submit"
                        className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Yes, remove
                      </button>
                    </form>
                  </details>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// The uppercase label floats just above the value box (absolute) so the
// box itself sits in line with the avatar and the action buttons.
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative min-w-0">
      <span className="absolute -top-[15px] left-0 text-[10px] font-semibold uppercase tracking-wide text-fv-text-secondary">
        {label}
      </span>
      <div className="truncate rounded-lg border border-fv-bg-soft bg-fv-bg-app px-3 py-1.5 text-[13px] text-fv-text-primary">
        {value}
      </div>
    </div>
  );
}
