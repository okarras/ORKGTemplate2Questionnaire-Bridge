/**
 * Converts ORKG EnrichedTemplateMapping to ScidQuest QuestionnaireTemplate format.
 * Enables using ScidQuest's ResearchQuestionnaireApp with ORKG templates.
 */

import type {
  EnrichedTemplateMapping,
  EnrichedSubtemplateProperty,
} from "@/types/template";

import {
  ORKG_SPARQL_ENDPOINT,
  buildResourcesQuery,
} from "./sparql/orkg-queries";

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

async function fetchOrkgResourceOptions(
  predicateId: string,
  classId?: string,
  cache?: Map<string, string[]>,
): Promise<string[]> {
  const cacheKey = `${predicateId}|${classId ?? ""}`;

  if (cache?.has(cacheKey)) return cache.get(cacheKey)!;

  const query = buildResourcesQuery(predicateId, {
    classId: classId && classId.startsWith("C") ? classId : undefined,
    limit: 500,
  });

  if (!query) {
    cache?.set(cacheKey, []);

    return [];
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
      cache?.set(cacheKey, []);

      return [];
    }

    const result: any = await response.json();
    const bindings = result?.results?.bindings ?? [];

    const labels: string[] = bindings
      .map((b: any) => b?.oLabel?.value ?? b?.o?.value)
      .filter(Boolean)
      .map((v: any) => String(v));

    const unique: string[] = Array.from(new Set(labels)).sort((a, b) =>
      a.localeCompare(b),
    );

    cache?.set(cacheKey, unique);

    return unique;
  } catch {
    cache?.set(cacheKey, []);

    return [];
  }
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

  // Leaf fields: decide how ScidQuest should render them.
  // ScidQuest uses these strings in its QuestionRenderer.
  switch (valueType) {
    case "IRI":
      // ORKG resources: render as dropdown(s).
      return oneToMany ? "multi_select" : "single_select";
    case "Literal":
      return oneToMany ? "repeat_text" : "text";
    case "Blank node":
    case "Unknown":
    default:
      // Fallback: treat as plain text (and allow repeating if needed).
      return oneToMany ? "repeat_text" : "text";
  }
}

async function convertPropertyToQuestion(
  propId: string,
  prop: EnrichedSubtemplateProperty,
  optionsCache: Map<string, string[]>,
): Promise<ScidQuestQuestion> {
  const questionType = mapValueTypeToQuestionType(prop);
  const oneToMany = isOneToMany(prop.cardinality);
  const nested = prop.subtemplate_properties;

  const choiceType: ScidQuestQuestion["choice_type"] =
    questionType === "multi_select"
      ? "multiple"
      : questionType === "single_select"
        ? "single"
        : "no";

  const baseQuestion: ScidQuestQuestion = {
    id: propId,
    label: prop.label || propId,
    title: prop.label || propId,
    type: questionType,
    required: oneToMany ? true : false,
    choice_type: choiceType,
    // Populate options later (or extend the converter to fetch them from ORKG).
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
      subquestions.push(
        await convertPropertyToQuestion(subId, subProp, optionsCache),
      );
    }
    baseQuestion.subquestions = subquestions;
  }

  if (questionType === "repeat_group" && nested) {
    const itemFields: ScidQuestQuestion[] = [];

    for (const [subId, subProp] of Object.entries(nested)) {
      itemFields.push(
        await convertPropertyToQuestion(subId, subProp, optionsCache),
      );
    }
    baseQuestion.item_fields = itemFields;
    baseQuestion.evidence_per_item = true;
  }

  if (questionType === "single_select" || questionType === "multi_select") {
    baseQuestion.options = await fetchOrkgResourceOptions(
      propId,
      prop.class_id,
      optionsCache,
    );
  }

  return baseQuestion;
}

/**
 * Converts ORKG EnrichedTemplateMapping to ScidQuest QuestionnaireTemplate.
 * Top-level properties with nested subtemplate_properties become sections.
 * Leaf properties are grouped into a "Main" section.
 */
export async function orkgToScidQuestTemplate(
  mapping: EnrichedTemplateMapping,
  templateId: string,
  templateLabel: string,
): Promise<ScidQuestQuestionnaireTemplate> {
  const sections: ScidQuestSection[] = [];
  const mainQuestions: ScidQuestQuestion[] = [];
  const optionsCache = new Map<string, string[]>();

  for (const [propId, prop] of Object.entries(mapping)) {
    const hasNested =
      prop.subtemplate_properties &&
      Object.keys(prop.subtemplate_properties).length > 0;

    if (hasNested) {
      const sectionQuestions: ScidQuestQuestion[] = [];
      const question = await convertPropertyToQuestion(
        propId,
        prop,
        optionsCache,
      );

      sectionQuestions.push(question);
      sections.push({
        id: propId,
        title: prop.label || prop.subtemplate_label || propId,
        questions: sectionQuestions,
      });
    } else {
      mainQuestions.push(
        await convertPropertyToQuestion(propId, prop, optionsCache),
      );
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
