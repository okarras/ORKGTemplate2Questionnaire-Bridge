import {
  ORKG_SPARQL_ENDPOINT,
  buildValueTypeQuery,
  parseValueTypeMeta,
  type OrkgPropertyValueMeta,
  type SparqlResult,
} from "./orkg-queries";

/**
 * Fetches value type (Literal/IRI/Blank) and optional RDF literal datatype
 * for a predicate from ORKG SPARQL.
 * Use this from server-side code (API routes, server components).
 */
export async function fetchValueTypeFromOrkg(
  predicateId: string,
): Promise<OrkgPropertyValueMeta> {
  const query = buildValueTypeQuery(predicateId);

  if (!query) return { valueType: "Literal" };

  try {
    const response = await fetch(ORKG_SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (!response.ok) return { valueType: "Literal" };

    const contentType = response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("application/json") &&
      !contentType.includes("sparql-results+json")
    ) {
      return { valueType: "Literal" };
    }

    const result: SparqlResult = await response.json();

    return parseValueTypeMeta(result);
  } catch {
    return { valueType: "Literal" };
  }
}
