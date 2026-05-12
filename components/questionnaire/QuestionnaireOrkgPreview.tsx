"use client";

import type { CustomBlock } from "@/types/template";
import type {
  EnrichedSubtemplateProperty,
  EnrichedTemplateMapping,
  InputType,
} from "@/types/template";
import type { FieldOverrides, FormValue } from "./questionnaire-form-types";

import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import clsx from "clsx";

import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";
import { CUSTOM_PREFIX } from "./questionnaire-form-constants";
import {
  defaultStructureDraftFromMapping,
  type QuestionnaireStructureDraft,
} from "./questionnaire-draft-storage";
import { getBlockSortId } from "./SortableBlockItem";

import {
  getOrkgResourceLink,
  getOrkgResourceLinkFromIri,
} from "@/lib/orkg-links";
import { normalizeOrkgResourceIri } from "@/lib/orkg-resource-ids";
import { ResourceLabelCache } from "@/lib/resource-label-cache";

const ORKG_ACCENT = "text-[#c1272d]";

function isManyCardinality(cardinality?: string): boolean {
  if (!cardinality) return false;
  const n = cardinality.toLowerCase();

  return (
    n === "one to many" ||
    n === "one-to-many" ||
    n === "many" ||
    n === "multiple"
  );
}

function hasSubProperties(prop: EnrichedSubtemplateProperty): boolean {
  const s = prop.subtemplate_properties;

  return Boolean(s && Object.keys(s).length > 0);
}

function shortPropertyId(id: string): string {
  if (/^[RC][A-Za-z0-9_-]+$/.test(id)) return id;
  const i = id.lastIndexOf("/");

  if (i >= 0) {
    const tail = id.slice(i + 1);

    if (tail.length > 0 && tail.length <= 16) return tail;
  }

  return id.length > 14 ? `${id.slice(0, 12)}…` : id;
}

function getEffectiveInputType(
  propertyId: string,
  prop: EnrichedSubtemplateProperty,
): InputType {
  if (prop.valueType !== undefined) {
    return getInputTypeFromValueType(prop.valueType, prop.literalDatatype);
  }

  return getInputTypeForProperty(propertyId);
}

function getEffectiveInputTypeForPreview(
  path: string,
  propId: string,
  prop: EnrichedSubtemplateProperty,
  fieldOverrides: FieldOverrides,
): InputType {
  const o = fieldOverrides[path];

  if (o?.inputType) return o.inputType;

  return getEffectiveInputType(propId, prop);
}

function previewPropLabel(
  path: string,
  prop: EnrichedSubtemplateProperty,
  fieldOverrides: FieldOverrides,
): string {
  return fieldOverrides[path]?.label ?? prop.label;
}

function orkgResourcePageUrl(raw: string): string | null {
  const t = raw.trim();

  if (!t) return null;
  const byId = getOrkgResourceLink(t);

  if (byId) return byId;

  return getOrkgResourceLinkFromIri(normalizeOrkgResourceIri(t));
}

function resourceStringsFromFormValue(value: FormValue): string[] {
  if (value === undefined || value === null || value === "") return [];

  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "string" && v.trim()) as string[];
  }

  if (typeof value === "string") return value.trim() ? [value] : [];

  if (typeof value === "object" && !Array.isArray(value)) {
    const inner = (value as { _?: FormValue })._;

    if (inner !== undefined) return resourceStringsFromFormValue(inner);
  }

  return [];
}

function formatLeafDisplay(
  prop: EnrichedSubtemplateProperty,
  value: FormValue,
  inputType: InputType,
): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object" && !Array.isArray(value)) {
    const v = (value as { _?: unknown })._;

    if (v !== undefined && v !== "" && v !== null)
      return formatLeafDisplay(prop, v as FormValue, inputType);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";

    return value
      .map((v) =>
        typeof v === "string" ? ResourceLabelCache.get(v) || v : String(v),
      )
      .join(", ");
  }

  if (typeof value === "boolean") return value ? "true" : "false";

  if (inputType === "resource" && typeof value === "string") {
    return ResourceLabelCache.get(value) || value;
  }

  if (value === "") return "—";

  return String(value);
}

