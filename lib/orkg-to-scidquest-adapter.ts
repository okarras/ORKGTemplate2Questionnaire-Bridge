/**
 * Converts ORKG EnrichedTemplateMapping to ScidQuest QuestionnaireTemplate format.
 * Enables using ScidQuest's ResearchQuestionnaireApp with ORKG templates.
 */

import type {
  EnrichedTemplateMapping,
  EnrichedSubtemplateProperty,
} from "@/types/template";

/** ScidQuest QuestionnaireTemplate-compatible types */
export interface ScidQuestQuestion {
  id: string;
  label?: string;
  title?: string;
  type: string;
  required?: boolean;
  choice_type?: "single" | "multiple" | "no";
  options?: string[];
  evidence_fields?: string[];
  evidence_per_item?: boolean;
  desc?: string;
  property_id?: string;
  cardinality?: string;
  class_id?: string;
  subtemplate_id?: string;
  item_fields?: ScidQuestQuestion[];
  subquestions?: ScidQuestQuestion[];
}

export interface ScidQuestSection {
  id: string;
  title: string;
  questions: ScidQuestQuestion[];
}

export interface ScidQuestQuestionnaireTemplate {
  version: string;
  template: string;
  template_id: string;
  sections: ScidQuestSection[];
}

function isOneToMany(cardinality?: string): boolean {
  if (!cardinality) return false;
  const c = cardinality.toLowerCase();

  return (
    c === "one to many" ||
    c === "one-to-many" ||
    c === "many" ||
    c === "multiple"
  );
}

function mapValueTypeToQuestionType(prop: EnrichedSubtemplateProperty): string {
  const valueType = prop.valueType;
  const oneToMany = isOneToMany(prop.cardinality);
  const hasNested =
    prop.subtemplate_properties &&
    Object.keys(prop.subtemplate_properties).length > 0;

  if (hasNested) {
    return oneToMany ? "repeat_group" : "group";
  }

  if (oneToMany) {
    return "repeat_text";
  }

  switch (valueType) {
    case "IRI":
      return "text"; // ScidQuest has no ORKG resource autocomplete; use text
    case "Literal":
    case "Blank node":
    case "Unknown":
    default:
      return "text";
  }
}

function convertPropertyToQuestion(
  propId: string,
  prop: EnrichedSubtemplateProperty,
): ScidQuestQuestion {
  const questionType = mapValueTypeToQuestionType(prop);
  const oneToMany = isOneToMany(prop.cardinality);
  const nested = prop.subtemplate_properties;

  const baseQuestion: ScidQuestQuestion = {
    id: propId,
    label: prop.label || propId,
    title: prop.label || propId,
    type: questionType,
    required: oneToMany ? true : false,
    choice_type: "no",
    options: [],
    evidence_fields: ["pages", "quote"],
    desc: prop.description,
    property_id: propId,
    cardinality: prop.cardinality,
    class_id: prop.class_id,
    subtemplate_id: prop.subtemplate_id,
  };

  if (questionType === "group" && nested) {
    const subquestions: ScidQuestQuestion[] = [];

    for (const [subId, subProp] of Object.entries(nested)) {
      subquestions.push(convertPropertyToQuestion(subId, subProp));
    }
    baseQuestion.subquestions = subquestions;
  }

  if (questionType === "repeat_group" && nested) {
    const itemFields: ScidQuestQuestion[] = [];

    for (const [subId, subProp] of Object.entries(nested)) {
      itemFields.push(convertPropertyToQuestion(subId, subProp));
    }
    baseQuestion.item_fields = itemFields;
    baseQuestion.evidence_per_item = true;
  }

  return baseQuestion;
}

/**
 * Converts ORKG EnrichedTemplateMapping to ScidQuest QuestionnaireTemplate.
 * Top-level properties with nested subtemplate_properties become sections.
 * Leaf properties are grouped into a "Main" section.
 */
export function orkgToScidQuestTemplate(
  mapping: EnrichedTemplateMapping,
  templateId: string,
  templateLabel: string,
): ScidQuestQuestionnaireTemplate {
  const sections: ScidQuestSection[] = [];
  const mainQuestions: ScidQuestQuestion[] = [];

  for (const [propId, prop] of Object.entries(mapping)) {
    const hasNested =
      prop.subtemplate_properties &&
      Object.keys(prop.subtemplate_properties).length > 0;

    if (hasNested) {
      const sectionQuestions: ScidQuestQuestion[] = [];
      const question = convertPropertyToQuestion(propId, prop);

      sectionQuestions.push(question);
      sections.push({
        id: propId,
        title: prop.label || prop.subtemplate_label || propId,
        questions: sectionQuestions,
      });
    } else {
      mainQuestions.push(convertPropertyToQuestion(propId, prop));
    }
  }

  if (mainQuestions.length > 0) {
    sections.unshift({
      id: "main",
      title: "Main",
      questions: mainQuestions,
    });
  }

  return {
    version: "1.0",
    template: templateLabel,
    template_id: templateId,
    sections,
  };
}
