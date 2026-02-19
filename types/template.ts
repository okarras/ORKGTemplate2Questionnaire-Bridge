export type InputType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  | "resource"; // ORKG resource autoselect

/**
 * Value type detected from SPARQL query against ORKG.
 * - Literal: plain text input
 * - IRI: resource autoselect (dropdown of ORKG resources)
 * - Blank: nested/structured (handled as resource or form group)
 */
export type OrkgValueType = "Literal" | "IRI" | "Blank node" | "Unknown";

export interface SubtemplateProperty {
  label: string;
  cardinality: string;
  description?: string;
  predicate_label?: string;
  class_label?: string;
  subtemplate_id?: string;
  subtemplate_label?: string;
  class_id?: string;
  /** Link to create a new ORKG resource of this class (e.g. https://orkg.org/resources/create?classes={class_id}) */
  create_link?: string;
  subtemplate_properties?: Record<string, SubtemplateProperty>;
}

/** Property enriched with SPARQL-detected value type from preprocessing */
export interface EnrichedSubtemplateProperty extends SubtemplateProperty {
  valueType?: OrkgValueType;
}

export type TemplateMapping = Record<string, SubtemplateProperty>;
export type EnrichedTemplateMapping = Record<string, EnrichedSubtemplateProperty>;
