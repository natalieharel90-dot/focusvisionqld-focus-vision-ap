import { describe, expect, it } from "vitest";

import {
  addDays,
  appointmentTimestamp,
  buildTemplateInserts,
  parseTemplateAppointments,
  parseTemplateMedications,
  type TemplateData,
} from "./templates";

const SURGERY_DATE = "2026-05-15";
const PATIENT_ID = "patient-uuid-123";

const sampleTemplate: TemplateData = {
  id: "template-uuid-abc",
  surgeon_id: "surgeon-uuid-1",
  procedure_type: "lasik",
  default_medications: [
    {
      name: "Pred Forte 1%",
      dose: "1 drop",
      route: "topical eye",
      frequency: "4x daily",
      scheduled_times: ["08:00", "12:00", "16:00", "20:00"],
      duration_days: 14,
      taper_notes: "Taper after week 1",
    },
    {
      name: "Artificial tears",
      dose: "1 drop",
      route: "topical eye",
      frequency: "6x daily",
      scheduled_times: ["08:00", "20:00"],
      duration_days: null, // ongoing — no end date
      taper_notes: null,
    },
  ],
  default_appointments: [
    {
      appointment_type: "1-week",
      days_after_surgery: 7,
      location: "in_clinic",
      notes: null,
    },
    {
      appointment_type: "1-month",
      days_after_surgery: 30,
      location: "in_clinic",
      notes: "Bring sunglasses",
    },
  ],
};

describe("addDays", () => {
  it("adds whole days within a month", () => {
    expect(addDays("2026-05-15", 14)).toBe("2026-05-29");
  });
  it("rolls across a month boundary", () => {
    expect(addDays("2026-05-25", 10)).toBe("2026-06-04");
  });
  it("zero days is a no-op", () => {
    expect(addDays("2026-05-15", 0)).toBe("2026-05-15");
  });
});

describe("appointmentTimestamp", () => {
  it("produces a timestamp N days after surgery", () => {
    const ts = appointmentTimestamp("2026-05-15", 7);
    // 2026-05-22 09:00 Brisbane (UTC+10) == 2026-05-21T23:00:00Z
    expect(ts).toBe("2026-05-21T23:00:00.000Z");
  });
});

describe("buildTemplateInserts — medications", () => {
  it("materialises one medication row per template medication", () => {
    const { medications } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(medications).toHaveLength(2);
  });

  it("computes end_date from duration_days", () => {
    const { medications } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(medications[0]?.end_date).toBe("2026-05-29"); // 15 + 14
  });

  it("leaves end_date null when duration_days is null (ongoing)", () => {
    const { medications } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(medications[1]?.end_date).toBeNull();
  });

  it("stamps every medication with source_template_id", () => {
    const { medications } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    for (const m of medications) {
      expect(m.source_template_id).toBe("template-uuid-abc");
      expect(m.patient_id).toBe(PATIENT_ID);
      expect(m.start_date).toBe(SURGERY_DATE);
    }
  });

  it("carries dose / route / frequency / scheduled_times through unchanged", () => {
    const { medications } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(medications[0]).toMatchObject({
      name: "Pred Forte 1%",
      dose: "1 drop",
      route: "topical eye",
      frequency: "4x daily",
      scheduled_times: ["08:00", "12:00", "16:00", "20:00"],
      taper_notes: "Taper after week 1",
    });
  });
});

describe("buildTemplateInserts — appointments", () => {
  it("materialises one appointment row per template appointment", () => {
    const { appointments } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(appointments).toHaveLength(2);
  });

  it("schedules every appointment as to_book (suggestion, not confirmed)", () => {
    const { appointments } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    for (const a of appointments) {
      expect(a.status).toBe("to_book");
    }
  });

  it("computes scheduled_at from days_after_surgery", () => {
    const { appointments } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(appointments[0]?.scheduled_at).toBe("2026-05-21T23:00:00.000Z");
  });

  it("stamps every appointment with source_template_id", () => {
    const { appointments } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    for (const a of appointments) {
      expect(a.source_template_id).toBe("template-uuid-abc");
    }
  });
});

describe("buildTemplateInserts — empty template", () => {
  it("returns empty arrays when the template has no defaults", () => {
    const empty: TemplateData = {
      ...sampleTemplate,
      default_medications: [],
      default_appointments: [],
    };
    const { medications, appointments } = buildTemplateInserts(
      empty,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(medications).toEqual([]);
    expect(appointments).toEqual([]);
  });
});

describe("historical source_template_id linkage", () => {
  // The per-patient override pattern: after a template is applied, staff
  // may edit (or stop) an individual medication. source_template_id is
  // written ONCE at insert time and never updated, so the historical
  // link survives any later per-patient mutation. This test documents
  // that buildTemplateInserts is the only place the stamp is set.
  it("source_template_id is derived purely from the template id at build time", () => {
    const { medications, appointments } = buildTemplateInserts(
      sampleTemplate,
      PATIENT_ID,
      SURGERY_DATE
    );
    // Every row links to exactly the template that produced it.
    const allLinks = [
      ...medications.map((m) => m.source_template_id),
      ...appointments.map((a) => a.source_template_id),
    ];
    expect(new Set(allLinks)).toEqual(new Set(["template-uuid-abc"]));
  });

  it("applying a different template stamps a different id (no cross-contamination)", () => {
    const other: TemplateData = { ...sampleTemplate, id: "template-uuid-xyz" };
    const { medications } = buildTemplateInserts(
      other,
      PATIENT_ID,
      SURGERY_DATE
    );
    expect(medications[0]?.source_template_id).toBe("template-uuid-xyz");
  });
});

describe("parseTemplateMedications", () => {
  it("parses well-formed JSON", () => {
    const parsed = parseTemplateMedications([
      {
        name: "Pred Forte",
        dose: "1 drop",
        route: "eye",
        frequency: "4x",
        scheduled_times: ["08:00"],
        duration_days: 14,
        taper_notes: "x",
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("Pred Forte");
  });

  it("drops entries with no name", () => {
    const parsed = parseTemplateMedications([
      { dose: "1 drop" },
      { name: "Valid", dose: "1 drop" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("Valid");
  });

  it("returns [] for non-array input", () => {
    expect(parseTemplateMedications(null)).toEqual([]);
    expect(parseTemplateMedications("nonsense")).toEqual([]);
    expect(parseTemplateMedications({})).toEqual([]);
  });

  it("coerces missing optional fields to safe defaults", () => {
    const parsed = parseTemplateMedications([{ name: "Bare" }]);
    expect(parsed[0]).toMatchObject({
      name: "Bare",
      dose: "",
      scheduled_times: [],
      duration_days: null,
      taper_notes: null,
    });
  });
});

describe("parseTemplateAppointments", () => {
  it("parses well-formed JSON", () => {
    const parsed = parseTemplateAppointments([
      {
        appointment_type: "1-week",
        days_after_surgery: 7,
        location: "in_clinic",
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.location).toBe("in_clinic");
  });

  it("nulls out an invalid location", () => {
    const parsed = parseTemplateAppointments([
      { appointment_type: "1-week", days_after_surgery: 7, location: "moon" },
    ]);
    expect(parsed[0]?.location).toBeNull();
  });

  it("drops entries with no appointment_type", () => {
    const parsed = parseTemplateAppointments([
      { days_after_surgery: 7 },
      { appointment_type: "1-month", days_after_surgery: 30 },
    ]);
    expect(parsed).toHaveLength(1);
  });
});