function ResourceValueLinks({
  inputType,
  value,
  plain,
}: {
  inputType: InputType;
  value: FormValue;
  plain: string;
}) {
  if (inputType !== "resource") {
    return (
      <span className={clsx("font-medium break-all", ORKG_ACCENT)}>
        {plain}
      </span>
    );
  }

  const parts = resourceStringsFromFormValue(value);

  if (parts.length === 0) {
    return (
      <span className={clsx("font-medium break-all", ORKG_ACCENT)}>—</span>
    );
  }

  return (
    <span className={clsx("font-medium break-all", ORKG_ACCENT)}>
      {parts.map((raw, i) => {
        const href = orkgResourcePageUrl(raw);
        const label = ResourceLabelCache.get(raw) || raw;
        const sep = i < parts.length - 1 ? ", " : null;

        return (
          <Fragment key={`${raw}-${i}`}>
            {href ? (
              <a
                className="underline underline-offset-2 hover:opacity-90"
                href={href}
                rel="noreferrer"
                target="_blank"
              >
                {label}
              </a>
            ) : (
              <span>{label}</span>
            )}
            {sep}
          </Fragment>
        );
      })}
    </span>
  );
}

function typeChipLabel(inputType: InputType): string {
  if (inputType === "checkbox") return "Boolean";
  if (inputType === "number") return "Number";
  if (inputType === "date") return "Date";
  if (inputType === "resource") return "Resource";
  if (inputType === "select" || inputType === "scale") return "Literal";

  return "Literal";
}

function buildNestedSummary(
  prop: EnrichedSubtemplateProperty,
  value: FormValue,
  fieldOverrides: FieldOverrides,
  basePath: string,
  removed: string[],
): string {
  const subs = prop.subtemplate_properties;

  if (
    !subs ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  )
    return "";

  const obj = value as Record<string, FormValue>;
  const parts: string[] = [];

  for (const [sid, sub] of Object.entries(subs)) {
    const subPath = `${basePath}.${sid}`;

    if (removed.includes(subPath)) continue;

    const subProp = sub as EnrichedSubtemplateProperty;
    const v = obj[sid];
    const inputType = getEffectiveInputTypeForPreview(
      subPath,
      sid,
      subProp,
      fieldOverrides,
    );

    if (hasSubProperties(subProp)) {
      const inner = buildNestedSummary(
        subProp,
        v ?? "",
        fieldOverrides,
        subPath,
        removed,
      );

      if (inner) {
        parts.push(
          `${previewPropLabel(subPath, subProp, fieldOverrides)}: ${inner}`,
        );
      }
    } else {
      parts.push(
        `${previewPropLabel(subPath, subProp, fieldOverrides)}: ${formatLeafDisplay(subProp, v ?? "", inputType)}`,
      );
    }
  }

  return parts.join(", ");
}

