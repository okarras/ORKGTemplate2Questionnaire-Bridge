import type { OrkgValueType } from "@/types/template";

const ORKG_PREFIXES = `
PREFIX orkgp: <http://orkg.org/orkg/predicate/>
PREFIX orkgc: <http://orkg.org/orkg/class/>
PREFIX orkgr: <http://orkg.org/orkg/resource/>
`;

/**
 * Builds SPARQL query to detect value type (Literal/IRI/Blank) for a given predicate.
 * Only predicates matching /^P\d+$/ map to orkgp:P{id}. Others return null (skip query).
 */
export function buildValueTypeQuery(predicateId: string): string | null {
  const match = predicateId.match(/^P(\d+)$/);

  if (!match) return null;

  const predicateVar = `orkgp:P${match[1]}`;

  return `
${ORKG_PREFIXES}
SELECT DISTINCT ?oType ?litDt WHERE {
  ?s ${predicateVar} ?o .
  BIND(
    IF(isLiteral(?o), "Literal",
      IF(isIRI(?o), "IRI",
        IF(isBlank(?o), "Blank node", "Unknown")
      )
    ) AS ?oType
  )
  BIND(IF(isLiteral(?o), STR(DATATYPE(?o)), "") AS ?litDt)
}
LIMIT 100
`;
}

/**
 * Builds SPARQL query to fetch distinct value types for a predicate,
 * with optional paper/contribution filter (P31 = contribution type).
 */
export function buildValueTypeQueryWithContext(
  predicateId: string,
  options?: { contributionClass?: string },
): string | null {
  const match = predicateId.match(/^P(\d+)$/);

  if (!match) return null;

  const pred = `orkgp:P${match[1]}`;
  const filter =
    options?.contributionClass && options.contributionClass.match(/^R\d+$/)
      ? `
  ?paper orkgp:P31 orkgr:${options.contributionClass} .
  ?s orkgp:P181002|orkgp:P31 ?paper .
`
      : "";

  return `
${ORKG_PREFIXES}
SELECT DISTINCT ?oType ?litDt WHERE {
  ${filter}
  ?s ${pred} ?o .
  BIND(
    IF(isLiteral(?o), "Literal",
      IF(isIRI(?o), "IRI",
        IF(isBlank(?o), "Blank node", "Unknown")
      )
    ) AS ?oType
  )
  BIND(IF(isLiteral(?o), STR(DATATYPE(?o)), "") AS ?litDt)
}
LIMIT 10
`;
}

/**
 * Builds SPARQL query to fetch distinct IRIs (resources) for a predicate.
 * Returns ?o (IRI) and ?oLabel.
 * - predicateId: e.g. P181002
 * - classId: optional, e.g. C121018 - filter resources by class (instance of)
 */
export function buildResourcesQuery(
  predicateId: string,
  options?: { classId?: string; limit?: number },
): string | null {
  const match = predicateId.match(/^P(\d+)$/);
  const classMatch = options?.classId?.match(/^C(\d+)$/);
  const limit = options?.limit ?? 500;

  // Query by predicate - distinct IRIs with labels for user selection
  if (match) {
    const pred = `orkgp:P${match[1]}`;
    const classFilter = classMatch
      ? `  ?o orkgp:P31 orkgc:${options!.classId} .\n`
      : "";

    return `
${ORKG_PREFIXES}
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?o ?oLabel WHERE {
  ?s ${pred} ?o .
  FILTER(isIRI(?o))
${classFilter}
  OPTIONAL {
    { ?o rdfs:label ?oLabel }
    UNION
    { ?o schema:name ?oLabel }
  }
}
ORDER BY ?oLabel
LIMIT ${limit}
`;
  }

  // Query by class only (for non-P predicates like "license", "release")
  if (classMatch) {
    return `
${ORKG_PREFIXES}
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?o ?oLabel WHERE {
  ?o orkgp:P31 orkgc:${options!.classId} .
  OPTIONAL {
    { ?o rdfs:label ?oLabel }
    UNION
    { ?o schema:name ?oLabel }
  }
}
ORDER BY ?oLabel
LIMIT ${limit}
`;
  }

  return null;
}

