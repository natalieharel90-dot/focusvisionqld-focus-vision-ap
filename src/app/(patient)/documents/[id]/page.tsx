import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DocumentViewer } from "@/components/patient/DocumentViewer";
import { documentKind, watermarkLabel } from "@/lib/documents";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

export default async function PatientDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, category, filename, storage_path, patient_id")
    .eq("id", params.id)
    .maybeSingle();

  // RLS already restricts to the patient's own documents; this is a
  // friendly fallback rather than a raw error.
  if (!doc || doc.patient_id !== user.id) {
    return (
      <main className="flex flex-col gap-4 px-5 py-6">
        <Link href="/documents" className="text-sm text-fv-accent-strong">
          ‹ Back to documents
        </Link>
        <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          This document isn&apos;t available.
        </div>
      </main>
    );
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: signed } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);

  // Audit every document view (spec §5.6 — document actions are logged).
  await supabase.rpc("record_patient_audit_event", {
    p_event_type: "patient.document_viewed",
    p_entity_type: "document",
    p_entity_id: doc.id,
    p_new_value: { category: doc.category, filename: doc.filename },
  });

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link href="/documents" className="text-sm text-fv-accent-strong">
        ‹ Back to documents
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-fv-text-primary">
          {doc.title ?? doc.filename}
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">{doc.category}</p>
      </header>

      <DocumentViewer
        kind={documentKind(doc.filename)}
        url={signed?.signedUrl ?? null}
        watermark={watermarkLabel(patient?.name ?? "Focus Vision patient")}
        filename={doc.filename}
      />

      {signed?.signedUrl ? (
        <a
          href={signed.signedUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-fv-accent-strong px-4 py-3.5 text-center text-base font-semibold text-white hover:opacity-95"
        >
          Open document in a new tab
        </a>
      ) : null}

      <p className="text-center text-xs text-fv-text-muted">
        This document is watermarked with your name and today&apos;s date.
      </p>
    </main>
  );
}