function collectExpandablePaths(
  mapping: EnrichedTemplateMapping,
  values: Record<string, FormValue>,
  structure: QuestionnaireStructureDraft,
): string[] {
  const keys: string[] = [];
  const removed = structure.removedBuiltinProperties ?? [];

  function walk(
    path: string,
    prop: EnrichedSubtemplateProperty,
    value: FormValue,
  ) {
    if (!hasSubProperties(prop)) return;
    keys.push(path);

    if (isManyCardinality(prop.cardinality) && Array.isArray(value)) {
      value.forEach((item, idx) => {
        walk(
          `${path}[${idx}]`,
          { ...prop, cardinality: "one to one" },
          item as FormValue,
        );
      });

      return;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, FormValue>;
      const subs = prop.subtemplate_properties!;

      for (const sid of Object.keys(subs)) {
        if (removed.includes(`${path}.${sid}`)) continue;
        walk(`${path}.${sid}`, subs[sid]!, obj[sid] ?? "");
      }
    }
  }

  for (const b of structure.orderedBlocks) {
    if (b.kind !== "property") continue;
    if (removed.includes(b.id)) continue;
    const p = mapping[b.id];

    if (p) walk(b.id, p, values[b.id] ?? "");
  }

  return keys;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface OrkgPreviewPropertyNodeProps {
  path: string;
  propId: string;
  prop: EnrichedSubtemplateProperty;
  value: FormValue;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  fieldOverrides: FieldOverrides;
  removedBuiltinProperties: string[];
}

function OrkgPreviewPropertyNode({
  path,
  propId,
  prop,
  value,
  depth,
  expanded,
  onToggle,
  fieldOverrides,
  removedBuiltinProperties,
}: OrkgPreviewPropertyNodeProps) {
  const inputType = getEffectiveInputTypeForPreview(
    path,
    propId,
    prop,
    fieldOverrides,
  );
  const subs = prop.subtemplate_properties;
  const hasSubs = hasSubProperties(prop);
  const idChip = shortPropertyId(propId);
  const effLabel = previewPropLabel(path, prop, fieldOverrides);

  if (hasSubs && isManyCardinality(prop.cardinality) && Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div
          className={clsx(
            "text-sm text-default-500 py-1",
            depth > 0 && "ml-1 border-l border-default-200 pl-3",
          )}
        >
          {effLabel} — <span className={ORKG_ACCENT}>no entries</span>
        </div>
      );
    }

    return (
      <div className={clsx(depth > 0 && "mt-1")}>
        {value.map((item, idx) => (
          <OrkgPreviewPropertyNode
            key={`${path}-${idx}`}
            depth={depth}
            expanded={expanded}
            fieldOverrides={fieldOverrides}
            path={`${path}[${idx}]`}
            prop={{ ...prop, cardinality: "one to one" }}
            propId={propId}
            removedBuiltinProperties={removedBuiltinProperties}
            value={item as FormValue}
            onToggle={onToggle}
          />
        ))}
      </div>
    );
  }

  if (hasSubs) {
    const obj =
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, FormValue>)
        : ({} as Record<string, FormValue>);
    const summary = buildNestedSummary(
      prop,
      value,
      fieldOverrides,
      path,
      removedBuiltinProperties,
    );
    const isOpen = expanded.has(path);
    const displayRoot =
      obj._ !== undefined &&
      obj._ !== "" &&
      (typeof obj._ === "string" ||
        typeof obj._ === "number" ||
        typeof obj._ === "boolean");

    const rootInputType = getEffectiveInputTypeForPreview(
      path,
      propId,
      prop,
      fieldOverrides,
    );
    const rootStr = displayRoot
      ? formatLeafDisplay(prop, obj._ as FormValue, rootInputType)
      : "";

    return (
      <div className={clsx(depth > 0 && "mt-1")}>
        <div
          className={clsx(
            "flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-sm",
            depth > 0 && "border-l border-default-200 pl-3 ml-1",
          )}
        >
          <button
            aria-expanded={isOpen}
            className="inline-flex items-center gap-1.5 shrink-0 text-left text-default-800 hover:opacity-90"
            type="button"
            onClick={() => onToggle(path)}
          >
            <span className="inline-block w-4 text-default-500 select-none">
              {isOpen ? "−" : "+"}
            </span>
            <span className="font-medium text-default-900">{effLabel}</span>
          </button>
          {(summary || rootStr) && (
            <span
              className={clsx("font-medium flex-1 min-w-[8rem]", ORKG_ACCENT)}
            >
              {[rootStr, summary]
                .filter(Boolean)
                .join(rootStr && summary ? " · " : "")}
            </span>
          )}
          <span className="inline-flex items-center rounded-md border border-default-200 bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-default-600">
            {idChip}
          </span>
        </div>
        {isOpen && subs && (
          <div className="ml-6 border-l border-default-200 pl-3 space-y-0.5">
            {displayRoot && (
              <div
                className={clsx(
                  "flex flex-wrap items-center gap-2 py-1.5 px-2 rounded-md bg-default-100 text-sm",
                )}
              >
                <span className="text-default-700">value</span>
                <ResourceValueLinks
                  inputType={rootInputType}
                  plain={rootStr}
                  value={obj._ as FormValue}
                />
                <Chip classNames={{ base: "h-6" }} size="sm" variant="flat">
                  {typeChipLabel(rootInputType)}
                </Chip>
              </div>
            )}
            {(Object.entries(subs) as [string, EnrichedSubtemplateProperty][])
              .filter(
                ([sid]) => !removedBuiltinProperties.includes(`${path}.${sid}`),
              )
              .map(([sid, sub]) => (
                <OrkgPreviewPropertyNode
                  key={`${path}.${sid}`}
                  depth={depth + 1}
                  expanded={expanded}
                  fieldOverrides={fieldOverrides}
                  path={`${path}.${sid}`}
                  prop={sub}
                  propId={sid}
                  removedBuiltinProperties={removedBuiltinProperties}
                  value={obj[sid] ?? ""}
                  onToggle={onToggle}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  const display = formatLeafDisplay(prop, value, inputType);

  let boolVal: boolean | null = null;

  if (typeof value === "boolean") boolVal = value;
  else if (value === "true" || value === "1") boolVal = true;
  else if (value === "false" || value === "0") boolVal = false;
  else if (
    inputType === "checkbox" &&
    (value === "" || value === undefined || value === null)
  )
    boolVal = false;

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-2 py-1.5 px-2 rounded-md text-sm",
        depth > 0 && "ml-1 border-l border-default-200 pl-3",
        boolVal !== null
          ? "bg-default-100"
          : depth > 0
            ? "bg-default-50/80"
            : "",
      )}
    >
      <span className="font-medium text-default-800 shrink-0">{effLabel}</span>
      {boolVal !== null ? (
        <span
          aria-label={boolVal ? "true" : "false"}
          className={clsx(
            "inline-flex h-6 w-6 items-center justify-center rounded text-base font-bold",
            boolVal ? "text-success-600" : ORKG_ACCENT,
          )}
          title={boolVal ? "true" : "false"}
        >
          {boolVal ? "✓" : "✕"}
        </span>
      ) : (
        <ResourceValueLinks
          inputType={inputType}
          plain={display}
          value={value}
        />
      )}
      <Chip classNames={{ base: "h-6" }} size="sm" variant="flat">
        {typeChipLabel(inputType)}
      </Chip>
      <span className="inline-flex items-center rounded-md border border-default-200 bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-default-600 ml-auto">
        {idChip}
      </span>
    </div>
  );
}

function OrkgPreviewCustomBlockContent({
  block,
  customBlocks,
  values,
}: {
  block: CustomBlock;
  customBlocks: Record<string, CustomBlock>;
  values: Record<string, FormValue>;
}): ReactNode {
  if (block.type === "text") {
    return (
      <div className="rounded-md border border-default-100 bg-default-50/50 px-3 py-2 text-sm text-default-700">
        {block.heading && (
          <p className="font-semibold text-default-900">{block.heading}</p>
        )}
        <p className="whitespace-pre-wrap">{block.body}</p>
      </div>
    );
  }

  if (block.type === "html") {
    return (
      <div className="rounded-md border border-default-100 bg-default-50/50 px-3 py-2 text-sm text-default-700">
        <p className="text-xs font-medium text-default-500 mb-1">HTML block</p>
        <p className="text-default-800">{stripHtml(block.html)}</p>
      </div>
    );
  }

  if (block.type === "customField") {
    const v = values[`${CUSTOM_PREFIX}${block.id}`];
    const plain = formatLeafDisplay(
      {
        label: block.label,
        cardinality: "one to one",
      } as EnrichedSubtemplateProperty,
      v ?? "",
      block.inputType,
    );

    return (
      <div className="rounded-md border border-default-100 bg-default-50/50 px-3 py-2 text-sm">
        <span className="font-medium text-default-900">{block.label}</span>
        <span className="text-default-500"> · </span>
        <ResourceValueLinks
          inputType={block.inputType}
          plain={plain}
          value={v ?? ""}
        />
      </div>
    );
  }

  if (block.type === "section") {
    return (
      <div className="rounded-lg border border-default-200 bg-default-50/30 p-3 space-y-2">
        <p className="text-sm font-semibold text-default-900">{block.title}</p>
        <div className="space-y-2 pl-2 border-l-2 border-default-200">
          {(block.childIds ?? []).map((cid) => {
            const child = customBlocks[cid];

            if (!child) return null;

            return (
              <div key={cid}>
                <OrkgPreviewCustomBlockContent
                  block={child}
                  customBlocks={customBlocks}
                  values={values}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

export function QuestionnaireOrkgPreview({
  label,
  templateId,
  mapping,
  values,
  targetClassId,
  targetClassLabel,
  structure,
}: {
  label: string;
  templateId: string;
  mapping: EnrichedTemplateMapping;
  values: Record<string, FormValue>;
  targetClassId?: string;
  targetClassLabel?: string;
  structure?: QuestionnaireStructureDraft | null;
}) {
  const resolvedStructure = useMemo(
    () => structure ?? defaultStructureDraftFromMapping(mapping),
    [structure, mapping],
  );

  const expandablePaths = useMemo(
    () => collectExpandablePaths(mapping, values, resolvedStructure),
    [mapping, values, resolvedStructure],
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(expandablePaths),
  );

  const onToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(path)) next.delete(path);
      else next.add(path);

      return next;
    });
  }, []);

  const instanceOfLine = [
    targetClassLabel,
    targetClassId && `Class ${shortPropertyId(targetClassId)}`,
  ]
    .filter(Boolean)
    .join(", ");

  const removed = resolvedStructure.removedBuiltinProperties ?? [];
  const fieldOverrides = resolvedStructure.fieldOverrides;
  const customBlocks = resolvedStructure.customBlocks;

  return (
    <section className="flex flex-col gap-4 pb-10 px-6 md:px-10 w-full max-w-5xl mx-auto">
      <div className="flex flex-col gap-3">
        <Button
          as={Link}
          className="w-fit"
          color="primary"
          href="/"
          size="sm"
          variant="flat"
        >
          ← Back to templates
        </Button>
        <h1 className="text-2xl font-bold text-primary">{label}</h1>
        <p className="text-small text-default-500 max-w-2xl">
          Read-only preview styled like the{" "}
          <a
            className="text-primary underline underline-offset-2"
            href="https://orkg.org/papers/R742443"
            rel="noreferrer"
            target="_blank"
          >
            ORKG data browser
          </a>{" "}
          (contributions tree). Order, custom blocks, removed nested fields, and
          label overrides follow the form editor.
        </p>
      </div>

      <div className="rounded-lg border border-default-200 bg-content1 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default-100 bg-default-50/50 px-4 py-3">
          <h2 className="text-base font-semibold text-default-700">
            Data browser
          </h2>
        </div>

        <div className="px-4 pt-4">
          <p className={clsx("text-lg font-semibold", ORKG_ACCENT)}>{label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip
              classNames={{ base: "max-w-full" }}
              size="sm"
              startContent={<span className="text-default-500">⌖</span>}
              variant="flat"
            >
              <span className="text-default-600">Instance of:</span>{" "}
              <span className="font-medium text-default-800">
                {instanceOfLine || "Contribution (preview)"}
              </span>
            </Chip>
            <Chip
              classNames={{ base: "max-w-full" }}
              size="sm"
              startContent={<span className="text-default-500">▦</span>}
              variant="flat"
            >
              <span className="text-default-600">Applied templates:</span>{" "}
              <span className="font-medium text-default-800">{label}</span>
              <span className="text-default-500"> · </span>
              <span className="font-mono text-[11px] text-default-500">
                {templateId}
              </span>
            </Chip>
          </div>
        </div>

        <div className="px-4 py-4 space-y-1">
          {resolvedStructure.orderedBlocks.map((block) => {
            const sortKey = getBlockSortId(block);

            if (block.kind === "property") {
              if (removed.includes(block.id)) return null;
              const p = mapping[block.id];

              if (!p) return null;

              return (
                <Fragment key={sortKey}>
                  <OrkgPreviewPropertyNode
                    depth={0}
                    expanded={expanded}
                    fieldOverrides={fieldOverrides}
                    path={block.id}
                    prop={p}
                    propId={block.id}
                    removedBuiltinProperties={removed}
                    value={values[block.id] ?? ""}
                    onToggle={onToggle}
                  />
                </Fragment>
              );
            }

            const custom = customBlocks[block.id];

            if (!custom) return null;

            return (
              <div key={sortKey} className="py-2">
                <OrkgPreviewCustomBlockContent
                  block={custom}
                  customBlocks={customBlocks}
                  values={values}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
