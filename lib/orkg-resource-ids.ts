/** Canonical ORKG resource IRI prefix used in the triple store and API. */
export const ORKG_RESOURCE_IRI_PREFIX = "http://orkg.org/orkg/resource/";

/**
 * Normalize a resource id to the canonical full IRI (e.g. R123 → http://orkg.org/orkg/resource/R123).
 */
export function normalizeOrkgResourceIri(id: string): string {
  const t = id.trim();

  if (!t) return t;
  const lower = t.toLowerCase();

  if (lower.startsWith("http://orkg.org/orkg/resource/")) {
    const tail = t.slice("http://orkg.org/orkg/resource/".length);

    return ORKG_RESOURCE_IRI_PREFIX + tail;
  }
  if (lower.startsWith("https://orkg.org/orkg/resource/")) {
    const tail = t.slice("https://orkg.org/orkg/resource/".length);

    return ORKG_RESOURCE_IRI_PREFIX + tail;
  }
  const m = t.match(/^(R\d+)$/i);

  if (m) return ORKG_RESOURCE_IRI_PREFIX + m[1]!.toUpperCase();

  return t;
}

export function orkgResourceIriTail(iri: string): string {
  const n = normalizeOrkgResourceIri(iri);

  if (n.startsWith(ORKG_RESOURCE_IRI_PREFIX)) {
    return n.slice(ORKG_RESOURCE_IRI_PREFIX.length);
  }

  return n.split("/").pop() ?? n;
}

/**
 * Short entity line for UI (e.g. dropdown subtitles): `Resource R123` or `Class C456`.
 * Handles ORKG class IRIs and resource IRIs / bare R/C tails.
 */
export function orkgEntityKindLineFromIri(iri: string): string {
  const raw = iri?.trim() ?? "";

  if (!raw) return "";

  const lower = raw.toLowerCase();

  if (lower.includes("/orkg/class/")) {
    const seg = raw.split("/").pop() ?? "";
    const m = seg.match(/^C(\d+)$/i);

    return m ? `Class C${m[1]}` : `Class ${seg}`;
  }

  const n = normalizeOrkgResourceIri(raw);
  const tail = n.startsWith(ORKG_RESOURCE_IRI_PREFIX)
    ? n.slice(ORKG_RESOURCE_IRI_PREFIX.length)
    : (raw.split("/").pop() ?? raw);
  const c = tail.match(/^C(\d+)$/i);

  if (c) return `Class C${c[1]}`;

  const r = tail.match(/^R(\d+)$/i);

  if (r) return `Resource R${r[1]}`;

  return tail ? `Resource ${tail}` : raw;
}

export function resourceIrisEquivalent(a: string, b: string): boolean {
  return normalizeOrkgResourceIri(a) === normalizeOrkgResourceIri(b);
}

/** Dedupe by canonical IRI; preserves first-seen casing of the canonical form. */
export function dedupeOrkgResourceIris(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const id of ids) {
    const n = normalizeOrkgResourceIri(id);

    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }

  return out;
}
