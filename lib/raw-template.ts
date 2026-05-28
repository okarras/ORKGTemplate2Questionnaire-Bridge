import type { EnrichedTemplateMapping } from "@/types/template";

export const RAW_TEMPLATE_SESSION_KEY = "raw_template_payload";

export interface RawTemplatePayload {
  templateId: string;
  label: string;
  targetClassId?: string;
  targetClassLabel?: string;
  mapping: EnrichedTemplateMapping;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeMapping(value: unknown): EnrichedTemplateMapping {
  if (!isRecord(value)) {
    throw new Error("Raw template JSON must be an object.");
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    throw new Error("Template mapping is empty.");
  }

  for (const [propId, prop] of entries) {
    if (!isRecord(prop)) {
      throw new Error(`Property "${propId}" must be an object.`);
    }
  }

  return value as EnrichedTemplateMapping;
}

function mappingFromFormStructure(
  formStructure: unknown,
): EnrichedTemplateMapping | null {
  if (!Array.isArray(formStructure)) return null;

  type FSNode = Record<string, unknown>;

  const toProperty = (node: FSNode): Record<string, unknown> => {
    const sub =
      isRecord(node.subproperties) && Object.keys(node.subproperties).length > 0
        ? Object.fromEntries(
            Object.entries(node.subproperties).map(([id, child]) => [
              id,
              isRecord(child) ? toProperty(child) : {},
            ]),
          )
        : undefined;

    return {
      label:
        toNonEmptyString(node.label) ?? toNonEmptyString(node.id) ?? "Field",
      cardinality: toNonEmptyString(node.cardinality) ?? "one to one",
      description: toNonEmptyString(node.description),
      class_id: toNonEmptyString(node.class_id),
      subtemplate_properties: sub,
    };
  };

  const rootEntries: [string, Record<string, unknown>][] = (
    formStructure as unknown[]
  )
    .filter((item) => isRecord(item))
    .filter((item) => item.kind === "property")
    .map((item) => [toNonEmptyString(item.id) ?? "", toProperty(item)]);

  const validEntries = rootEntries.filter(([id]) => id.length > 0);

  if (validEntries.length === 0) return null;

  return normalizeMapping(Object.fromEntries(validEntries));
}

function extractMappingFromRoot(
  root: Record<string, unknown>,
): EnrichedTemplateMapping {
  if (isRecord(root.mapping) && Object.keys(root.mapping).length > 0) {
    return normalizeMapping(root.mapping);
  }
  const fromFormStructure = mappingFromFormStructure(root.formStructure);

  if (fromFormStructure) return fromFormStructure;

  const mappingEntries = Object.entries(root).filter(([, value]) =>
    isRecord(value),
  );

  if (mappingEntries.length === 0) {
    throw new Error(
      'Could not find template mapping. Provide {"mapping": {...}} or top-level property objects.',
    );
  }

  return normalizeMapping(Object.fromEntries(mappingEntries));
}

export function parseRawTemplateInput(text: string): RawTemplatePayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON. Please paste valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Raw template JSON root must be an object.");
  }

  const root = parsed as Record<string, unknown>;
  const mapping = extractMappingFromRoot(root);
  const templateId =
    toNonEmptyString(root.templateId) ??
    toNonEmptyString(root.id) ??
    "RAW_TEMPLATE";
  const label =
    toNonEmptyString(root.label) ??
    toNonEmptyString(root.templateLabel) ??
    "Raw JSON Template";

  return {
    templateId,
    label,
    mapping,
    targetClassId: toNonEmptyString(root.targetClassId),
    targetClassLabel: toNonEmptyString(root.targetClassLabel),
  };
}

export function parseStoredRawTemplatePayload(
  value: string | null,
): RawTemplatePayload | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) return null;

    const mapping = normalizeMapping(parsed.mapping);
    const templateId = toNonEmptyString(parsed.templateId) ?? "RAW_TEMPLATE";
    const label = toNonEmptyString(parsed.label) ?? "Raw JSON Template";

    return {
      templateId,
      label,
      mapping,
      targetClassId: toNonEmptyString(parsed.targetClassId),
      targetClassLabel: toNonEmptyString(parsed.targetClassLabel),
    };
  } catch {
    return null;
  }
}
