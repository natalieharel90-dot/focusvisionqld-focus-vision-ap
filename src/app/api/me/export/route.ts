import { NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
// Bundling the files can take a little while when a patient has many
// check-in photos, so allow more than the default execution time.
export const maxDuration = 60;

// Patient data export — returns a ZIP containing a JSON copy of everything
// the signed-in patient has shared, plus their actual document and
// eye-photo files. Every query runs under the patient's RLS scope, so only
// their own rows and files are ever returned.
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
    feedback,
    preferences,
  ] = await Promise.all([
    supabase.from("patients").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("procedures").select("*").eq("patient_id", user.id),
    supabase.from("check_ins").select("*").eq("patient_id", user.id),
    supabase.from("medications").select("*").eq("patient_id", user.id),
    supabase.from("appointments").select("*").eq("patient_id", user.id),
    supabase.from("feedback").select("*").eq("patient_id", user.id),
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
    feedback: feedback.data ?? [],
    preferences: preferences.data,
  };

  const zipInput: Record<string, Uint8Array> = {
    "my-data.json": strToU8(JSON.stringify(payload, null, 2)),
  };
  // Earlier exports bundled uploaded documents and eye photos from
  // Storage — both surfaces are removed from the app, so the export
  // is now just the JSON summary.
  const failed: string[] = [];
  if (failed.length > 0) {
    zipInput["UNAVAILABLE-FILES.txt"] = strToU8(
      "These files could not be included in this export:\n" +
        failed.map((f) => `- ${f}`).join("\n") +
        "\n\nPlease contact the clinic if you need a copy of them."
    );
  }

  const zip = zipSync(zipInput);

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        'attachment; filename="focus-vision-my-data.zip"',
    },
  });
}
