import type {
  EnrichedSubtemplateProperty,
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { FormValue } from "./questionnaire-form-types";

import { getInputTypeFromValueType } from "./input-type-utils";

type PropertyValue = string | number | boolean | string[];

function createEmptyValue(prop: EnrichedSubtemplateProperty): FormValue {
  if (
    prop.subtemplate_properties &&
    Object.keys(prop.subtemplate_properties).length > 0
  ) {
    const obj: Record<string, FormValue> = { _: "" };

    for (const subId of Object.keys(prop.subtemplate_properties)) {
      const sub = prop.subtemplate_properties[subId]!;

      obj[subId] = createEmptyValue(sub as EnrichedSubtemplateProperty);
    }

    return obj;
  }

  const leaf = getInputTypeFromValueType(prop.valueType, prop.literalDatatype);

  if (leaf === "checkbox") return false;

  return "";
}

export function buildInitialValues(
  mapping: EnrichedTemplateMapping,
): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};

  for (const [id, prop] of Object.entries(mapping)) {
    values[id] = createEmptyValue(prop);
  }

  return values;
}

export function flattenForJson(
  v: FormValue,
  prop: SubtemplateProperty,
): unknown {
  if (v === undefined || v === null) return undefined;
  if (v === "" || (Array.isArray(v) && v.length === 0)) return undefined;
  if (typeof v === "object" && !Array.isArray(v) && v !== null) {
    const obj: Record<string, unknown> = {};
    const nested = prop.subtemplate_properties;

    if (nested && "_" in v && v._ !== undefined && v._ !== "") {
      obj.value = v._;
    }
    if (nested) {
      for (const [k, subProp] of Object.entries(nested)) {
        const subVal = (v as Record<string, FormValue>)[k];
        const flattened = flattenForJson(subVal, subProp);

        if (flattened !== undefined) obj[k] = flattened;
      }
    }

    return Object.keys(obj).length > 0 ? obj : undefined;
  }

  return v;
}

export function inflateFromJson(
  src: unknown,
  prop: SubtemplateProperty,
): FormValue {
  const hasSubs =
    prop.subtemplate_properties &&
    Object.keys(prop.subtemplate_properties).length > 0;

  if (hasSubs) {
    const srcObj =
      src && typeof src === "object" && !Array.isArray(src)
        ? (src as Record<string, unknown>)
        : {};
    const result: Record<string, FormValue> = { _: "" };

    if ("value" in srcObj && srcObj.value !== undefined) {
      result._ = srcObj.value as PropertyValue;
    }

    for (const [k, subProp] of Object.entries(
      prop.subtemplate_properties as Record<string, SubtemplateProperty>,
    )) {
      result[k] = inflateFromJson(srcObj[k], subProp);
    }

    return result;
  }

  if (src === undefined || src === null || src === "") {
    return "";
  }

  if (
    typeof src === "string" ||
    typeof src === "number" ||
    typeof src === "boolean" ||
    Array.isArray(src)
  ) {
    return src as FormValue;
  }

  return "";
}
