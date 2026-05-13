import type { OrkgPropertyValueMeta } from "@/lib/sparql/orkg-queries";

/**
 * Maps ORKG template property `datatype` (design-time) to SPARQL-style value meta.
 * When this returns non-null, it should win over global triple-store aggregates
 * that can misclassify predicates reused as IRIs elsewhere in the graph.
 */
export function templateDatatypeToValueMeta(
  dt?: { id: string; label?: string } | null,
): OrkgPropertyValueMeta | null {
  if (!dt?.id && !dt?.label) return null;

  const s = `${dt.id} ${dt.label ?? ""}`.toLowerCase();

  if (/\bboolean\b|#boolean|\/boolean\b|xsd:boolean/.test(s)) {
    return {
      valueType: "Literal",
      literalDatatype: "http://www.w3.org/2001/XMLSchema#boolean",
    };
  }
  if (/#datetime|datetime\b|xsd:datetime/.test(s)) {
    return {
      valueType: "Literal",
      literalDatatype: "http://www.w3.org/2001/XMLSchema#dateTime",
    };
  }
  if (/(#date\b|xsd:date)(?!time)/i.test(s) && !/datetime/i.test(s)) {
    return {
      valueType: "Literal",
      literalDatatype: "http://www.w3.org/2001/XMLSchema#date",
    };
  }
  if (
    /#integer|#int|#long|#decimal|#double|#float|\binteger\b|\bdecimal\b|\bdouble\b|\bfloat\b|xsd:int|xsd:integer/.test(
      s,
    )
  ) {
    return {
      valueType: "Literal",
      literalDatatype: "http://www.w3.org/2001/XMLSchema#decimal",
    };
  }
  if (/#string|\bstring\b|plain literal|rdf:langstring|langstring/.test(s)) {
    return { valueType: "Literal" };
  }
  if (/\b(uri|iri|resource|thing)\b|#anyuri|anyuri/.test(s)) {
    return { valueType: "IRI" };
  }

  return null;
}

/**
 * Prefer template design, then reconcile SPARQL vs ORKG statements `object._class`.
 */
export function mergeOrkgValueTypeMeta(
  sparql: OrkgPropertyValueMeta,
  template: OrkgPropertyValueMeta | null,
  statement: OrkgPropertyValueMeta | null,
): OrkgPropertyValueMeta {
  if (template?.valueType === "Literal") {
    return {
      valueType: "Literal",
      literalDatatype: template.literalDatatype ?? sparql.literalDatatype,
    };
  }

  if (template?.valueType === "IRI") {
    return { valueType: "IRI" };
  }

  if (statement?.valueType === "Literal" && sparql.valueType === "IRI") {
    return {
      valueType: "Literal",
      literalDatatype: statement.literalDatatype ?? sparql.literalDatatype,
    };
  }

  if (statement?.valueType === "IRI" && sparql.valueType === "Literal") {
    return { valueType: "IRI" };
  }

  return sparql;
}
