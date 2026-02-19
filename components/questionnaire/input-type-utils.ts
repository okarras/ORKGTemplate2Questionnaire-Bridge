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
 * - Literal → text
 * - Blank node / Unknown → text (fallback)
 */
export function getInputTypeFromValueType(
  valueType?: OrkgValueType
): InputType {
  switch (valueType) {
    case "IRI":
      return "resource";
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
