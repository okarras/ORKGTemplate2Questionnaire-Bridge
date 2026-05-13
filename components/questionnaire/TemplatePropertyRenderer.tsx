"use client";

import type {
  SubtemplateProperty,
  EnrichedSubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";
import type {
  FieldOverrides,
  FormValue,
  ScaleConfig,
  SelectOption,
} from "./QuestionnaireForm";
import type { CustomBlock } from "@/types/template";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";

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
import { ResourceFilterDialog } from "./ResourceFilterDialog";

type PropertyValue = string | number | boolean | string[];

const INPUT_TYPE_OPTIONS: { value: InputType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text (textarea)" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (select)" },
  { value: "scale", label: "Scale / rating (e.g. 1–5, Difficult→Easy)" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "resource", label: "Resource (ORKG autocomplete)" },
];

function isOneToOneCardinality(cardinality?: string): boolean {
  if (!cardinality) return true;
  const n = cardinality.toLowerCase().replace(/-/g, " ");

  return n === "one to one" || n === "1 to 1" || n === "1:1";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSelectOptions, setEditSelectOptions] = useState<SelectOption[]>(
    [],
  );
  const [editScaleConfig, setEditScaleConfig] = useState<ScaleConfig>({
    min: 1,
    max: 5,
  });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
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

  const handleSaveEdit = useCallback(() => {
    const payload: Partial<FieldOverrides[string]> = {
      label: editLabel.trim() || undefined,
      description: editDescription.trim() || undefined,
    };

    if (inputType === "select" || inputType === "resource") {
      const validOptions = editSelectOptions.filter(
        (o) => o.value.trim() || o.label.trim(),
      );

      if (validOptions.length > 0) {
        payload.selectOptions = validOptions;
      } else {
        payload.selectOptions = [];
      }
    }
    if (inputType === "scale") {
      payload.scaleConfig = editScaleConfig;
    }
    onFieldOverride?.(propertyPath, payload);
    setIsEditing(false);
  }, [
    onFieldOverride,
    propertyPath,
    editLabel,
    editDescription,
    editSelectOptions,
    editScaleConfig,
    inputType,
  ]);

  const handleFieldTypeChange = useCallback(
    (
      keys: Parameters<
        NonNullable<React.ComponentProps<typeof Select>["onSelectionChange"]>
      >[0],
    ) => {
      const keySet = keys instanceof Set ? keys : new Set<string>();
      const first = keySet.values().next().value;

      if (first != null) {
        onFieldOverride?.(propertyPath, {
          inputType: String(first) as InputType,
        });
      }
    },
    [onFieldOverride, propertyPath],
  );

  const hasSubproperties =
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
      overrides?.scaleConfig,
  );
  const fieldEditorUi = canEdit && editMode && (
    <Accordion
      className="mt-3 w-full gap-0 px-0"
      itemClasses={{
        base: "border-default-200 rounded-xl overflow-hidden shadow-sm",
      }}
      variant="bordered"
    >
      <AccordionItem
        key="edit"
        aria-label="Customize field"
        classNames={{
          trigger:
            "py-2.5 px-4 data-[hover=true]:bg-default-100/80 min-h-0 rounded-xl",
          content: "px-4 pb-4 pt-1",
          title: "text-sm font-medium text-default-600",
        }}
        startContent={
          hasOverrides ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              Customized
            </span>
          ) : null
        }
        subtitle={!isEditing ? "Label, description, type, options" : undefined}
      >
        <div className="space-y-3">
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <Button
                color="primary"
                size="sm"
                variant="flat"
                onPress={() => {
                  const o = fieldOverrides[propertyPath];

                  setEditLabel(o?.label ?? property.label);
                  setEditDescription(
                    o?.description ?? property.description ?? "",
                  );
                  const currentType = o?.inputType ?? inputType;

                  setEditSelectOptions(
                    o?.selectOptions ??
                      (currentType === "resource"
                        ? []
                        : [
                            { value: "option1", label: "Option 1" },
                            { value: "other", label: "Other/Comments" },
                          ]),
                  );
                  setEditScaleConfig(
                    o?.scaleConfig ?? {
                      min: 1,
                      max: 5,
                      minLabel: "Low",
                      maxLabel: "High",
                    },
                  );
                  setIsEditing(true);
                }}
              >
                Edit field
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-default-600">
                  Editing
                </span>
                <div className="flex gap-1">
                  <Button
                    color="primary"
                    size="sm"
                    variant="flat"
                    onPress={handleSaveEdit}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Input
                  label="Label"
                  placeholder="Field label"
                  size="sm"
                  value={editLabel}
                  onValueChange={setEditLabel}
                />
                <Textarea
                  label="Description"
                  minRows={2}
                  placeholder="Field description (optional)"
                  size="sm"
                  value={editDescription}
                  onValueChange={setEditDescription}
                />
                <Select
                  label="Field type"
                  placeholder="Select type"
                  selectedKeys={
                    new Set([
                      fieldOverrides[propertyPath]?.inputType ?? inputType,
                    ])
                  }
                  size="sm"
                  onSelectionChange={handleFieldTypeChange}
                >
                  {INPUT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value}>{opt.label}</SelectItem>
                  ))}
                </Select>
                {inputType === "select" && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-default-600">
                      Select options (PDF-style)
                    </span>
                    {editSelectOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="Value"
                          size="sm"
                          value={opt.value}
                          onValueChange={(v) =>
                            setEditSelectOptions((prev) => {
                              const next = [...prev];

                              next[i] = { ...next[i], value: v };

                              return next;
                            })
                          }
                        />
                        <Input
                          placeholder="Label"
                          size="sm"
                          value={opt.label}
                          onValueChange={(v) =>
                            setEditSelectOptions((prev) => {
                              const next = [...prev];

                              next[i] = { ...next[i], label: v };

                              return next;
                            })
                          }
                        />
                        <Button
                          color="danger"
                          size="sm"
                          variant="flat"
                          onPress={() =>
                            setEditSelectOptions((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                        >
                          −
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() =>
                        setEditSelectOptions((prev) => [
                          ...prev,
                          {
                            value: `opt${prev.length + 1}`,
                            label: `Option ${prev.length + 1}`,
                          },
                        ])
                      }
                    >
                      + Add option
                    </Button>
                  </div>
                )}
                {inputType === "resource" && (
                  <div className="space-y-2 mt-4 pt-2 border-t border-default-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-default-600">
                        Restrict allowed resources
                      </span>
                      <Button
                        color="primary"
                        size="sm"
                        variant="flat"
                        onPress={() => setIsFilterDialogOpen(true)}
                      >
                        Advanced filter...
                      </Button>
                    </div>
                    <p className="text-xs text-default-500 mb-2">
                      Leave empty to allow users to search and select any
                      resource. If you select resources here, users will only be
                      able to choose from your selection.
                    </p>

                    {editSelectOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-1 p-2 bg-default-50 border border-default-200 rounded-lg">
                        {editSelectOptions.map((opt) => (
                          <div
                            key={opt.value}
                            className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md"
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-default-400 p-2 border border-dashed border-default-200 rounded-lg text-center">
                        All resources allowed. Click Advanced filter to
                        restrict.
                      </div>
                    )}

                    <ResourceFilterDialog
                      classId={
                        (property as EnrichedSubtemplateProperty).class_id
                      }
                      initialSelectedIds={editSelectOptions.map((o) => o.value)}
                      isOpen={isFilterDialogOpen}
                      propertyId={propertyId}
                      onClose={() => setIsFilterDialogOpen(false)}
                      onSave={(selectedOptions) =>
                        setEditSelectOptions(selectedOptions)
                      }
                    />
                  </div>
                )}
                {inputType === "scale" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Min"
                      size="sm"
                      type="number"
                      value={String(editScaleConfig.min)}
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          min: Number(v) || 1,
                        }))
                      }
                    />
                    <Input
                      label="Max"
                      size="sm"
                      type="number"
                      value={String(editScaleConfig.max)}
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          max: Number(v) || 5,
                        }))
                      }
                    />
                    <Input
                      label="Start label (e.g. Difficult)"
                      placeholder="Optional"
                      size="sm"
                      value={editScaleConfig.minLabel ?? ""}
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          minLabel: v || undefined,
                        }))
                      }
                    />
                    <Input
                      label="End label (e.g. Easy)"
                      placeholder="Optional"
                      size="sm"
                      value={editScaleConfig.maxLabel ?? ""}
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          maxLabel: v || undefined,
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </AccordionItem>
    </Accordion>
  );

  const hideControlDuplicateLabel =
    hideLeafLabelInAccordion ||
    (Boolean(sectionTitleRenderedExternally) &&
      depth === 0 &&
      !hasSubproperties);

  // Leaf property: render input only
  if (!hasSubproperties) {
    return (
      <div className="w-full">
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
            cardinality={property.cardinality}
            classId={property.class_id}
            createLink={property.create_link}
            hideLabel={hideControlDuplicateLabel}
            inputType={inputType}
            label={effectiveLabel}
            placeholder={effectiveDescription}
            propertyId={propertyId}
            resourceOptionsScope={propertyPath}
            scaleConfig={scaleConfig}
            selectOptions={selectOptions}
            value={value}
            onChange={onChange}
            onResourceOptionsSnapshot={handleOrkgResourceOptionsSnapshot}
          />
        </ScidQuestFieldAiChrome>
        {fieldEditorUi}
      </div>
    );
  }

  // Property with nested subtemplate_properties
  const nestedSubtemplateWithOwnTitle = depth > 0;

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
            className="group/subfield rounded-lg border border-default-100 bg-content1"
          >
            <summary className="flex w-full min-w-0 cursor-pointer list-none items-center justify-between gap-3 border-b border-default-100 bg-default-50/70 px-3 py-2.5 text-left text-sm font-semibold text-default-900 hover:bg-default-50 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 break-words pr-1">
                {fieldOverrides[`${propertyPath}.${subPropId}`]?.label ??
                  subProp.label}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {!isOneToOneCardinality(subProp.cardinality) && (
                  <span className="shrink-0 text-xs font-normal font-mono text-default-500">
                    {subProp.cardinality}
                  </span>
                )}
                {onRemoveBuiltinProperty && (
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
              </div>
            </summary>
            <div className="overflow-hidden rounded-b-lg border-t border-default-100 bg-background px-3 py-3">
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

        const nestedSummaryClass =
          "flex w-full cursor-pointer list-none items-center justify-between gap-2 border-b border-default-100 bg-default-50/70 px-3 py-2.5 text-left text-sm font-semibold text-default-900 hover:bg-default-50 [&::-webkit-details-marker]:hidden";

        if (block.type === "text") {
          return (
            <details
              key={blockId}
              className="group/subfield rounded-lg border border-default-100 bg-content1 overflow-hidden"
            >
              <summary className={nestedSummaryClass}>
                {block.heading ?? "Text block"}
              </summary>
              <div className="border-t border-default-100 bg-background px-3 py-3">
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
            <details
              key={blockId}
              className="group/subfield rounded-lg border border-default-100 bg-content1 overflow-hidden"
            >
              <summary className={nestedSummaryClass}>{block.label}</summary>
              <div className="border-t border-default-100 bg-background px-3 py-3">
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
            <details
              key={blockId}
              className="group/subfield rounded-lg border border-default-100 bg-content1 overflow-hidden"
            >
              <summary className={nestedSummaryClass}>HTML block</summary>
              <div className="border-t border-default-100 bg-background px-3 py-3">
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
            <details
              key={blockId}
              className="group/subfield rounded-lg border border-default-100 bg-content1 overflow-hidden"
            >
              <summary className={nestedSummaryClass}>{block.title}</summary>
              <div className="border-t border-default-100 bg-background px-3 py-3">
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
    <div className="w-full space-y-4">
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
            cardinality={property.cardinality}
            classId={property.class_id}
            createLink={property.create_link}
            hideLabel={
              hideLeafLabelInAccordion ||
              (!!sectionTitleRenderedExternally && depth === 0)
            }
            inputType={inputType}
            label={effectiveLabel}
            placeholder={effectiveDescription}
            propertyId={propertyId}
            resourceOptionsScope={propertyPath}
            scaleConfig={scaleConfig}
            selectOptions={selectOptions}
            value={value}
            onChange={onChange}
            onResourceOptionsSnapshot={handleOrkgResourceOptionsSnapshot}
          />
        </ScidQuestFieldAiChrome>
      ) : null}
      {fieldEditorUi}
      <div className="rounded-xl border border-default-100 bg-background overflow-hidden shadow-none">
        {nestedSubtemplateWithOwnTitle ? (
          <details open className="group/subsec">
            <summary className="flex w-full cursor-pointer list-none items-center gap-2 border-b border-default-100 bg-default-50/90 px-4 py-3 text-left text-base font-semibold text-default-900 hover:bg-default-50 [&::-webkit-details-marker]:hidden">
              {effectiveLabel}
            </summary>
            <div>
              {effectiveDescription && (
                <p className="border-b border-default-100 bg-default-50/30 px-4 py-3 text-sm text-default-600 leading-relaxed">
                  {effectiveDescription}
                </p>
              )}
              <div className="flex flex-col gap-2 p-3 sm:p-4">
                {subFieldRows}
              </div>
            </div>
          </details>
        ) : (
          <div>
            {effectiveDescription && (
              <p className="border-b border-default-100 bg-default-50/30 px-4 py-3 text-sm text-default-600 leading-relaxed">
                {effectiveDescription}
              </p>
            )}
            <div className="flex flex-col gap-2 p-3 sm:p-4">{subFieldRows}</div>
          </div>
        )}
        {editMode && onAddNestedBlock && (
          <Dropdown className="border-t border-default-100 p-3">
            <DropdownTrigger>
              <Button
                className="w-full border border-dashed border-default-300"
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
