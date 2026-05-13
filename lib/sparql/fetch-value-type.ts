import {
  ORKG_SPARQL_ENDPOINT,
  buildValueTypeQuery,
  parseValueTypeMeta,
  type OrkgPropertyValueMeta,
  type SparqlResult,
} from "./orkg-queries";

import {
  mergeOrkgValueTypeMeta,
  templateDatatypeToValueMeta,
} from "@/lib/orkg-value-type-merge";

const ORKG_STATEMENTS_API = "https://orkg.org/api/statements";

export type FetchValueTypeOptions = {
  /** ORKG template API `property.datatype` for this predicate path */
  templateDatatype?: { id: string; label?: string };
};

function literalDatatypeFromStatementObject(
  obj: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!obj || String(obj._class).toLowerCase() !== "literal") return undefined;

  const raw =
    (obj.datatype as string | undefined) ??
    (obj.data_type as string | undefined) ??
    (obj.literal_datatype as string | undefined);

  if (typeof raw === "string" && raw.trim()) return raw.trim();

  const nested = obj.datatype as { id?: string } | undefined;

  if (nested && typeof nested.id === "string" && nested.id.trim()) {
    return nested.id.trim();
  }

  return undefined;
}

/**
 * Uses ORKG statements API `object._class` (literal vs resource) on a sample
 * of recent statements. Helps when global SPARQL counts are dominated by a
 * different usage pattern than the statements ORKG actually stores.
 */
export async function aggregateValueTypeFromOrkgStatements(
  predicateId: string,
): Promise<OrkgPropertyValueMeta | null> {
  if (!/^P\d+$/i.test(predicateId)) return null;

  try {
    const params = new URLSearchParams({
      predicate_id: predicateId,
      page: "0",
      size: "500",
      sort: "created_at,desc",
    });
    const response = await fetch(`${ORKG_STATEMENTS_API}?${params}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data: { content?: unknown[] } = await response.json();
    const content = data.content ?? [];

    let literalCt = 0;
    let resourceCt = 0;
    let firstLiteralDt: string | undefined;

    for (const row of content) {
      const obj = (row as { object?: Record<string, unknown> })?.object;

      if (!obj) continue;
      const cls = String(obj._class ?? "").toLowerCase();

      if (cls === "literal") {
        literalCt++;
        if (firstLiteralDt === undefined) {
          firstLiteralDt = literalDatatypeFromStatementObject(obj);
        }
      } else if (cls === "resource") {
        resourceCt++;
      }
    }

    const total = literalCt + resourceCt;

    if (total < 5) return null;

    const litRatio = literalCt / total;

    if (litRatio >= 0.9) {
      return {
        valueType: "Literal",
        ...(firstLiteralDt !== undefined ? { literalDatatype: firstLiteralDt } : {}),
      };
    }

    if (litRatio <= 0.1) {
      return { valueType: "IRI" };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches value type (Literal/IRI/Blank) and optional RDF literal datatype
 * for a predicate: ORKG template `datatype` (if provided) overrides misleading
 * global SPARQL; otherwise reconciles SPARQL with statements `object._class`.
 */
export async function fetchValueTypeFromOrkg(
  predicateId: string,
  options?: FetchValueTypeOptions,
): Promise<OrkgPropertyValueMeta> {
  const query = buildValueTypeQuery(predicateId);

  const templateMeta = templateDatatypeToValueMeta(options?.templateDatatype);

  if (!query) {
    return (
      templateMeta ?? {
        valueType: "Literal" as const,
      }
    );
  }

  try {
    const response = await fetch(ORKG_SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (!response.ok) {
      return templateMeta ?? { valueType: "Literal" };
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("application/json") &&
      !contentType.includes("sparql-results+json")
    ) {
      return templateMeta ?? { valueType: "Literal" };
    }

    const result: SparqlResult = await response.json();
    const sparqlMeta = parseValueTypeMeta(result);

    let statementMeta: OrkgPropertyValueMeta | null = null;

    if (!templateMeta && sparqlMeta.valueType === "IRI") {
      statementMeta = await aggregateValueTypeFromOrkgStatements(predicateId);
    }

    return mergeOrkgValueTypeMeta(sparqlMeta, templateMeta, statementMeta);
  } catch {
    return templateMeta ?? { valueType: "Literal" };
  }
}
