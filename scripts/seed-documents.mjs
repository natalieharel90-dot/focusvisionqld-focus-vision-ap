// Seeds a few sample documents so the patient Documents screen + viewer
// are testable. Generates minimal valid PDFs, uploads them to the
// `documents` Storage bucket, and inserts documents rows.
//
// Run:  node --env-file=.env.local scripts/seed-documents.mjs
//
// Auth: signs in as a seed staff user (RLS lets staff upload + insert).
// Idempotent: skips a patient who already has documents.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STAFF_EMAIL = "maria.chen@focusvision.dev";
const STAFF_PASSWORD = "seed-only-do-not-use";

if (!URL || !ANON) {
  console.error("Missing Supabase env vars. Run with --env-file=.env.local");
  process.exit(1);
}

// Builds a minimal, valid single-page PDF with one line of text.
function buildPdf(title) {
  const stream = `BT /F1 24 Tf 64 760 Td (${title}) Tj ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

const SAMPLES = [
  { category: "Consent forms", title: "LASIK informed consent" },
  { category: "Surgical report", title: "Operative report" },
  { category: "Post-op care plan", title: "Your recovery plan" },
];

async function main() {
  const supabase = createClient(URL, ANON);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: STAFF_EMAIL,
    password: STAFF_PASSWORD,
  });
  if (signInError) {
    console.error("Staff sign-in failed:", signInError.message);
    process.exit(1);
  }

  const { data: patients, error: patientsError } = await supabase
    .from("patients")
    .select("id, name")
    .order("created_at")
    .limit(2);
  if (patientsError) {
    console.error("Could not load patients:", patientsError.message);
    process.exit(1);
  }
  if (!patients?.length) {
    console.error("No patients found — run the main seed first.");
    process.exit(1);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  for (const patient of patients) {
    const { count } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patient.id);
    if ((count ?? 0) > 0) {
      console.log(`• ${patient.name}: already has documents — skipping`);
      continue;
    }

    for (const sample of SAMPLES) {
      const filename = `${sample.title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      const storagePath = `${patient.id}/${Date.now()}-${filename}`;
      const body = buildPdf(`${sample.title} — ${patient.name}`);

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, body, { contentType: "application/pdf" });
      if (uploadError) {
        console.error(`  upload failed (${filename}):`, uploadError.message);
        continue;
      }

      const { error: insertError } = await supabase.from("documents").insert({
        patient_id: patient.id,
        category: sample.category,
        title: sample.title,
        filename,
        storage_path: storagePath,
        uploaded_by: user?.id ?? null,
      });
      if (insertError) {
        console.error(`  row insert failed (${filename}):`, insertError.message);
        continue;
      }
      console.log(`• ${patient.name}: ${sample.category} / ${filename}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
