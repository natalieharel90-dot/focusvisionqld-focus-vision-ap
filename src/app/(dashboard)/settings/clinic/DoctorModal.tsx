"use client";

import { useRef } from "react";

import { initials } from "@/lib/bulk-push";
import { DOCTOR_ROLES } from "@/lib/clinic-settings";
import { saveDoctorAction, toggleDoctorActiveAction } from "./actions";

export type Doctor = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  bio: string | null;
  active: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const labelClass = "text-xs font-medium text-fv-text-secondary";

// Card-or-add-button trigger plus the doctor add/edit dialog.
export function DoctorModal({ doctor }: { doctor: Doctor | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inactive = doctor != null && !doctor.active;

  return (
    <>
      {doctor ? (
        <button
          type="button"
          onClick={() => ref.current?.showModal()}
          className={`flex w-full items-center gap-3 rounded-xl bg-fv-bg-card p-4 text-left shadow-sm hover:shadow ${
            inactive ? "opacity-50" : ""
          }`}
        >
          <Avatar doctor={doctor} />
          <span>
            <span className="block text-sm font-semibold text-fv-text-primary">
              {doctor.name}
            </span>
            <span className="block text-xs text-fv-text-secondary">
              {doctor.role}
              {inactive ? " · inactive" : ""}
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.showModal()}
          className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Add doctor
        </button>
      )}

      <dialog
        ref={ref}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-base font-semibold text-fv-text-primary">
            {doctor ? "Edit doctor" : "Add doctor"}
          </h2>

          <form
            action={saveDoctorAction}
            onSubmit={() => ref.current?.close()}
            className="grid grid-cols-2 gap-3"
          >
            {doctor ? (
              <input type="hidden" name="id" value={doctor.id} />
            ) : null}
            {doctor?.photo_url ? (
              <input
                type="hidden"
                name="photo_url"
                value={doctor.photo_url}
              />
            ) : null}

            <label className="col-span-2">
              <span className={labelClass}>Name</span>
              <input
                name="name"
                required
                defaultValue={doctor?.name ?? ""}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Role</span>
              <select
                name="role"
                defaultValue={doctor?.role ?? "Surgeon"}
                className={inputClass}
              >
                {DOCTOR_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Phone</span>
              <input
                name="phone"
                defaultValue={doctor?.phone ?? ""}
                className={inputClass}
              />
            </label>
            <label className="col-span-2">
              <span className={labelClass}>Email</span>
              <input
                name="email"
                type="email"
                defaultValue={doctor?.email ?? ""}
                className={inputClass}
              />
            </label>
            <label className="col-span-2">
              <span className={labelClass}>
                Photo {doctor?.photo_url ? "(replace)" : "(upload)"}
              </span>
              <input
                type="file"
                name="photo"
                accept="image/*"
                className={inputClass}
              />
            </label>
            <label className="col-span-2">
              <span className={labelClass}>Bio</span>
              <textarea
                name="bio"
                rows={3}
                defaultValue={doctor?.bio ?? ""}
                className={inputClass}
              />
            </label>

            <div className="col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => ref.current?.close()}
                className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
              >
                Cancel
              </button>
              {!inactive ? (
                <button
                  type="submit"
                  className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
                >
                  {doctor ? "Save" : "Add doctor"}
                </button>
              ) : null}
            </div>
          </form>

          {doctor ? (
            <form
              action={toggleDoctorActiveAction}
              onSubmit={() => ref.current?.close()}
              className="border-t border-fv-bg-soft pt-3"
            >
              <input type="hidden" name="id" value={doctor.id} />
              <input
                type="hidden"
                name="active"
                value={inactive ? "true" : "false"}
              />
              <button
                type="submit"
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  inactive
                    ? "bg-fv-accent-strong text-white"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {inactive ? "Reactivate doctor" : "Deactivate (soft-delete)"}
              </button>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

function Avatar({ doctor }: { doctor: Doctor }) {
  if (doctor.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={doctor.photo_url}
        alt={doctor.name}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fv-bg-soft text-sm font-semibold text-fv-text-secondary">
      {initials(doctor.name)}
    </span>
  );
}