/** Virtuoso SPARQL endpoint - use POST with Accept: application/sparql-results+json */
export const ORKG_SPARQL_ENDPOINT = "https://orkg.org/triplestore";

export interface SparqlResult {
  results: {
    bindings: Array<{
      oType?: { value: string };
      litDt?: { value: string };
      o?: { value: string };
      oLabel?: { value: string };
    }>;
  };
}

/**
 * Parse SPARQL JSON result and pick a dominant object kind for the predicate.
 * Uses row counts from DISTINCT (?oType ?litDt) bindings so a predicate that is
 * mostly literals (e.g. booleans) is not forced to "IRI" because a rare IRI row exists.
 * Tie-break order when counts are equal: IRI, Literal, Blank node, Unknown.
 */
export function parseValueTypeResult(result: SparqlResult): OrkgValueType {
  const bindings = result?.results?.bindings ?? [];
  const counts: Record<OrkgValueType, number> = {
    IRI: 0,
    Literal: 0,
    "Blank node": 0,
    Unknown: 0,
  };

  for (const b of bindings) {
    const t = b.oType?.value as OrkgValueType | undefined;

    if (t && t in counts) counts[t] += 1;
  }

  const rank: OrkgValueType[] = [
    "IRI",
    "Literal",
    "Blank node",
    "Unknown",
  ];
  let best: OrkgValueType = "Unknown";
  let bestCount = -1;

  for (const t of rank) {
    if (counts[t] > bestCount) {
      best = t;
      bestCount = counts[t];
    }
  }

  return best;
}

/** Prefer more specific XSD types when usage counts tie (same predicate, mixed literals). */
function literalDatatypePreference(uri: string): number {
  const u = uri.toLowerCase();

  if (u.endsWith("#boolean")) return 100;
  if (
    u.endsWith("#integer") ||
    u.endsWith("#int") ||
    u.endsWith("#long") ||
    u.endsWith("#unsignedint")
  )
    return 85;
  if (
    u.endsWith("#decimal") ||
    u.endsWith("#double") ||
    u.endsWith("#float")
  )
    return 80;
  if (u.endsWith("#date") && !u.includes("datetime")) return 70;
  if (u.endsWith("#datetime")) return 65;
  if (u.endsWith("#anyuri")) return 50;
  if (u.endsWith("#string")) return 10;

  return 0;
}

export interface OrkgPropertyValueMeta {
  valueType: OrkgValueType;
  literalDatatype?: string;
}

/**
 * Like {@link parseValueTypeResult} but when the dominant type is Literal,
 * picks a representative RDF datatype IRI from literal rows (SPARQL `?litDt`).
 */
export function parseValueTypeMeta(result: SparqlResult): OrkgPropertyValueMeta {
  const valueType = parseValueTypeResult(result);

  if (valueType !== "Literal") {
    return { valueType };
  }

  const bindings = result?.results?.bindings ?? [];
  const candidates = bindings
    .filter((b) => b.oType?.value === "Literal")
    .map((b) => b.litDt?.value?.trim())
    .filter((v): v is string => Boolean(v));

  if (candidates.length === 0) {
    return { valueType };
  }

  const counts = new Map<string, number>();

  for (const c of candidates) {
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  let literalDatatype: string | undefined;
  let bestCount = -1;
  let bestPref = -1;

  for (const [uri, count] of Array.from(counts.entries())) {
    const pref = literalDatatypePreference(uri);

    if (count > bestCount || (count === bestCount && pref > bestPref)) {
      literalDatatype = uri;
      bestCount = count;
      bestPref = pref;
    }
  }

  return { valueType, literalDatatype };
}
