/**
 * orkg-instance-builder.ts
 *
 * Converts the in-memory form values (keyed by predicate ID) and
 * EnrichedTemplateMapping into a flat list of { predicateId, value, isLiteral }
 * triples that the server-side submit route can turn into ORKG statements.
 *
 * Only top-level properties are handled (sub-resource creation is a follow-up).
 * Values that are empty / undefined are omitted.
 */

import type {
  EnrichedTemplateMapping,
  EnrichedSubtemplateProperty,
} from "@/types/template";
import type { FormValue } from "@/components/questionnaire/QuestionnaireForm";

export interface AnswerTriple {
  /** ORKG predicate ID, e.g. "P181041" */
  predicateId: string;
  /** The string value to store. If it's a nested resource, this acts as the label. */
  value?: string;
  /**
   * true  → create a Literal via POST /api/literals and link it
   * false → the value is already an ORKG resource IRI; link directly
   */
  isLiteral: boolean;
  /**
   * Optional datatype for xsd-typed literals.
   * undefined → defaults to xsd:string
   */
  datatype?:
    | "xsd:integer"
    | "xsd:decimal"
    | "xsd:boolean"
    | "xsd:date"
    | "xsd:anyURI";
  /** If true, this represents a new ORKG resource to be created instead of a string/literal */
  isNestedResource?: boolean;
  /** The specific ORKG class string if creating a nested resource */
  targetClassId?: string;
  /** Sub-statements to attach to the newly created nested resource */
  subStatements?: AnswerTriple[];
}

/** Detect whether a string looks like an ORKG resource IRI */
function isOrkgIri(v: string): boolean {
  return (
    v.startsWith("http://orkg.org/") ||
    v.startsWith("https://orkg.org/") ||
    /^R\d+$/.test(v)
  );
}

function scalarToTriples(
  predicateId: string,
  raw: FormValue,
  prop: EnrichedSubtemplateProperty,
): AnswerTriple[] {
  if (raw === undefined || raw === null || raw === "") return [];

  // Multi-value (array)
  if (Array.isArray(raw)) {
    return raw
      .filter((v) => v !== "" && v !== undefined)
      .flatMap((v) => scalarToTriples(predicateId, v as FormValue, prop));
  }

  // Nested object
  if (typeof raw === "object") {
    const nested = raw as Record<string, FormValue>;
    const rootValueStr = nested._ !== undefined ? String(nested._).trim() : "";

    if (prop.subtemplate_properties && Object.keys(prop.subtemplate_properties).length > 0) {
      const subTriples: AnswerTriple[] = [];
      for (const [subId, subProp] of Object.entries(prop.subtemplate_properties)) {
        if (nested[subId] !== undefined) {
          subTriples.push(...scalarToTriples(subId, nested[subId], subProp as EnrichedSubtemplateProperty));
        }
      }

      if (subTriples.length > 0 || rootValueStr) {
        return [
          {
            predicateId,
            value: rootValueStr || prop.subtemplate_label || prop.label || "Unknown Sub-resource",
            isLiteral: false,
            isNestedResource: true,
            targetClassId: prop.class_id,
            subStatements: subTriples,
          },
        ];
      }
    } else {
      if (rootValueStr) {
        return scalarToTriples(predicateId, nested._ as FormValue, prop);
      }
    }

    return [];
  }

  const valueStr = String(raw).trim();

  if (!valueStr) return [];

  // Determine if this is a resource IRI or a literal
  const iri = isOrkgIri(valueStr);
  const valueType = (prop as { valueType?: string }).valueType ?? "Unknown";
  const isLiteralVal = !iri && valueType !== "IRI";

  let datatype: AnswerTriple["datatype"];

  if (isLiteralVal) {
    if (
      typeof raw === "boolean" ||
      valueStr === "true" ||
      valueStr === "false"
    ) {
      datatype = "xsd:boolean";
    } else if (!Number.isNaN(Number(valueStr)) && valueStr.includes(".")) {
      datatype = "xsd:decimal";
    } else if (/^\d+$/.test(valueStr)) {
      datatype = "xsd:integer";
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(valueStr)) {
      datatype = "xsd:date";
    }
    // URLs as literals
    if (
      !datatype &&
      (valueStr.startsWith("http://") || valueStr.startsWith("https://"))
    ) {
      datatype = "xsd:anyURI";
    }
  }

  return [{ predicateId, value: valueStr, isLiteral: isLiteralVal, datatype }];
}

/**
 * Flatten form values into answer triples ready for submission.
 *
 * @param mapping  The enriched template mapping (predicate → property meta)
 * @param values   The form's current value state
 */
export function buildAnswerTriples(
  mapping: EnrichedTemplateMapping,
  values: Record<string, FormValue>,
): AnswerTriple[] {
  const triples: AnswerTriple[] = [];

  for (const [predicateId, prop] of Object.entries(mapping)) {
    const raw = values[predicateId];

    if (raw === undefined || raw === null) continue;

    const sub = scalarToTriples(predicateId, raw, prop);

    triples.push(...sub);
  }

  return triples;
}
