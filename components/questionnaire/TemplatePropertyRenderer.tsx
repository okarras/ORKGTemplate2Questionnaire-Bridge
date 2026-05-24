"use client";

import type {
  SubtemplateProperty,
  EnrichedSubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";
import type {
  FieldOverrides,
  FormValue,
  SelectOption,
} from "./QuestionnaireForm";
import type { CustomBlock } from "@/types/template";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Chip } from "@heroui/chip";

import { ResourceLabelCache } from "@/lib/resource-label-cache";

import {
  CustomFieldBlock,
  HtmlBlock,
  SectionBlock,
  TextBlock,
} from "./CustomBlocks";
import { DynamicFieldInput } from "./DynamicFieldInput";
import { ScidQuestFieldAiChrome } from "./ScidQuestFieldAiChrome";
import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";
import { FieldCustomizeDialog } from "./FieldCustomizeDialog";
import { FieldEditButton } from "./FieldEditButton";
import { formatStoredMultiDefault } from "./field-default-value-utils";

type PropertyValue = string | number | boolean | string[];

function isOneToOneCardinality(cardinality?: string): boolean {
  if (!cardinality) return true;
  const n = cardinality.toLowerCase().replace(/-/g, " ");

  return n === "one to one" || n === "1 to 1" || n === "1:1";
}

/** Hide description copy when it only repeats the field/section title. */
function descriptionDiffersFromLabel(
  description: string | undefined,
  label: string,
): boolean {
  const d = description?.trim();

  if (!d) return false;

  return d.toLowerCase() !== label.trim().toLowerCase();
}

function toPropertyValue(v: FormValue | undefined): PropertyValue {
  if (v === undefined || v === null) return "";
  if (typeof v === "object" && !Array.isArray(v) && "_" in v)
    return (v as { _?: PropertyValue })._ ?? "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return v;
  if (Array.isArray(v)) return v;

  return "";
}

function summaryForStoredEmptyDefault(
  stored: string,
  inputType: InputType,
  selectOptions?: SelectOption[],
): string {
  const t = stored.trim();

  if (!t) return stored;
  const parts = t
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return stored;

  if (inputType === "select" && selectOptions?.length) {
    return parts
      .map(
        (p) =>
          selectOptions.find((o) => o.value === p || o.label === p)?.label ?? p,
      )
      .join(", ");
  }

  if (inputType === "resource") {
    return parts
      .map((p) => ResourceLabelCache.get(p) ?? p.split("/").pop() ?? p)
      .join(", ");
  }

  return stored;
}

function serializeCurrentForEmptyDefault(
  v: PropertyValue,
  inputType: InputType,
  cardinality?: string,
): string | null {
  const many = cardinality?.toLowerCase() === "one to many";

  if (many && Array.isArray(v)) {
    if (v.length === 0) return null;

    if (inputType === "resource") {
      return formatStoredMultiDefault(v.map(String));
    }

    return v.map(String).join(",");
  }

  if (inputType === "checkbox") {
    if (typeof v === "boolean") return v ? "true" : "false";
    if (v === "true" || v === "false") return v;

    return null;
  }

  if (inputType === "number") {
    if (v === "" || v === undefined) return null;
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);

    return String(v);
  }

  if (typeof v === "string") {
    const s = v.trim();

    return s.length > 0 ? s : null;
  }

  return null;
}

