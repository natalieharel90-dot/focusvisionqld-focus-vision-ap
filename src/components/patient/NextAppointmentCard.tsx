import {
  appointmentTypeLabel,
  formatAppointmentDateTime,
  locationLabel,
} from "@/lib/appointments";

type Props = {
  appointment: {
    id: string;
    appointment_type: string;
    scheduled_at: string | null;
    status: string;
    location: string | null;
  };
  clinicianName: string | null;
};

// The next-appointment card on the patient home screen. A 'to_book'
// appointment shows a friendly placeholder; a confirmed one shows the
// full details plus an "Add to calendar" (.ics) button.
export function NextAppointmentCard({ appointment, clinicianName }: Props) {
  const awaitingTime =
    appointment.status === "to_book" || !appointment.scheduled_at;

  return (
    <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
        <span aria-hidden>🗓️</span> Your next appointment
      </div>

      {awaitingTime ? (
        <p className="mt-2 text-sm text-fv-text-secondary">
          Your next appointment will be booked by the clinic — we&apos;ll let
          you know once a time is confirmed.
        </p>
      ) : (
        <>
          <div className="mt-1 text-lg font-semibold text-fv-text-primary">
            {formatAppointmentDateTime(appointment.scheduled_at as string)}
          </div>
          <div className="mt-0.5 text-sm text-fv-text-secondary">
            {appointmentTypeLabel(appointment.appointment_type)}
            {clinicianName ? ` · ${clinicianName}` : ""}
          </div>
          <div className="text-sm text-fv-text-secondary">
            {locationLabel(appointment.location)}
          </div>
          <a
            href={`/appointments/${appointment.id}/calendar`}
            download="focus-vision-appointment.ics"
            className="mt-3 inline-block rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Add to calendar
          </a>
        </>
      )}
    </section>
  );
}
