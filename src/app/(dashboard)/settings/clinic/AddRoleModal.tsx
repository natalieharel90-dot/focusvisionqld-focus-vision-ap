"use client";

import { useRef } from "react";

import { addRoleAction, deleteRoleAction } from "./actions";

type Role = { id: string; name: string };

// "+ Add role" button + the staff-roles dialog. Roles added here join
// every staff member's Role dropdown; removing one leaves already-
// assigned staff with their stored role label.
export function AddRoleModal({ roles }: { roles: Role[] }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-md border border-fv-border bg-fv-bg-card px-4 py-2 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
      >
        + Add role
      </button>

      <dialog
        ref={ref}
        className="w-full max-w-sm rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-base font-semibold text-fv-text-primary">
            Staff roles
          </h2>

          <form
            action={addRoleAction}
            onSubmit={() => ref.current?.close()}
            className="flex items-end gap-2"
          >
            <label className="flex-1">
              <span className="text-xs font-medium text-fv-text-secondary">
                New role
              </span>
              <input
                name="name"
                required
                placeholder="e.g. Practice Manager"
                className="mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
            >
              Add
            </button>
          </form>

          {roles.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {roles.map((role) => (
                <li
                  key={role.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-fv-bg-soft/40 px-3 py-2"
                >
                  <span className="text-sm text-fv-text-primary">
                    {role.name}
                  </span>
                  <form action={deleteRoleAction}>
                    <input type="hidden" name="role_id" value={role.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
            >
              Done
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