/** Chevron icon for collapsible sections */
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={`q-chevron ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Depth-based accent color style for a property */
function depthStyle(depth: number): React.CSSProperties {
  const depthVal = Math.min(depth, 3);

  return { borderLeftColor: `var(--q-depth-${depthVal})` };
}

interface TemplatePropertyRendererProps {
  propertyId: string;
  property: SubtemplateProperty | EnrichedSubtemplateProperty;
  depth?: number;
  value?: FormValue;
  onValueChange?: (value: FormValue) => void;
  /** Full path for overrides (e.g. "P31" or "P31.P110") - enables field editing */
  propertyPath?: string;
  fieldOverrides?: FieldOverrides;
  onFieldOverride?: (
    path: string,
    overrides: Partial<FieldOverrides[string]>,
  ) => void;
  getInputTypeForPath?: (path: string, prop: SubtemplateProperty) => InputType;
  /** When true, show edit panels; when false, hide them for cleaner view */
  editMode?: boolean;
  /** Custom block ids for this propertyPath (from nestedCustomBlocksRecord[propertyPath]) */
  nestedCustomBlockIds?: string[];
  customBlocks?: Record<string, CustomBlock>;
  nestedCustomBlocksRecord?: Record<string, string[]>;
  onAddNestedBlock?: (
    propertyPath: string,
    type: "text" | "section" | "customField" | "html",
  ) => void;
  onRemoveNestedBlock?: (propertyPath: string, childId: string) => void;
  onUpdateCustomBlock?: (id: string, data: CustomBlock) => void;
  onNestedCustomValueChange?: (
    blockId: string,
    value: string | number | boolean | string[],
  ) => void;
  onAddChildToSection?: (
    sectionId: string,
    type: "text" | "section" | "customField" | "html",
  ) => void;
  onRemoveChildFromSection?: (sectionId: string, childId: string) => void;
  onReorderSectionChildren?: (sectionId: string, newChildIds: string[]) => void;
  values?: Record<string, FormValue>;
  removedBuiltinProperties?: string[];
  onRemoveBuiltinProperty?: (propertyPath: string) => void;
  /**
   * When this renderer is nested under a subtemplate accordion row, the row title
   * already shows the field label — hide the duplicate label on the control.
   */
  hideLeafLabelInAccordion?: boolean;
  /**
   * When true, the block title is shown on the parent `QuestionnaireSortableBlock`
   * summary — omit the same label on the field control (ORKG-style).
   */
  sectionTitleRenderedExternally?: boolean;
}

export function TemplatePropertyRenderer({
  propertyId,
  property,
  depth = 0,
  value: controlledValue,
  onValueChange: controlledOnChange,
  propertyPath: propPath,
  fieldOverrides = {},
  onFieldOverride,
  getInputTypeForPath,
  editMode = true,
  nestedCustomBlockIds = [],
  customBlocks = {},
  nestedCustomBlocksRecord = {},
  onAddNestedBlock,
  onRemoveNestedBlock,
  onUpdateCustomBlock,
  onNestedCustomValueChange,
  onAddChildToSection,
  onRemoveChildFromSection,
  onReorderSectionChildren,
  values = {},
  removedBuiltinProperties = [],
  onRemoveBuiltinProperty,
  hideLeafLabelInAccordion = false,
  sectionTitleRenderedExternally = false,
}: TemplatePropertyRendererProps) {
  const [internalValue, setInternalValue] = useState<PropertyValue>("");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [nestedAddMenuOpen, setNestedAddMenuOpen] = useState(false);
  const [orkgResourceOptionsForAi, setOrkgResourceOptionsForAi] = useState<
    SelectOption[]
  >([]);
  const isControlled = controlledOnChange !== undefined;

  const propertyPath = propPath ?? propertyId;
  const canEdit = Boolean(onFieldOverride && getInputTypeForPath);

  const value = isControlled ? toPropertyValue(controlledValue) : internalValue;

  const onChange = useCallback(
    (v: PropertyValue) => {
      if (isControlled) {
        const hasSub =
          property.subtemplate_properties &&
          Object.keys(property.subtemplate_properties).length > 0;
        const current = controlledValue;

        if (
          hasSub &&
          typeof current === "object" &&
          current !== null &&
          !Array.isArray(current)
        ) {
          controlledOnChange?.({ ...current, _: v });
        } else {
          controlledOnChange?.(v);
        }
      } else {
        setInternalValue(v);
      }
    },
    [
      isControlled,
      controlledOnChange,
      controlledValue,
      property.subtemplate_properties,
    ],
  );

  const overrides = fieldOverrides[propertyPath];
  const effectiveLabel = overrides?.label ?? property.label;
  const effectiveDescription = overrides?.description ?? property.description;
  const selectOptions = overrides?.selectOptions;
  const selectOptionsForAi = useMemo(() => {
    const fromOverrides = [...(selectOptions ?? [])];
    const seen = new Set(fromOverrides.map((o) => String(o.value)));
    const out: SelectOption[] = [...fromOverrides];

    for (const o of orkgResourceOptionsForAi) {
      const k = String(o.value);

      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(o);
      }
    }

    const max = 200;

    return out.length > max ? out.slice(0, max) : out;
  }, [selectOptions, orkgResourceOptionsForAi]);

  const handleOrkgResourceOptionsSnapshot = useCallback(
    (opts: SelectOption[], scopeKey: string) => {
      if (scopeKey !== propertyPath) return;
      setOrkgResourceOptionsForAi(opts);
    },
    [propertyPath],
  );

  useEffect(() => {
    setOrkgResourceOptionsForAi([]);
  }, [propertyPath]);

  const scaleConfig = overrides?.scaleConfig;
  const inputType = getInputTypeForPath
    ? getInputTypeForPath(propertyPath, property)
    : (property as EnrichedSubtemplateProperty).valueType !== undefined
      ? getInputTypeFromValueType(
          (property as EnrichedSubtemplateProperty).valueType!,
          (property as EnrichedSubtemplateProperty).literalDatatype,
        )
      : getInputTypeForProperty(propertyId);

  const fillModeDefaultControls = useMemo(() => {
    if (editMode || !onFieldOverride) return undefined;
    const stored = overrides?.emptyDefault;
    const many = property.cardinality?.toLowerCase() === "one to many";
    const dedupedPickOpts: SelectOption[] = [];
    const seenPick = new Set<string>();

    for (const o of selectOptions ?? []) {
      const k = String(o.value);

      if (seenPick.has(k)) continue;
      seenPick.add(k);
      dedupedPickOpts.push(o);
    }

    const onClearAnswer = () => {
      if (many) onChange([]);
      else if (inputType === "checkbox") onChange(false);
      else onChange("");
    };

    return {
      emptyDefault: stored,
      emptyDefaultSummary:
        stored && stored.trim()
          ? summaryForStoredEmptyDefault(stored, inputType, selectOptions)
          : "",
      onSaveFromCurrent: () => {
        const serialized = serializeCurrentForEmptyDefault(
          value,
          inputType,
          property.cardinality,
        );

        if (!serialized) return;
        onFieldOverride(propertyPath, { emptyDefault: serialized });
      },
      onClear: () => onFieldOverride(propertyPath, { emptyDefault: undefined }),
      onClearAnswer,
      pickDefaultFromSelectOptions:
        inputType === "select" && !many && dedupedPickOpts.length > 0
          ? dedupedPickOpts
          : undefined,
      onPickDefaultOption:
        inputType === "select" && !many
          ? (v: string) => onFieldOverride(propertyPath, { emptyDefault: v })
          : undefined,
    };
  }, [
    editMode,
    onFieldOverride,
    overrides?.emptyDefault,
    inputType,
    selectOptions,
    value,
    property.cardinality,
    propertyPath,
    onChange,
  ]);

  const handleFieldTypeChange = useCallback(
    (nextType: InputType) => {
      onFieldOverride?.(propertyPath, { inputType: nextType });
    },
    [onFieldOverride, propertyPath],
  );

  const treatAsResource = overrides?.treatAsResource ?? false;
  const hasSubproperties =
    !treatAsResource &&
    property.subtemplate_properties &&
    Object.keys(property.subtemplate_properties).length > 0;

  /** Nested subtemplate: ORKG stores literals on the nested shape; skip redundant root resource/text row except one-to-many arrays. */
  const hideRootScalarInput =
    Boolean(hasSubproperties) &&
    (!isControlled || !Array.isArray(controlledValue));

  const hasOverrides = Boolean(
    overrides?.label ??
      overrides?.description ??
      overrides?.inputType ??
      overrides?.selectOptions ??
      overrides?.scaleConfig ??
      overrides?.emptyDefault ??
      overrides?.showInHeader ??
      overrides?.treatAsResource,
  );
  const propertyHasSubtemplateChildren = Boolean(
    property.subtemplate_properties &&
      Object.keys(property.subtemplate_properties).length > 0,
  );

  const fieldCustomizeDialog = canEdit && editMode && (
    <FieldCustomizeDialog
      hasSubproperties={propertyHasSubtemplateChildren}
      isOpen={isCustomizeOpen}
      overrides={overrides}
      property={property}
      propertyId={propertyId}
      propertyPath={propertyPath}
      resolvedInputType={inputType}
      onClose={() => setIsCustomizeOpen(false)}
      onFieldTypeChange={handleFieldTypeChange}
      onSave={(payload) => onFieldOverride?.(propertyPath, payload)}
    />
  );

  const fieldEditSlot =
    canEdit && editMode ? (
      <FieldEditButton
        customized={hasOverrides}
        fieldLabel={effectiveLabel}
        onPress={() => setIsCustomizeOpen(true)}
      />
    ) : undefined;

  const hideControlDuplicateLabel =
    hideLeafLabelInAccordion ||
    (Boolean(sectionTitleRenderedExternally) &&
      depth === 0 &&
      !hasSubproperties);

  // Leaf property: render input only
  if (!hasSubproperties) {
    return (
      <div className="min-w-0 w-full">
        <ScidQuestFieldAiChrome
          cardinality={property.cardinality}
          inputType={inputType}
          label={effectiveLabel}
          propertyId={propertyId}
          selectOptions={selectOptionsForAi}
          value={value}
          onChange={onChange}
        >
          <DynamicFieldInput
            editMode={editMode}
            cardinality={property.cardinality}
            classId={property.class_id}
            createLink={property.create_link}
            description={effectiveDescription}
            fillModeDefaultControls={fillModeDefaultControls}
            hideLabel={hideControlDuplicateLabel}
            inputType={inputType}
            label={effectiveLabel}
            propertyId={propertyId}
            resourceOptionsScope={propertyPath}
            scaleConfig={scaleConfig}
            selectOptions={selectOptions}
            trailingSlot={fieldEditSlot}
            value={value}
            onChange={onChange}
            onResourceOptionsSnapshot={handleOrkgResourceOptionsSnapshot}
          />
        </ScidQuestFieldAiChrome>
        {fieldCustomizeDialog}
      </div>
    );
  }

  // Property with nested subtemplate_properties
  const subFieldRows = (
    <>
      {Object.entries(property.subtemplate_properties!)
        .filter(
          ([subPropId]) =>
            !removedBuiltinProperties.includes(`${propertyPath}.${subPropId}`),
        )
        .map(([subPropId, subProp]) => (
          <details
            key={subPropId}
            className="q-subfield-card q-depth-border"
            data-depth={Math.min(depth + 1, 3)}
            style={depthStyle(depth + 1)}
          >
            <summary className="q-subfield-summary">
              <span className="min-w-0 flex-1 break-words pr-1">
                {fieldOverrides[`${propertyPath}.${subPropId}`]?.label ??
                  subProp.label}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {!isOneToOneCardinality(subProp.cardinality) && (
                  <Chip
                    className="h-5"
                    color="secondary"
                    size="sm"
                    variant="flat"
                  >
                    {subProp.cardinality}
                  </Chip>
                )}
                {onRemoveBuiltinProperty && editMode && (
                  <Button
                    className="h-7 min-w-fit px-2 text-xs font-medium"
                    color="danger"
                    size="sm"
                    type="button"
                    variant="light"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPress={() =>
                      onRemoveBuiltinProperty(`${propertyPath}.${subPropId}`)
                    }
                  >
                    Remove
                  </Button>
                )}
                <ChevronIcon />
              </div>
            </summary>
            <div className="q-subfield-body q-collapsible-content min-w-0">
              <TemplatePropertyRenderer
                hideLeafLabelInAccordion
                customBlocks={customBlocks}
                depth={depth + 1}
                editMode={editMode}
                fieldOverrides={fieldOverrides}
                getInputTypeForPath={getInputTypeForPath}
                nestedCustomBlockIds={
                  nestedCustomBlocksRecord[`${propertyPath}.${subPropId}`] ?? []
                }
                nestedCustomBlocksRecord={nestedCustomBlocksRecord}
                property={subProp}
                propertyId={subPropId}
                propertyPath={`${propertyPath}.${subPropId}`}
                removedBuiltinProperties={removedBuiltinProperties}
                value={
                  typeof controlledValue === "object" &&
                  controlledValue !== null &&
                  !Array.isArray(controlledValue)
                    ? (controlledValue as Record<string, FormValue>)[subPropId]
                    : undefined
                }
                values={values}
                onAddChildToSection={onAddChildToSection}
                onAddNestedBlock={onAddNestedBlock}
                onFieldOverride={onFieldOverride}
                onNestedCustomValueChange={onNestedCustomValueChange}
                onRemoveBuiltinProperty={onRemoveBuiltinProperty}
                onRemoveChildFromSection={onRemoveChildFromSection}
                onRemoveNestedBlock={onRemoveNestedBlock}
                onReorderSectionChildren={onReorderSectionChildren}
                onUpdateCustomBlock={onUpdateCustomBlock}
                onValueChange={(v) => {
                  if (!controlledOnChange) return;
                  const hasSub =
                    property.subtemplate_properties &&
                    Object.keys(property.subtemplate_properties).length > 0;
                  const current = controlledValue;

                  if (
                    hasSub &&
                    typeof current === "object" &&
                    current !== null &&
                    !Array.isArray(current)
                  ) {
                    controlledOnChange({
                      ...current,
                      [subPropId]: v,
                    });
                  } else {
                    controlledOnChange({ [subPropId]: v });
                  }
                }}
              />
            </div>
          </details>
        ))}
      {nestedCustomBlockIds.map((blockId) => {
        const block = customBlocks[blockId];

        if (!block) return null;

        if (block.type === "text") {
          return (
            <details key={blockId} className="q-subfield-card">
              <summary className="q-subfield-summary">
                <span className="min-w-0 flex-1 truncate">
                  {block.heading ?? "Text block"}
                </span>
                <ChevronIcon />
              </summary>
              <div className="q-subfield-body q-collapsible-content min-w-0">
                <TextBlock
                  block={block}
                  editMode={editMode}
                  onRemove={() => onRemoveNestedBlock?.(propertyPath!, blockId)}
                  onUpdate={(b) => onUpdateCustomBlock?.(blockId, b)}
                />
              </div>
            </details>
          );
        }
        if (block.type === "customField") {
          return (
            <details key={blockId} className="q-subfield-card">
              <summary className="q-subfield-summary">
                <span className="min-w-0 flex-1 truncate">{block.label}</span>
                <ChevronIcon />
              </summary>
              <div className="q-subfield-body q-collapsible-content min-w-0">
                <CustomFieldBlock
                  block={block}
                  editMode={editMode}
                  value={
                    (values[`__custom_${blockId}`] as
                      | string
                      | number
                      | boolean
                      | string[]
                      | undefined) ?? ""
                  }
                  onChange={(v) => onNestedCustomValueChange?.(blockId, v)}
                  onRemove={() => onRemoveNestedBlock?.(propertyPath!, blockId)}
                  onUpdate={(b) => onUpdateCustomBlock?.(blockId, b)}
                />
              </div>
            </details>
          );
        }
        if (block.type === "html") {
          return (
            <details key={blockId} className="q-subfield-card">
              <summary className="q-subfield-summary">
                <span className="min-w-0 flex-1">HTML block</span>
                <ChevronIcon />
              </summary>
              <div className="q-subfield-body q-collapsible-content min-w-0">
                <HtmlBlock
                  block={block}
                  editMode={editMode}
                  onRemove={() => onRemoveNestedBlock?.(propertyPath!, blockId)}
                  onUpdate={(b) => onUpdateCustomBlock?.(blockId, b)}
                />
              </div>
            </details>
          );
        }
        if (block.type === "section") {
          return (
            <details key={blockId} className="q-subfield-card">
              <summary className="q-subfield-summary">
                <span className="min-w-0 flex-1 truncate">{block.title}</span>
                <ChevronIcon />
              </summary>
              <div className="q-subfield-body q-collapsible-content min-w-0">
                <SectionBlock
                  block={block}
                  childBlocks={(block.childIds ?? [])
                    .map((cid) => customBlocks[cid])
                    .filter(Boolean)}
                  editMode={editMode}
                  getChildBlocks={(sectionId) =>
                    (
                      (customBlocks[sectionId] as { childIds?: string[] })
                        ?.childIds ?? []
                    )
                      .map((cid) => customBlocks[cid])
                      .filter(Boolean)
                  }
                  getChildValue={(cid) =>
                    (values[`__custom_${cid}`] as
                      | string
                      | number
                      | boolean
                      | string[]
                      | undefined) ?? ""
                  }
                  onAddChild={onAddChildToSection}
                  onChildValueChange={(cid, v) =>
                    onNestedCustomValueChange?.(cid, v)
                  }
                  onRemove={() => onRemoveNestedBlock?.(propertyPath!, blockId)}
                  onRemoveChild={onRemoveChildFromSection}
                  onReorderChildren={onReorderSectionChildren}
                  onUpdate={(b) => onUpdateCustomBlock?.(blockId, b)}
                  onUpdateChild={(cid, b) => onUpdateCustomBlock?.(cid, b)}
                />
              </div>
            </details>
          );
        }

        return null;
      })}
    </>
  );

  return (
    <div className="min-w-0 w-full space-y-4">
      {!hideRootScalarInput ? (
        <ScidQuestFieldAiChrome
          cardinality={property.cardinality}
          inputType={inputType}
          label={effectiveLabel}
          propertyId={propertyId}
          selectOptions={selectOptionsForAi}
          value={value}
          onChange={onChange}
        >
          <DynamicFieldInput
            editMode={editMode}
            cardinality={property.cardinality}
            classId={property.class_id}
            createLink={property.create_link}
            description={effectiveDescription}
            fillModeDefaultControls={fillModeDefaultControls}
            hideLabel={
              hideLeafLabelInAccordion ||
              (!!sectionTitleRenderedExternally && depth === 0)
            }
            inputType={inputType}
            label={effectiveLabel}
            propertyId={propertyId}
            resourceOptionsScope={propertyPath}
            scaleConfig={scaleConfig}
            selectOptions={selectOptions}
            trailingSlot={fieldEditSlot}
            value={value}
            onChange={onChange}
            onResourceOptionsSnapshot={handleOrkgResourceOptionsSnapshot}
          />
        </ScidQuestFieldAiChrome>
      ) : null}
      {fieldCustomizeDialog}
      <div className="rounded-xl border border-default-100 bg-background overflow-hidden">
        {descriptionDiffersFromLabel(effectiveDescription, effectiveLabel) && (
          <div className="border-b border-default-100 bg-default-50/40 px-4 py-3">
            <p className="text-sm text-default-600 leading-relaxed">
              {effectiveDescription}
            </p>
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-3 p-4">{subFieldRows}</div>
        {editMode && onAddNestedBlock && (
          <Dropdown
            className="border-t border-default-100 p-3"
            isOpen={nestedAddMenuOpen}
            onOpenChange={setNestedAddMenuOpen}
          >
            <DropdownTrigger>
              <Button
                className="w-full border border-dashed border-default-300"
                endContent={
                  <span
                    className={`text-[10px] text-default-400 transition-transform duration-200 ${
                      nestedAddMenuOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                }
                size="sm"
                variant="flat"
              >
                + Add block to this section
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Add block">
              <DropdownItem
                key="text"
                onPress={() => onAddNestedBlock(propertyPath!, "text")}
              >
                Text
              </DropdownItem>
              <DropdownItem
                key="section"
                onPress={() => onAddNestedBlock(propertyPath!, "section")}
              >
                Section
              </DropdownItem>
              <DropdownItem
                key="field"
                onPress={() => onAddNestedBlock(propertyPath!, "customField")}
              >
                Field
              </DropdownItem>
              <DropdownItem
                key="html"
                onPress={() => onAddNestedBlock(propertyPath!, "html")}
              >
                HTML
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>
    </div>
  );
}
