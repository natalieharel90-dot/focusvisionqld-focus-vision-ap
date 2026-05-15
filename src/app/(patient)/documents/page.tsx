import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  documentKind,
  groupDocumentsByCategory,
  relativeTime,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, string> = {
  pdf: "📄",
  image: "🖼️",
  other: "📎",
};

export default async function PatientDocumentsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, category, filename, uploaded_at")
    .eq("patient_id", user.id)
    .order("uploaded_at", { ascending: false });

  const groups = groupDocumentsByCategory(documents ?? []);

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Documents
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Everything your care team has shared with you.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No documents yet. Anything your clinic shares will appear here.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {group.category}
            </h2>
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-fv-bg-card shadow-sm">
              {group.documents.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="flex items-center gap-3 border-b border-fv-bg-soft px-4 py-3 last:border-0 hover:bg-fv-bg-soft"
                  >
                    <span aria-hidden className="text-xl">
                      {KIND_ICON[documentKind(doc.filename)]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fv-text-primary">
                        {doc.title ?? doc.filename}
                      </span>
                      <span className="block truncate text-xs text-fv-text-secondary">
                        {doc.category} · uploaded{" "}
                        {relativeTime(doc.uploaded_at)}
                      </span>
                      <span className="block truncate text-xs text-fv-text-muted">
                        {doc.filename}
                      </span>
                    </span>
                    <span aria-hidden className="text-fv-text-secondary">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* Virtual "Check-in history" category. */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
          Check-in history
        </h2>
        <ul className="flex flex-col overflow-hidden rounded-2xl bg-fv-bg-card shadow-sm">
          <li>
            <Link
              href="/documents/check-ins"
              className="flex items-center gap-3 px-4 py-3 hover:bg-fv-bg-soft"
            >
              <span aria-hidden className="text-xl">
                📊
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fv-text-primary">
                  Your daily check-in history
                </span>
                <span className="block text-xs text-fv-text-secondary">
                  Every check-in you&apos;ve completed, newest first
                </span>
              </span>
              <span aria-hidden className="text-fv-text-secondary">
                ›
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
