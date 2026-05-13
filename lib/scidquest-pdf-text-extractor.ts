/**
 * PdfViewer from @orkg/scidquest expects `pdfTextExtractor.extractFullText(url)`.
 *
 * Do **not** import `pdfjs-dist/build/pdf.mjs` at module scope: Next.js 15’s bundler
 * hits `Object.defineProperty called on non-object` (see mozilla/pdf.js#20435).
 * The legacy build is webpack-friendly; load it only on first extraction.
 */

type PdfLegacy = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDocument = Awaited<
  ReturnType<PdfLegacy["getDocument"]> extends { promise: infer P }
    ? P
    : never
>;

let pdfLegacyPromise: Promise<PdfLegacy> | null = null;
let workerConfigured = false;

async function loadPdfLegacy(): Promise<PdfLegacy> {
  if (!pdfLegacyPromise) {
    pdfLegacyPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }

  const pdfjs = await pdfLegacyPromise;

  if (typeof window !== "undefined" && !workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist/${pdfjs.version}/legacy/build/pdf.worker.mjs`;
    workerConfigured = true;
  }

  return pdfjs;
}

export class ScidQuestCompatiblePdfTextExtractor {
  private readonly fullTextCache = new Map<string, string>();
  private readonly documentCache = new Map<string, PdfDocument>();

  async extractFullText(url: string): Promise<string> {
    const hit = this.fullTextCache.get(url);

    if (hit) return hit;

    const pdfjs = await loadPdfLegacy();

    try {
      const doc = await this.loadDocument(url, pdfjs);
      const chunks: string[] = [];

      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        let line = "";

        for (const item of content.items) {
          if (!("str" in item)) continue;
          line += (line ? " " : "") + item.str;
        }

        if (line.trim()) chunks.push(line.trim());
      }

      const text = chunks.join("\n\n");

      this.fullTextCache.set(url, text);

      return text;
    } catch (e) {
      throw new Error(
        `Failed to extract text from PDF: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  }

  private async loadDocument(
    url: string,
    pdfjs: PdfLegacy,
  ): Promise<PdfDocument> {
    const cached = this.documentCache.get(url);

    if (cached) return cached;

    const task = pdfjs.getDocument({ url });
    const doc = (await task.promise) as PdfDocument;

    this.documentCache.set(url, doc);

    return doc;
  }

  clearForUrl(url: string): void {
    this.fullTextCache.delete(url);
    const doc = this.documentCache.get(url);

    if (doc) {
      void doc.destroy();
      this.documentCache.delete(url);
    }
  }
}

export const defaultScidQuestPdfTextExtractor =
  new ScidQuestCompatiblePdfTextExtractor();
