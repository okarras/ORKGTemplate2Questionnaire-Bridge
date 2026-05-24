import type {
  CustomBlock,
  EnrichedSubtemplateProperty,
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";
import type { FieldOverrides, FormValue } from "./questionnaire-form-types";

import { dedupeOrkgResourceIris } from "@/lib/orkg-resource-ids";

import { CUSTOM_PREFIX } from "./questionnaire-form-constants";
import { parseStoredMultiDefault } from "./field-default-value-utils";
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

  if (prop.cardinality?.toLowerCase() === "one to many") return [];

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

function isScalarFormEmpty(v: FormValue): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;

  return false;
}

function applyEmptyDefaultToLeaf(
  v: FormValue,
  prop: EnrichedSubtemplateProperty,
  def: string,
): FormValue {
  const trimmed = def.trim();

  if (!trimmed) return v;
  const many = prop.cardinality?.toLowerCase() === "one to many";
  const leaf = getInputTypeFromValueType(
    prop.valueType,
    prop.literalDatatype,
  );

  if (many) {
    const empty = Array.isArray(v) ? v.length === 0 : isScalarFormEmpty(v);

    if (!empty) {
      if (Array.isArray(v)) return v;

      return v;
    }

    const parts = parseStoredMultiDefault(trimmed);

    if (parts.length === 0) return v;

    if (leaf === "number") {
      return parts.map((p) => {
        const n = Number(p);

        return Number.isFinite(n) ? n : p;
      }) as FormValue;
    }

    if (leaf === "resource" || prop.valueType === "IRI") {
      return dedupeOrkgResourceIris(parts) as FormValue;
    }

    return parts as FormValue;
  }

  if (!isScalarFormEmpty(v)) return v;

  if (leaf === "checkbox") {
    const t = trimmed.toLowerCase();

    return t === "true" || t === "1" || t === "yes";
  }

  if (leaf === "number") {
    const n = Number(trimmed);

    return Number.isFinite(n) ? n : trimmed;
  }

  return trimmed;
}

/**
 * Deep-merge `fieldOverrides[*].emptyDefault` into property answers for fill mode / export / submit.
 * Only keys present in `mapping` are transformed; custom `__custom_*` entries are left unchanged.
 */
export function mergeFillModeEmptyDefaults(
  values: Record<string, FormValue>,
  mapping: EnrichedTemplateMapping,
  fieldOverrides: FieldOverrides,
): Record<string, FormValue> {
  function walk(
    v: FormValue,
    prop: EnrichedSubtemplateProperty,
    path: string,
  ): FormValue {
    const o = fieldOverrides[path];
    const subs = prop.subtemplate_properties;

    if (subs && Object.keys(subs).length > 0) {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return v;
      const obj: Record<string, FormValue> = {
        ...(v as Record<string, FormValue>),
      };

      for (const [sk, sub] of Object.entries(subs)) {
        const subPath = `${path}.${sk}`;

        if (sk in obj) {
          obj[sk] = walk(obj[sk]!, sub as EnrichedSubtemplateProperty, subPath);
        }
      }

      const def = o?.emptyDefault;

      if (def !== undefined && "_" in obj) {
        const rootProp = { ...prop, subtemplate_properties: undefined };
        const cur = obj._;

        if (isScalarFormEmpty(cur as FormValue)) {
          obj._ = applyEmptyDefaultToLeaf(
            cur as FormValue,
            rootProp as EnrichedSubtemplateProperty,
            def,
          ) as FormValue;
        }
      }

      return obj;
    }

    const def = o?.emptyDefault;

    if (def === undefined) return v;

    return applyEmptyDefaultToLeaf(v, prop, def) as FormValue;
  }

  const out: Record<string, FormValue> = { ...values };

  for (const id of Object.keys(mapping)) {
    if (!(id in out)) continue;
    out[id] = walk(out[id]!, mapping[id]!, id);
  }

  return out;
}

function applyEmptyDefaultToCustomField(
  v: FormValue,
  inputType: InputType,
  def: string,
): FormValue {
  const trimmed = def.trim();

  if (!trimmed) return v;
  if (!isScalarFormEmpty(v)) return v;

  if (inputType === "checkbox") {
    const t = trimmed.toLowerCase();

    return t === "true" || t === "1" || t === "yes";
  }

  if (inputType === "number") {
    const n = Number(trimmed);

    return Number.isFinite(n) ? n : trimmed;
  }

  if (inputType === "select") {
    return trimmed;
  }

  return trimmed;
}

/** Apply `emptyDefault` on custom field blocks (`__custom_*` keys). */
export function mergeCustomFieldEmptyDefaults(
  values: Record<string, FormValue>,
  customBlocks: Record<string, CustomBlock>,
): Record<string, FormValue> {
  let changed = false;
  const out: Record<string, FormValue> = { ...values };

  for (const block of Object.values(customBlocks)) {
    if (block.type !== "customField") continue;
    const def = block.emptyDefault?.trim();

    if (!def) continue;

    const key = `${CUSTOM_PREFIX}${block.id}`;
    const cur = out[key];

    if (cur === undefined) continue;

    const next = applyEmptyDefaultToCustomField(cur, block.inputType, def);

    if (next !== cur) {
      out[key] = next;
      changed = true;
    }
  }

  return changed ? out : values;
}

/** Merge template property and custom field empty defaults (fill mode / export / submit). */
export function mergeQuestionnaireFillDefaults(
  values: Record<string, FormValue>,
  mapping: EnrichedTemplateMapping,
  fieldOverrides: FieldOverrides,
  customBlocks: Record<string, CustomBlock> = {},
): Record<string, FormValue> {
  return mergeCustomFieldEmptyDefaults(
    mergeFillModeEmptyDefaults(values, mapping, fieldOverrides),
    customBlocks,
  );
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
