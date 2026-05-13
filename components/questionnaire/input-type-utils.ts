import type { InputType, OrkgValueType } from "@/types/template";

/** RDF literal datatype IRIs for xsd:boolean (fragment, path segment, or CURIE-style). */
export function isBooleanLiteralDatatype(literalDatatype?: string): boolean {
  if (!literalDatatype) return false;
  const dt = literalDatatype.trim().toLowerCase();

  if (dt.endsWith("#boolean") || dt.endsWith("/boolean")) return true;
  if (/(^|[#/])boolean$/i.test(dt)) return true;

  return false;
}

const FALLBACK_INPUT_TYPES: InputType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "date",
];

/**
 * Maps ORKG value type (from SPARQL) to form input type.
 * - IRI → resource (autoselect from ORKG)
 * - Literal → from optional RDF `literalDatatype` IRI (XSD), else text
 * - Blank node / Unknown → text (fallback)
 */
export function getInputTypeFromValueType(
  valueType?: OrkgValueType,
  literalDatatype?: string,
): InputType {
  console.log("getInputTypeFromValueType", valueType, literalDatatype);
  if (valueType === "IRI") return "resource";

  if (valueType === "Literal" && literalDatatype) {
    const dt = literalDatatype.toLowerCase();

    if (isBooleanLiteralDatatype(literalDatatype)) return "checkbox";
    if (
      dt.endsWith("#integer") ||
      dt.endsWith("#int") ||
      dt.endsWith("#long") ||
      dt.endsWith("#unsignedint") ||
      dt.endsWith("#decimal") ||
      dt.endsWith("#double") ||
      dt.endsWith("#float")
    )
      return "number";
    if (dt.endsWith("#date") && !dt.includes("datetime")) return "date";
    if (dt.endsWith("#datetime")) return "date";
    if (dt.endsWith("#anyuri")) return "text";
  }

  switch (valueType) {
    case "Literal":
      return "text";
    case "Blank node":
    case "Unknown":
    default:
      return "text";
  }
}

/**
 * Fallback: stable hash-based input type when valueType is unknown.
 * Used before preprocessing completes or when SPARQL fails.
 */
export function getInputTypeForProperty(propertyId: string): InputType {
  let hash = 0;

  for (let i = 0; i < propertyId.length; i++) {
    const char = propertyId.charCodeAt(i);

    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % FALLBACK_INPUT_TYPES.length;

  return FALLBACK_INPUT_TYPES[index];
}
