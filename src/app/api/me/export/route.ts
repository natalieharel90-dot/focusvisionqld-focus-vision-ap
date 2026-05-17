import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Patient data export — returns a JSON copy of everything the signed-in
// patient has shared. Every query runs under the patient's RLS scope, so
// only their own rows are ever returned. Document/photo file contents are
// not included — only their metadata.
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [
    patient,
    procedures,
    checkIns,
    medications,
    appointments,
    documents,
    feedback,
    eyePhotos,
    preferences,
  ] = await Promise.all([
    supabase.from("patients").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("procedures").select("*").eq("patient_id", user.id),
    supabase.from("check_ins").select("*").eq("patient_id", user.id),
    supabase.from("medications").select("*").eq("patient_id", user.id),
    supabase.from("appointments").select("*").eq("patient_id", user.id),
    supabase
      .from("documents")
      .select("id, title, category, filename, uploaded_at")
      .eq("patient_id", user.id),
    supabase.from("feedback").select("*").eq("patient_id", user.id),
    supabase
      .from("eye_photos")
      .select("id, recovery_day, check_in_id, captured_at")
      .eq("patient_id", user.id),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("patient_id", user.id)
      .maybeSingle(),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    patient: patient.data,
    procedures: procedures.data ?? [],
    check_ins: checkIns.data ?? [],
    medications: medications.data ?? [],
    appointments: appointments.data ?? [],
    documents: documents.data ?? [],
    feedback: feedback.data ?? [],
    eye_photos: eyePhotos.data ?? [],
    preferences: preferences.data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition":
        'attachment; filename="focus-vision-my-data.json"',
    },
  });
}
