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
      .select("id, title, category, filename, storage_path, uploaded_at")
      .eq("patient_id", user.id),
    supabase.from("feedback").select("*").eq("patient_id", user.id),
    supabase
      .from("eye_photos")
      .select("id, recovery_day, check_in_id, captured_at, storage_path")
      .eq("patient_id", user.id),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("patient_id", user.id)
      .maybeSingle(),
  ]);

  const docRows = documents.data ?? [];
  const photoRows = eyePhotos.data ?? [];

  // Pull the actual files out of Storage, in parallel. A file that can't
  // be fetched is noted rather than failing the whole export.
  const failed: string[] = [];

  const docFiles = await Promise.all(
    docRows.map(async (d, i) => {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(d.storage_path);
      if (error || !data) {
        failed.push(d.filename ?? `document ${d.id}`);
        return null;
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      const prefix = String(i + 1).padStart(2, "0");
      return {
        name: `documents/${prefix}-${d.filename ?? `${d.id}.bin`}`,
        bytes,
      };
    })
  );

  const photoFiles = await Promise.all(
    photoRows.map(async (p, i) => {
      const { data, error } = await supabase.storage
        .from("patient-photos")
        .download(p.storage_path);
      if (error || !data) {
        failed.push(`eye photo ${p.id}`);
        return null;
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      const ext = p.storage_path.split(".").pop() || "jpg";
      const prefix = String(i + 1).padStart(2, "0");
      return {
        name: `eye-photos/day-${p.recovery_day ?? "x"}-${prefix}.${ext}`,
        bytes,
      };
    })
  );

  const payload = {
    exported_at: new Date().toISOString(),
    patient: patient.data,
    procedures: procedures.data ?? [],
    check_ins: checkIns.data ?? [],
    medications: medications.data ?? [],
    appointments: appointments.data ?? [],
    documents: docRows.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      filename: d.filename,
      uploaded_at: d.uploaded_at,
    })),
    feedback: feedback.data ?? [],
    eye_photos: photoRows.map((p) => ({
      id: p.id,
      recovery_day: p.recovery_day,
      check_in_id: p.check_in_id,
      captured_at: p.captured_at,
    })),
    preferences: preferences.data,
  };

  const zipInput: Record<string, Uint8Array> = {
    "my-data.json": strToU8(JSON.stringify(payload, null, 2)),
  };
  for (const f of docFiles) if (f) zipInput[f.name] = f.bytes;
  for (const f of photoFiles) if (f) zipInput[f.name] = f.bytes;
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
