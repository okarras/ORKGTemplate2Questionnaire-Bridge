import type {
  EnrichedSubtemplateProperty,
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { FormValue } from "./questionnaire-form-types";

import { getInputTypeFromValueType } from "./input-type-utils";

type PropertyValue = string | number | boolean | string[];

/** Normalize JSON/localStorage string forms to real booleans for checkbox fields. */
export function normalizeCheckboxFormValue(value: FormValue): boolean | FormValue {
  if (value === true || value === false) return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
    if (s === "false" || s === "0" || s === "no" || s === "off" || s === "")
      return false;
  }

  return value;
}

function coerceLeafValue(
  value: FormValue,
  prop: EnrichedSubtemplateProperty,
): FormValue {
  const subs = prop.subtemplate_properties;
  if (subs && Object.keys(subs).length > 0) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value;
    }
    const out: Record<string, FormValue> = {
      ...(value as Record<string, FormValue>),
    };

    for (const [sk, sub] of Object.entries(subs)) {
      if (sk in out) {
        out[sk] = coerceLeafValue(out[sk]!, sub as EnrichedSubtemplateProperty);
      }
    }

    const rootLeaf = getInputTypeFromValueType(
      prop.valueType,
      prop.literalDatatype,
    );

    if (rootLeaf === "checkbox" && "_" in out) {
      out._ = normalizeCheckboxFormValue(out._!) as FormValue;
    }

    return out;
  }

  const leaf = getInputTypeFromValueType(prop.valueType, prop.literalDatatype);

  if (leaf === "checkbox") {
    return normalizeCheckboxFormValue(value) as FormValue;
  }

  return value;
}

/** Coerce persisted/imported values to match declared ORKG literal types (e.g. boolean). */
export function coerceFormValuesToDeclaredTypes(
  mapping: EnrichedTemplateMapping,
  values: Record<string, FormValue>,
): Record<string, FormValue> {
  const out: Record<string, FormValue> = { ...values };

  for (const [id, prop] of Object.entries(mapping)) {
    if (!(id in out)) continue;
    out[id] = coerceLeafValue(out[id]!, prop as EnrichedSubtemplateProperty);
  }

  return out;
}

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

    const enr = prop as EnrichedSubtemplateProperty;

    if (getInputTypeFromValueType(enr.valueType, enr.literalDatatype) === "checkbox") {
      result._ = normalizeCheckboxFormValue(
        (result._ === "" ? false : (result._ as FormValue)) as FormValue,
      ) as PropertyValue;
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
    const v = src as FormValue;
    const leaf = getInputTypeFromValueType(
      (prop as EnrichedSubtemplateProperty).valueType,
      (prop as EnrichedSubtemplateProperty).literalDatatype,
    );

    if (leaf === "checkbox") {
      return normalizeCheckboxFormValue(v) as FormValue;
    }

    return v;
  }

  return "";
}
