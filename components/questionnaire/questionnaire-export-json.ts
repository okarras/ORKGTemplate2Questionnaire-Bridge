import type {
  CustomBlock,
  EnrichedTemplateMapping,
  InputType,
  SubtemplateProperty,
} from "@/types/template";
import type { FormValue, OrderedBlock } from "./questionnaire-form-types";

import { CUSTOM_PREFIX } from "./questionnaire-form-constants";
import { flattenForJson } from "./questionnaire-form-value-helpers";

export interface DownloadQuestionnaireJsonParams {
  templateId: string;
  label: string;
  mapping: EnrichedTemplateMapping;
  values: Record<string, FormValue>;
  orderedBlocks: OrderedBlock[];
  customBlocks: Record<string, CustomBlock>;
  removedBuiltinProperties: string[];
  nestedCustomBlocks: Record<string, string[]>;
  getEffectiveProperty(
    path: string,
    prop: SubtemplateProperty,
  ): SubtemplateProperty;
  getInputTypeForPath(path: string, prop: SubtemplateProperty): InputType;
}

export function downloadQuestionnaireJsonExport(
  params: DownloadQuestionnaireJsonParams,
): void {
  const {
    templateId,
    label,
    mapping,
    values,
    orderedBlocks,
    customBlocks,
    removedBuiltinProperties,
    nestedCustomBlocks,
    getEffectiveProperty,
    getInputTypeForPath,
  } = params;

  const extractCustomBlock = (id: string): any => {
    const block = customBlocks[id];

    if (!block) return null;

    const exported: any = { ...block };

    if (block.type === "section" && block.childIds) {
      exported.children = block.childIds
        .map(extractCustomBlock)
        .filter(Boolean);
    }
    const val = values[CUSTOM_PREFIX + id];

    if (val !== undefined) {
      exported.value = val;
    }

    return exported;
  };

  const getValueForPath = (path: string): any => {
    const segments = path.split(".");

    if (!segments.length) return undefined;
    const rootId = segments[0]!;
    let current = values[rootId];

    if (current === undefined) return undefined;
    if (segments.length === 1) return current;
    let obj: any = current;

    for (let i = 1; i < segments.length; i++) {
      const key = segments[i]!;

      if (typeof obj !== "object" || obj === null || Array.isArray(obj))
        return undefined;
      obj = obj[key];
    }

    return obj;
  };

  const extractPropertyData = (
    path: string,
    prop: SubtemplateProperty,
  ): any => {
    if ((removedBuiltinProperties || []).includes(path)) return null;

    const effectiveProp = getEffectiveProperty(path, prop);
    const inputType = getInputTypeForPath(path, prop);
    const val = getValueForPath(path);

    const subProps: Record<string, any> = {};

    if (prop.subtemplate_properties) {
      for (const [subId, subProp] of Object.entries(
        prop.subtemplate_properties,
      )) {
        const subPath = `${path}.${subId}`;
        const subData = extractPropertyData(subPath, subProp);

        if (subData) {
          subProps[subId] = subData;
        }
      }
    }

    const nestedBlocks = nestedCustomBlocks[path] || [];
    const extractedNestedBlocks = nestedBlocks
      .map(extractCustomBlock)
      .filter(Boolean);

    return {
      id: "id" in prop ? (prop as any).id : path.split(".").pop(),
      path,
      label: effectiveProp.label,
      description: effectiveProp.description,
      cardinality: effectiveProp.cardinality,
      class_id: effectiveProp.class_id,
      inputType,
      value: flattenForJson(val, prop),
      raw_value: val,
      subproperties: Object.keys(subProps).length > 0 ? subProps : undefined,
      nestedCustomBlocks:
        extractedNestedBlocks.length > 0 ? extractedNestedBlocks : undefined,
    };
  };

  const exportedBlocks = orderedBlocks
    .map((block) => {
      if (block.kind === "property") {
        const prop = mapping[block.id];

        if (!prop) return null;

        return {
          kind: "property",
          ...extractPropertyData(block.id, prop),
        };
      } else {
        return {
          kind: "custom",
          ...extractCustomBlock(block.id),
        };
      }
    })
    .filter(Boolean);

  const exportData: Record<string, unknown> = {
    templateId,
    templateLabel: label,
    exportedAt: new Date().toISOString(),
    formStructure: exportedBlocks,
    answers: {},
    customAnswers: {},
  };

  for (const [propId, prop] of Object.entries(mapping)) {
    const v = values[propId];
    const flattened = flattenForJson(v, prop);

    if (flattened !== undefined) {
      (exportData.answers as Record<string, unknown>)[propId] = flattened;
    }
  }

  for (const [key, v] of Object.entries(values)) {
    if (
      key.startsWith(CUSTOM_PREFIX) &&
      v !== undefined &&
      v !== "" &&
      v !== null
    ) {
      const customId = key.slice(CUSTOM_PREFIX.length);

      (exportData.customAnswers as Record<string, unknown>)[customId] = v;
    }
  }
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `questionnaire-${templateId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
