export type InputType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  | "resource" // ORKG resource autoselect
  | "scale"; // Likert-style rating (e.g. 1-5, Difficult→Easy)

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
export type EnrichedTemplateMapping = Record<
  string,
  EnrichedSubtemplateProperty
>;

/** Custom block types that can be inserted into the questionnaire */
export type CustomBlockType = "text" | "section" | "customField" | "html";

export interface TextBlockData {
  type: "text";
  id: string;
  heading?: string;
  body: string;
}

export interface SectionBlockData {
  type: "section";
  id: string;
  title: string;
  /** Child block ids (custom blocks rendered inside this section) */
  childIds?: string[];
}

export interface CustomFieldBlockData {
  type: "customField";
  id: string;
  label: string;
  inputType: InputType;
  description?: string;
  selectOptions?: { value: string; label: string }[];
  scaleConfig?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
}

export interface HtmlBlockData {
  type: "html";
  id: string;
  html: string;
}

export type CustomBlock =
  | TextBlockData
  | SectionBlockData
  | CustomFieldBlockData
  | HtmlBlockData;

/** Ordered item in the questionnaire: either a template property or a custom block */
export type QuestionnaireBlockItem =
  | { kind: "property"; id: string }
  | { kind: "custom"; id: string };
