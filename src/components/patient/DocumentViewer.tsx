import type { DocumentKind } from "@/lib/documents";

type Props = {
  kind: DocumentKind;
  url: string | null;
  // View-time watermark text (patient name + date). Rendered as an
  // overlay — the stored file itself is never modified.
  watermark: string;
  filename: string;
};

// In-app document viewer. PDFs render in an iframe, images inline; other
// types fall back to an open-file link. The watermark is an absolutely
// positioned overlay applied client-side on render.
export function DocumentViewer({ kind, url, watermark, filename }: Props) {
  if (!url) {
    return (
      <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
        This document couldn&apos;t be loaded. Please try again or contact the
        clinic.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-fv-bg-card shadow-sm">
      {kind === "pdf" ? (
        <iframe
          src={url}
          title={filename}
          className="h-[75vh] w-full border-0 bg-white"
        />
      ) : kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={filename} className="w-full" />
      ) : (
        <div className="p-6 text-center text-sm text-fv-text-secondary">
          <p>This file type can&apos;t be previewed in the app.</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
          >
            Open file
          </a>
        </div>
      )}

      {/* View-time watermark — bottom-right, non-interactive. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-2 right-2 max-w-[80%] rounded bg-black/55 px-2 py-1 text-right text-[11px] font-medium leading-tight text-white"
      >
        {watermark}
      </div>
    </div>
  );
}
