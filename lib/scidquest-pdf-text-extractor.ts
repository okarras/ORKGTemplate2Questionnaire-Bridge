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

interface PageContent {
  pageNumber: number;
  text: string;
  wordCount: number;
}

interface StructuredDocument {
  metadata: {
    filename: string;
    totalPages: number;
    totalWords: number;
    extractedAt: number;
  };
  pages: PageContent[];
  fullText: string;
}

export class ScidQuestCompatiblePdfTextExtractor {
  private readonly fullTextCache = new Map<string, string>();
  private readonly documentCache = new Map<string, PdfDocument>();
  private readonly structuredCache = new Map<string, StructuredDocument>();

  /**
   * Single pdf.js pass: extract every page, populate BOTH the flat-text cache
   * and the structured (per-page) cache. This avoids a second pdf.js load,
   * which is what triggers Next.js's `Object.defineProperty` crash.
   */
  private async extractPages(url: string): Promise<StructuredDocument> {
    const cached = this.structuredCache.get(url);

    if (cached) return cached;

    const pdfjs = await loadPdfLegacy();
    const doc = await this.loadDocument(url, pdfjs);
    const pages: PageContent[] = [];

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let text = "";

      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += (text ? " " : "") + item.str;
      }

      text = text.trim();
      const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

      pages.push({ pageNumber: p, text, wordCount });
    }

    const fullText = pages
      .map((pg) => pg.text)
      .filter((t) => t.length > 0)
      .join("\n\n");
    const totalWords = pages.reduce((sum, pg) => sum + pg.wordCount, 0);

    const structured: StructuredDocument = {
      metadata: {
        filename: url.split("/").pop() || "document.pdf",
        totalPages: doc.numPages,
        totalWords,
        extractedAt: Date.now(),
      },
      pages,
      fullText,
    };

    this.structuredCache.set(url, structured);
    this.fullTextCache.set(url, fullText);

    return structured;
  }

  async extractFullText(url: string): Promise<string> {
    const hit = this.fullTextCache.get(url);

    if (hit) return hit;

    try {
      const structured = await this.extractPages(url);

      return structured.fullText;
    } catch (e) {
      throw new Error(
        `Failed to extract text from PDF: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Extract the PDF page-by-page so ScidQuest gets real page numbers for
   * semantic chunking and evidence highlighting.
   * Reuses the same single pdf.js pass as `extractFullText` (cached), so it
   * never independently re-loads pdf.js.
   */
  async extractStructuredDocument(
    url: string,
    filename?: string,
  ): Promise<StructuredDocument> {
    try {
      const structured = await this.extractPages(url);

      if (filename && structured.metadata.filename !== filename) {
        return {
          ...structured,
          metadata: { ...structured.metadata, filename },
        };
      }

      return structured;
    } catch (e) {
      throw new Error(
        `Failed to extract structured document from PDF: ${e instanceof Error ? e.message : "Unknown error"}`,
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
    this.structuredCache.delete(url);
    const doc = this.documentCache.get(url);

    if (doc) {
      void doc.destroy();
      this.documentCache.delete(url);
    }
  }
}

export const defaultScidQuestPdfTextExtractor =
  new ScidQuestCompatiblePdfTextExtractor();
