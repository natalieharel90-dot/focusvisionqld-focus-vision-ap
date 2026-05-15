"use client";

import { useRef } from "react";

import { wasCalendarExported } from "@/lib/appointments";
import {
  messagePatientAboutAppointmentAction,
  updateAppointmentAction,
} from "./actions";

type Appointment = {
  id: string;
  appointment_type: string;
  scheduled_at: string | null;
  status: string;
  location: string | null;
  location_address: string | null;
  clinician_id: string | null;
  calendar_exported_at: string | null;
};

type Props = {
  patientId: string;
  appointment: Appointment;
  clinicians: { id: string; name: string }[];
};

// Converts a stored UTC timestamp to the value a datetime-local input
// expects (local wall-clock time).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const field =
  "rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5 text-sm";
const fieldLabel = "text-xs text-fv-text-secondary";

export function NextAppointmentModal({
  patientId,
  appointment,
  clinicians,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const exported = wasCalendarExported(appointment);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md border border-fv-bg-soft px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
      >
        Edit / Reschedule
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold text-fv-text-primary">
              Edit appointment
            </h2>
          </header>

          <form
            action={updateAppointmentAction}
            onSubmit={() => dialogRef.current?.close()}
            className="grid grid-cols-2 gap-3"
          >
            <input type="hidden" name="patient_id" value={patientId} />
            <input
              type="hidden"
              name="appointment_id"
              value={appointment.id}
            />

            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Status</span>
              <select
                name="status"
                defaultValue={appointment.status}
                className={field}
              >
                <option value="to_book">To book</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Date &amp; time</span>
              <input
                type="datetime-local"
                name="scheduled_at"
                defaultValue={toLocalInput(appointment.scheduled_at)}
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Location</span>
              <select
                name="location"
                defaultValue={appointment.location ?? ""}
                className={field}
              >
                <option value="">—</option>
                <option value="in_clinic">In clinic</option>
                <option value="phone">Phone</option>
                <option value="video">Video</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Clinician</span>
              <select
                name="clinician_id"
                defaultValue={appointment.clinician_id ?? ""}
                className={field}
              >
                <option value="">—</option>
                {clinicians.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="col-span-2 flex flex-col gap-1">
              <span className={fieldLabel}>Location address (optional)</span>
              <input
                type="text"
                name="location_address"
                defaultValue={appointment.location_address ?? ""}
                placeholder="123 Vision Way, Brisbane QLD"
                className={field}
              />
            </label>

            <div className="col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
              >
                Save changes
              </button>
            </div>
          </form>

          {exported ? (
            <div className="rounded-md bg-fv-bg-soft p-3">
              <p className="text-xs text-fv-text-secondary">
                Patient has added this appointment to their calendar.
                Rescheduling won&apos;t update their device — they&apos;ll
                need to re-export.
              </p>
              <form
                action={messagePatientAboutAppointmentAction}
                onSubmit={() => dialogRef.current?.close()}
                className="mt-2"
              >
                <input type="hidden" name="patient_id" value={patientId} />
                <button
                  type="submit"
                  className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
                >
                  Send patient a message about the change
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
