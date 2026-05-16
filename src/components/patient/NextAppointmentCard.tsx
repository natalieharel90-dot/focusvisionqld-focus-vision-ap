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

// The next-appointment card on the patient home screen.
export function NextAppointmentCard({ appointment, clinicianName }: Props) {
  const awaitingTime =
    appointment.status === "to_book" || !appointment.scheduled_at;

  return (
    <section className="rounded-2xl bg-fv-bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-fv-bg-accent-soft text-fv-accent-strong">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18M8 2v4M16 2v4" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
            Your next appointment
          </div>
          {awaitingTime ? (
            <p className="mt-1 text-sm text-fv-text-secondary">
              Your next appointment will be booked by the clinic — we&apos;ll
              let you know once a time is confirmed.
            </p>
          ) : (
            <>
              <div className="mt-0.5 text-lg font-semibold leading-snug text-fv-text-primary">
                {formatAppointmentDateTime(appointment.scheduled_at as string)}
              </div>
              <div className="text-sm text-fv-text-secondary">
                {appointmentTypeLabel(appointment.appointment_type)}
                {clinicianName ? ` · ${clinicianName}` : ""}
                {appointment.location
                  ? ` · ${locationLabel(appointment.location)}`
                  : ""}
              </div>
              <a
                href={`/appointments/${appointment.id}/calendar`}
                download="focus-vision-appointment.ics"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-fv-accent-strong"
              >
                + Add to my calendar
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
