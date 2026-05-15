import { describe, expect, it } from "vitest";

import {
  type NextAppointmentCandidate,
  appointmentTypeLabel,
  buildAppointmentIcs,
  locationLabel,
  selectNextAppointment,
  wasCalendarExported,
} from "./appointments";

type Appt = NextAppointmentCandidate & { id: string };

function appt(o: Partial<Appt> & { id: string }): Appt {
  return {
    status: "confirmed",
    scheduled_at: "2026-06-09T00:30:00Z",
    created_at: "2026-05-01T00:00:00Z",
    ...o,
  };
}

const NOW = "2026-05-20T00:00:00Z";

describe("selectNextAppointment", () => {
  it("hides the card when there are no appointments", () => {
    expect(selectNextAppointment([], NOW)).toBeNull();
  });

  it("ignores completed, cancelled and past appointments", () => {
    const rows = [
      appt({ id: "done", status: "completed" }),
      appt({ id: "cancelled", status: "cancelled" }),
      appt({
        id: "past",
        status: "confirmed",
        scheduled_at: "2026-05-01T00:00:00Z",
      }),
    ];
    expect(selectNextAppointment(rows, NOW)).toBeNull();
  });

  it("returns a to_book appointment with no scheduled time", () => {
    const rows = [appt({ id: "tobook", status: "to_book", scheduled_at: null })];
    expect(selectNextAppointment(rows, NOW)?.id).toBe("tobook");
  });

  it("returns an upcoming confirmed appointment", () => {
    expect(
      selectNextAppointment([appt({ id: "soon" })], NOW)?.id
    ).toBe("soon");
  });

  it("prefers a scheduled appointment over a to_book one (nulls last)", () => {
    const rows = [
      appt({ id: "tobook", status: "to_book", scheduled_at: null }),
      appt({ id: "confirmed", status: "confirmed" }),
    ];
    expect(selectNextAppointment(rows, NOW)?.id).toBe("confirmed");
  });

  it("picks the earliest scheduled appointment", () => {
    const rows = [
      appt({ id: "later", scheduled_at: "2026-07-01T00:00:00Z" }),
      appt({ id: "sooner", scheduled_at: "2026-06-09T00:30:00Z" }),
    ];
    expect(selectNextAppointment(rows, NOW)?.id).toBe("sooner");
  });

  it("breaks ties between to_book rows by created_at", () => {
    const rows = [
      appt({
        id: "newer",
        status: "to_book",
        scheduled_at: null,
        created_at: "2026-05-10T00:00:00Z",
      }),
      appt({
        id: "older",
        status: "to_book",
        scheduled_at: null,
        created_at: "2026-05-02T00:00:00Z",
      }),
    ];
    expect(selectNextAppointment(rows, NOW)?.id).toBe("older");
  });
});

describe("labels", () => {
  it("gives friendly appointment type labels", () => {
    expect(appointmentTypeLabel("1-week")).toBe("1-week follow-up");
    expect(appointmentTypeLabel("12-month")).toBe("12-month follow-up");
    expect(appointmentTypeLabel("Pre-op consult")).toBe("Pre-op consult");
  });

  it("gives friendly location labels", () => {
    expect(locationLabel("in_clinic")).toBe("In clinic");
    expect(locationLabel("video")).toBe("Video call");
    expect(locationLabel(null)).toBe("Location to be confirmed");
  });
});

describe("wasCalendarExported", () => {
  it("is true only when calendar_exported_at is set", () => {
    expect(wasCalendarExported({ calendar_exported_at: null })).toBe(false);
    expect(
      wasCalendarExported({ calendar_exported_at: "2026-05-20T00:00:00Z" })
    ).toBe(true);
  });
});

describe("buildAppointmentIcs — valid iCalendar", () => {
  const ics = buildAppointmentIcs({
    appointmentId: "appt-1",
    appointmentType: "1-week follow-up",
    scheduledAt: "2026-06-09T00:30:00.000Z",
    clinicianName: "Dr Maria Chen",
    location: "In clinic",
    locationAddress: "123 Vision Way, Brisbane QLD",
  });
  const lines = ics.split("\r\n");

  it("uses CRLF line endings", () => {
    expect(ics).toContain("\r\n");
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("opens and closes the calendar, event and alarm blocks", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
    for (const tag of ["VEVENT", "VALARM"]) {
      expect(lines).toContain(`BEGIN:${tag}`);
      expect(lines).toContain(`END:${tag}`);
    }
  });

  it("carries the required calendar + event properties", () => {
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("UID:appt-1@focusvision");
    expect(lines).toContain("SUMMARY:Focus Vision — 1-week follow-up");
    expect(lines).toContain("LOCATION:123 Vision Way\\, Brisbane QLD");
  });

  it("sets DTSTART/DTEND in UTC stamp format, 30 minutes apart", () => {
    const start = lines.find((l) => l.startsWith("DTSTART:"));
    const end = lines.find((l) => l.startsWith("DTEND:"));
    expect(start).toBe("DTSTART:20260609T003000Z");
    expect(end).toBe("DTEND:20260609T010000Z");
  });

  it("includes a 30-minute reminder alarm", () => {
    expect(lines).toContain("TRIGGER:-PT30M");
    expect(lines).toContain("ACTION:DISPLAY");
  });

  it("omits LOCATION when there is no address", () => {
    const noAddr = buildAppointmentIcs({
      appointmentId: "appt-2",
      appointmentType: "Phone check-in",
      scheduledAt: "2026-06-09T00:30:00.000Z",
      clinicianName: null,
      location: "Phone call",
      locationAddress: null,
    });
    expect(noAddr).not.toContain("LOCATION:");
  });
});
