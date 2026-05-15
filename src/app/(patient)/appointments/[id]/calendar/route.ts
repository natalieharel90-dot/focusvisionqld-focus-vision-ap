import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  appointmentTypeLabel,
  buildAppointmentIcs,
  locationLabel,
} from "@/lib/appointments";

export const dynamic = "force-dynamic";

// Generates the .ics file for one of the patient's confirmed appointments,
// records the calendar export, and audit-logs it. The download itself is
// the export, so it's safe to treat this GET as the export action.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: appt } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, appointment_type, scheduled_at, clinician_id, location, location_address, status"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (
    !appt ||
    appt.patient_id !== user.id ||
    appt.status !== "confirmed" ||
    !appt.scheduled_at
  ) {
    return new NextResponse("Appointment not available", { status: 404 });
  }

  let clinicianName: string | null = null;
  if (appt.clinician_id) {
    const { data: clinician } = await supabase
      .from("staff_users")
      .select("name")
      .eq("id", appt.clinician_id)
      .maybeSingle();
    clinicianName = clinician?.name ?? null;
  }

  const ics = buildAppointmentIcs({
    appointmentId: appt.id,
    appointmentType: appointmentTypeLabel(appt.appointment_type),
    scheduledAt: appt.scheduled_at,
    clinicianName,
    location: appt.location ? locationLabel(appt.location) : null,
    locationAddress: appt.location_address,
  });

  await supabase
    .from("appointments")
    .update({ calendar_exported_at: new Date().toISOString() })
    .eq("id", appt.id);

  await supabase.rpc("record_patient_audit_event", {
    p_event_type: "patient.appointment_calendar_exported",
    p_entity_type: "appointment",
    p_new_value: {},
    p_entity_id: appt.id,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="focus-vision-appointment.ics"',
    },
  });
}
