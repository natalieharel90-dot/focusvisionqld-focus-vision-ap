import { WEEKDAYS } from "@/lib/clinic-settings";
import type { Database } from "@/types/database.types";
import { saveClinicProfileAction } from "./actions";

type Profile = Database["public"]["Tables"]["clinic_profile"]["Row"];

const inputClass =
  "mt-1.5 w-full rounded-lg border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm focus:border-fv-accent focus:outline-none";
const labelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary";

export function ClinicProfileTab({
  profile,
  canEdit,
}: {
  profile: Profile | null;
  canEdit: boolean;
}) {
  if (!profile) {
    return (
      <p className="text-sm text-fv-text-secondary">
        No clinic profile row found.
      </p>
    );
  }

  const hours = (profile.opening_hours ?? {}) as Record<
    string,
    [string, string] | null
  >;

  return (
    <form action={saveClinicProfileAction} className="flex flex-col gap-5">
      <fieldset disabled={!canEdit} className="flex flex-col gap-5">
        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-fv-text-primary">
            Clinic details
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Clinic name</span>
              <input
                name="name"
                required
                defaultValue={profile.name}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>ABN</span>
              <input
                name="abn"
                defaultValue={profile.abn ?? ""}
                className={inputClass}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Address</span>
              <input
                name="address"
                required
                defaultValue={profile.address}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Main phone</span>
              <input
                name="phone"
                required
                defaultValue={profile.phone}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>After-hours emergency</span>
              <input
                name="after_hours_phone"
                required
                defaultValue={profile.after_hours_phone}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Email</span>
              <input
                name="email"
                type="email"
                defaultValue={profile.email ?? ""}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Website</span>
              <input
                name="website"
                defaultValue={profile.website ?? ""}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Timezone</span>
              <input
                value={profile.timezone}
                readOnly
                disabled
                className={`${inputClass} opacity-60`}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>After-hours message</span>
              <textarea
                name="after_hours_message"
                required
                rows={3}
                defaultValue={profile.after_hours_message}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-fv-text-primary">
            Opening hours
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {WEEKDAYS.map(([key, label]) => {
              const day = hours[key];
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-fv-text-primary">{label}</span>
                  <label className="flex items-center gap-1.5 text-xs text-fv-text-secondary">
                    <input
                      type="checkbox"
                      name={`${key}_open`}
                      defaultChecked={day != null}
                    />
                    Open
                  </label>
                  <input
                    type="time"
                    name={`${key}_start`}
                    defaultValue={day ? day[0] : "09:00"}
                    className="rounded-md border border-fv-bg-soft bg-fv-bg-app px-2 py-1 text-sm"
                  />
                  <span className="text-fv-text-secondary">to</span>
                  <input
                    type="time"
                    name={`${key}_end`}
                    defaultValue={day ? day[1] : "17:00"}
                    className="rounded-md border border-fv-bg-soft bg-fv-bg-app px-2 py-1 text-sm"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </fieldset>

      {canEdit ? (
        <button
          type="submit"
          className="self-start rounded-lg bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save clinic profile
        </button>
      ) : null}
    </form>
  );
}
