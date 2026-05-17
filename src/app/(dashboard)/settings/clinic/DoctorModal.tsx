"use client";

import { useRef } from "react";

import { addStaffAction } from "./actions";

export type Doctor = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  bio: string | null;
  active: boolean;
  welcome_video_url: string | null;
  welcome_message: string | null;
  is_invited_only: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const labelClass = "text-xs font-medium text-fv-text-secondary";

// "+ Add staff" button + dialog. A new staff member needs an auth
// account, so this posts to addStaffAction (Admin API, server-side).
export function DoctorModal({ roles }: { roles: string[] }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        + Add staff
      </button>

      <dialog
        ref={ref}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-fv-text-primary">
              Add staff member
            </h2>
            <p className="mt-0.5 text-xs text-fv-text-secondary">
              Creates their account. They appear in dropdowns immediately and
              can complete their own sign-in setup later.
            </p>
          </div>

          <form
            action={addStaffAction}
            onSubmit={() => ref.current?.close()}
            className="flex flex-col gap-3"
          >
            <label>
              <span className={labelClass}>Name</span>
              <input name="name" required className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Email</span>
              <input
                name="email"
                type="email"
                required
                placeholder="name@focusvision.com.au"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Role</span>
              <select
                name="role"
                defaultValue={(roles[0] ?? "Surgeon").toLowerCase()}
                className={inputClass}
              >
                {roles.map((r) => (
                  <option key={r} value={r.toLowerCase()}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => ref.current?.close()}
                className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
              >
                Add staff
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
