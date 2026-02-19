import {
  ORKG_SPARQL_ENDPOINT,
  buildValueTypeQuery,
  parseValueTypeResult,
  type SparqlResult,
} from "./orkg-queries";
import type { OrkgValueType } from "@/types/template";

/**
 * Fetches value type (Literal/IRI/Blank) for a predicate from ORKG SPARQL.
 * Use this from server-side code (API routes, server components).
 */
export async function fetchValueTypeFromOrkg(
  predicateId: string
): Promise<OrkgValueType> {
  const query = buildValueTypeQuery(predicateId);
  if (!query) return "Literal";

  try {
    const response = await fetch(ORKG_SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (!response.ok) return "Literal";

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("application/json") &&
      !contentType.includes("sparql-results+json")
    ) {
      return "Literal";
    }

    const result: SparqlResult = await response.json();
    return parseValueTypeResult(result);
  } catch {
    return "Literal";
  }
}
