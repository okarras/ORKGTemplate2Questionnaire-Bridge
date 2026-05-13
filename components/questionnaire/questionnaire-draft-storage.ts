import type { CustomBlock } from "@/types/template";
import type { EnrichedTemplateMapping } from "@/types/template";
import type {
  FieldOverrides,
  FormValue,
  OrderedBlock,
} from "./questionnaire-form-types";

import { buildInitialValues, coerceFormValuesToDeclaredTypes } from "./questionnaire-form-value-helpers";

export const QUESTIONNAIRE_DRAFT_STORAGE_VERSION = 1 as const;

export const QUESTIONNAIRE_DRAFT_KEY_PREFIX = "dynq_questionnaire_v1:";

export function questionnaireDraftStorageKey(templateId: string): string {
  return `${QUESTIONNAIRE_DRAFT_KEY_PREFIX}${templateId}`;
}

export type QuestionnaireStructureDraft = {
  orderedBlocks: OrderedBlock[];
  customBlocks: Record<string, CustomBlock>;
  fieldOverrides: FieldOverrides;
  nestedCustomBlocks: Record<string, string[]>;
  removedBuiltinProperties?: string[];
};

export type PersistedQuestionnaireDraft = {
  v: typeof QUESTIONNAIRE_DRAFT_STORAGE_VERSION;
  values: Record<string, FormValue>;
  structure: QuestionnaireStructureDraft;
};

function isStructureDraft(x: unknown): x is QuestionnaireStructureDraft {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;

  return (
    Array.isArray(o.orderedBlocks) &&
    o.customBlocks !== null &&
    typeof o.customBlocks === "object" &&
    o.fieldOverrides !== null &&
    typeof o.fieldOverrides === "object" &&
    o.nestedCustomBlocks !== null &&
    typeof o.nestedCustomBlocks === "object"
  );
}

export function defaultStructureDraftFromMapping(
  mapping: EnrichedTemplateMapping,
): QuestionnaireStructureDraft {
  return {
    orderedBlocks: (Object.keys(mapping) as string[]).map((id) => ({
      kind: "property" as const,
      id,
    })),
    customBlocks: {},
    fieldOverrides: {},
    nestedCustomBlocks: {},
    removedBuiltinProperties: [],
  };
}

export function reconcileStructureDraft(
  structure: QuestionnaireStructureDraft,
  mapping: EnrichedTemplateMapping,
): QuestionnaireStructureDraft {
  const propIds = Object.keys(mapping);
  const validProp = new Set(propIds);
  const nextOrdered: OrderedBlock[] = [];
  const seenProp = new Set<string>();

  for (const b of structure.orderedBlocks) {
    if (b.kind === "custom") {
      if (structure.customBlocks[b.id]) nextOrdered.push(b);
    } else if (validProp.has(b.id)) {
      nextOrdered.push(b);
      seenProp.add(b.id);
    }
  }

  for (const id of propIds) {
    if (!seenProp.has(id)) {
      nextOrdered.push({ kind: "property", id });
      seenProp.add(id);
    }
  }

  return {
    ...structure,
    orderedBlocks: nextOrdered,
    customBlocks: { ...structure.customBlocks },
    fieldOverrides: { ...structure.fieldOverrides },
    nestedCustomBlocks: { ...structure.nestedCustomBlocks },
    removedBuiltinProperties: [...(structure.removedBuiltinProperties ?? [])],
  };
}

export function loadQuestionnaireDraft(
  templateId: string,
): PersistedQuestionnaireDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      questionnaireDraftStorageKey(templateId),
    );

    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;

    if (o.v !== QUESTIONNAIRE_DRAFT_STORAGE_VERSION) return null;
    if (!o.values || typeof o.values !== "object") return null;
    if (!isStructureDraft(o.structure)) return null;

    return {
      v: QUESTIONNAIRE_DRAFT_STORAGE_VERSION,
      values: o.values as Record<string, FormValue>,
      structure: o.structure,
    };
  } catch {
    return null;
  }
}

export function saveQuestionnaireDraft(
  templateId: string,
  draft: PersistedQuestionnaireDraft,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      questionnaireDraftStorageKey(templateId),
      JSON.stringify(draft),
    );
  } catch {
    /* quota / private mode */
  }
}

export function mergeLoadedFormValues(
  mapping: EnrichedTemplateMapping,
  saved: Record<string, FormValue> | undefined | null,
): Record<string, FormValue> {
  const base = buildInitialValues(mapping);

  if (!saved) return base;

  const out = { ...base };

  for (const k of Object.keys(base)) {
    if (k in saved) out[k] = saved[k]!;
  }

  for (const k of Object.keys(saved)) {
    if (!(k in base)) out[k] = saved[k]!;
  }

  return coerceFormValuesToDeclaredTypes(mapping, out);
}
