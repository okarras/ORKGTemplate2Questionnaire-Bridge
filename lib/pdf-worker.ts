/**
 * Served from `public/assets/` (see `scripts/copy-pdf-worker.mjs`).
 * Next.js aliases `pdfjs-dist` to the legacy build, so the worker must match.
 */
export const PDF_WORKER_SRC = "/assets/pdf.worker.legacy.min.mjs";

/** @deprecated Use {@link PDF_WORKER_SRC} — kept for scidquest-pdf-text-extractor imports. */
export const PDF_LEGACY_WORKER_SRC = PDF_WORKER_SRC;

type PdfJsWorkerHost = {
  GlobalWorkerOptions: { workerSrc: string };
};

/** Configure worker on react-pdf's pdfjs (must run after `react-pdf` import). */
export function configureReactPdfWorker(
  reactPdfJs: PdfJsWorkerHost,
  workerSrc: string = PDF_WORKER_SRC,
): void {
  if (typeof window === "undefined") return;
  reactPdfJs.GlobalWorkerOptions.workerSrc = workerSrc;
}

/**
 * Ensure react-pdf uses the bundled worker. Call after `@orkg/scidquest` import
 * (its PdfViewer sets a broken `import.meta.url` worker path on load).
 */
export async function ensureReactPdfWorkerConfigured(): Promise<void> {
  const { pdfjs } = await import("react-pdf");

  configureReactPdfWorker(pdfjs);
}
