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
SELECT DISTINCT ?oType WHERE {
  ?s ${predicateVar} ?o .
  BIND(
    IF(isLiteral(?o), "Literal",
      IF(isIRI(?o), "IRI",
        IF(isBlank(?o), "Blank node", "Unknown")
      )
    ) AS ?oType
  )
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
  options?: { contributionClass?: string }
): string | null {
  const match = predicateId.match(/^P(\d+)$/);
  if (!match) return null;

  const pred = `orkgp:P${match[1]}`;
  const filter =
    options?.contributionClass &&
    options.contributionClass.match(/^R\d+$/)
      ? `
  ?paper orkgp:P31 orkgr:${options.contributionClass} .
  ?s orkgp:P181002|orkgp:P31 ?paper .
`
      : "";

  return `
${ORKG_PREFIXES}
SELECT DISTINCT ?oType WHERE {
  ${filter}
  ?s ${pred} ?o .
  BIND(
    IF(isLiteral(?o), "Literal",
      IF(isIRI(?o), "IRI",
        IF(isBlank(?o), "Blank node", "Unknown")
      )
    ) AS ?oType
  )
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
  options?: { classId?: string; limit?: number }
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
      o?: { value: string };
      oLabel?: { value: string };
    }>;
  };
}

/**
 * Parse SPARQL JSON result and extract distinct value types.
 * Returns the dominant type: IRI > Literal > Blank node > Unknown (for form UX).
 */
export function parseValueTypeResult(result: SparqlResult): OrkgValueType {
  const bindings = result?.results?.bindings ?? [];
  const types = new Set(
    bindings
      .map((b) => b.oType?.value)
      .filter((v): v is string => Boolean(v))
  );

  if (types.has("IRI")) return "IRI";
  if (types.has("Literal")) return "Literal";
  if (types.has("Blank node")) return "Blank node";
  return "Unknown";
}
