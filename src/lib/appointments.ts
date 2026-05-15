// Next-appointment card (patient home) + staff appointment panel — pure
// helpers for selecting the next appointment, friendly labels, and
// generating a calendar (.ics) file.

const TYPE_LABELS: Record<string, string> = {
  "1-week": "1-week follow-up",
  "1-month": "1-month follow-up",
  "3-month": "3-month follow-up",
  "6-month": "6-month follow-up",
  "12-month": "12-month follow-up",
  custom: "Follow-up appointment",
};

// Friendly label for an appointment type. Unknown (free-text) types are
// shown as entered.
export function appointmentTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

const LOCATION_LABELS: Record<string, string> = {
  in_clinic: "In clinic",
  phone: "Phone call",
  video: "Video call",
};

export function locationLabel(location: string | null | undefined): string {
  if (!location) return "Location to be confirmed";
  return LOCATION_LABELS[location] ?? location;
}

export type NextAppointmentCandidate = {
  status: string;
  scheduled_at: string | null;
  created_at: string;
};

// The patient's next upcoming appointment: status to_book or confirmed,
// not in the past. Ordered by scheduled_at (nulls last), then created_at.
// Returns null when there is no upcoming appointment (card is hidden).
export function selectNextAppointment<T extends NextAppointmentCandidate>(
  appointments: ReadonlyArray<T>,
  now: Date | string | number
): T | null {
  const nowMs = new Date(now).getTime();

  const upcoming = appointments.filter(
    (a) =>
      (a.status === "to_book" || a.status === "confirmed") &&
      (a.scheduled_at === null ||
        new Date(a.scheduled_at).getTime() >= nowMs)
  );

  upcoming.sort((a, b) => {
    const aNull = a.scheduled_at === null;
    const bNull = b.scheduled_at === null;
    if (aNull !== bNull) return aNull ? 1 : -1; // nulls last
    if (!aNull && !bNull) {
      const diff =
        new Date(a.scheduled_at as string).getTime() -
        new Date(b.scheduled_at as string).getTime();
      if (diff !== 0) return diff;
    }
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  return upcoming[0] ?? null;
}

// Has the patient exported this appointment to their device calendar?
export function wasCalendarExported(appointment: {
  calendar_exported_at: string | null;
}): boolean {
  return appointment.calendar_exported_at !== null;
}

// "Tuesday 9 June at 10:30am", in the given timezone (clinic time).
export function formatAppointmentDateTime(
  iso: string,
  timeZone = "Australia/Brisbane"
): string {
  const d = new Date(iso);
  const date = d
    .toLocaleDateString("en-AU", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .replace(",", "");
  const time = d
    .toLocaleTimeString("en-AU", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(" ", "");
  return `${date} at ${time}`;
}

// Escapes a value for an iCalendar text property (RFC 5545 §3.3.11).
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Compact UTC stamp for iCalendar date-times: YYYYMMDDTHHMMSSZ.
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type AppointmentIcsInput = {
  appointmentId: string;
  appointmentType: string; // friendly label
  scheduledAt: string; // ISO
  clinicianName: string | null;
  location: string | null; // friendly location label
  locationAddress: string | null;
  durationMinutes?: number;
};

// Builds a valid iCalendar (.ics) document for one appointment, with a
// 30-minute reminder alarm.
export function buildAppointmentIcs(input: AppointmentIcsInput): string {
  const start = new Date(input.scheduledAt);
  const end = new Date(
    start.getTime() + (input.durationMinutes ?? 30) * 60_000
  );
  const title = `Focus Vision — ${input.appointmentType}`;

  const descriptionParts: string[] = [];
  if (input.clinicianName) {
    descriptionParts.push(`With ${input.clinicianName}`);
  }
  if (input.location) descriptionParts.push(input.location);
  const description = descriptionParts.join(" \\n ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Focus Vision//Recovery Companion//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.appointmentId}@focusvision`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
  ];
  if (input.locationAddress) {
    lines.push(`LOCATION:${escapeIcs(input.locationAddress)}`);
  }
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  );
  // iCalendar requires CRLF line endings.
  return lines.join("\r\n");
}
