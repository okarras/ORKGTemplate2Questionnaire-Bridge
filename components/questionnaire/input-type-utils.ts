import type { InputType, OrkgValueType } from "@/types/template";

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
  if (valueType === "IRI") return "resource";

  if (valueType === "Literal" && literalDatatype) {
    const dt = literalDatatype.toLowerCase();

    if (dt.endsWith("#boolean")) return "checkbox";
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
