"use client";

import type {
  SubtemplateProperty,
  EnrichedSubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";

import { useState, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
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
import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";
import type {
  FieldOverrides,
  FormValue,
  ScaleConfig,
  SelectOption,
} from "./QuestionnaireForm";
import type { CustomBlock } from "@/types/template";

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

function toPropertyValue(v: FormValue | undefined): PropertyValue {
  if (v === undefined || v === null) return "";
  if (typeof v === "object" && !Array.isArray(v) && "_" in v) return (v as { _?: PropertyValue })._ ?? "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
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
  onFieldOverride?: (path: string, overrides: Partial<FieldOverrides[string]>) => void;
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
}: TemplatePropertyRendererProps) {
  const [internalValue, setInternalValue] = useState<PropertyValue>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSelectOptions, setEditSelectOptions] = useState<SelectOption[]>([]);
  const [editScaleConfig, setEditScaleConfig] = useState<ScaleConfig>({ min: 1, max: 5 });
  const isControlled = controlledOnChange !== undefined;

  const propertyPath = propPath ?? propertyId;
  const canEdit = Boolean(onFieldOverride && getInputTypeForPath);

  const value = isControlled
    ? toPropertyValue(controlledValue)
    : internalValue;

  const onChange = useCallback(
    (v: PropertyValue) => {
      if (isControlled) {
        const hasSub =
          property.subtemplate_properties &&
          Object.keys(property.subtemplate_properties).length > 0;
        const current = controlledValue;
        if (hasSub && typeof current === "object" && current !== null && !Array.isArray(current)) {
          controlledOnChange?.({ ...current, _: v });
        } else {
          controlledOnChange?.(v);
        }
      } else {
        setInternalValue(v);
      }
    },
    [isControlled, controlledOnChange, controlledValue, property.subtemplate_properties],
  );

  const overrides = fieldOverrides[propertyPath];
  const effectiveLabel = overrides?.label ?? property.label;
  const effectiveDescription = overrides?.description ?? property.description;
  const selectOptions = overrides?.selectOptions;
  const scaleConfig = overrides?.scaleConfig;
  const inputType = getInputTypeForPath
    ? getInputTypeForPath(propertyPath, property)
    : (property as EnrichedSubtemplateProperty).valueType !== undefined
      ? getInputTypeFromValueType((property as EnrichedSubtemplateProperty).valueType!)
      : getInputTypeForProperty(propertyId);

  const handleSaveEdit = useCallback(() => {
    const payload: Partial<FieldOverrides[string]> = {
      label: editLabel.trim() || undefined,
      description: editDescription.trim() || undefined,
    };
    if (inputType === "select" && editSelectOptions.length > 0) {
      payload.selectOptions = editSelectOptions.filter((o) => o.value.trim() || o.label.trim());
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
    (keys: Parameters<NonNullable<React.ComponentProps<typeof Select>["onSelectionChange"]>>[0]) => {
      const keySet = keys instanceof Set ? keys : new Set<string>();
      const first = keySet.values().next().value;

      if (first != null) {
        onFieldOverride?.(propertyPath, { inputType: String(first) as InputType });
      }
    },
    [onFieldOverride, propertyPath],
  );

  const hasSubproperties =
    property.subtemplate_properties &&
    Object.keys(property.subtemplate_properties).length > 0;

  const hasOverrides = Boolean(overrides?.label ?? overrides?.description ?? overrides?.inputType ?? overrides?.selectOptions ?? overrides?.scaleConfig);
  const fieldEditorUi = canEdit && editMode && (
    <Accordion
      className="mt-3 w-full gap-0 px-0"
      variant="bordered"
      itemClasses={{ base: "border-default-200 rounded-xl overflow-hidden shadow-sm" }}
    >
      <AccordionItem
        key="edit"
        aria-label="Customize field"
        classNames={{
          trigger: "py-2.5 px-4 data-[hover=true]:bg-default-100/80 min-h-0 rounded-xl",
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
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => {
                  const o = fieldOverrides[propertyPath];
                  setEditLabel(o?.label ?? property.label);
                  setEditDescription(o?.description ?? property.description ?? "");
                  setEditSelectOptions(o?.selectOptions ?? [{ value: "opt1", label: "Option 1" }, { value: "other", label: "Other/Comments" }]);
                  setEditScaleConfig(o?.scaleConfig ?? { min: 1, max: 5, minLabel: "Low", maxLabel: "High" });
                  setIsEditing(true);
                }}
              >
                Edit field
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-default-600">Editing</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="flat" color="primary" onPress={handleSaveEdit}>
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
            size="sm"
            value={editLabel}
            onValueChange={setEditLabel}
            placeholder="Field label"
          />
          <Textarea
            label="Description"
            size="sm"
            minRows={2}
            value={editDescription}
            onValueChange={setEditDescription}
            placeholder="Field description (optional)"
          />
          <Select
            label="Field type"
            size="sm"
            selectedKeys={
              new Set([fieldOverrides[propertyPath]?.inputType ?? inputType])
            }
            onSelectionChange={handleFieldTypeChange}
            placeholder="Select type"
          >
            {INPUT_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
          {inputType === "select" && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-default-600">Select options (PDF-style)</span>
              {editSelectOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    size="sm"
                    placeholder="Value"
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
                    size="sm"
                    placeholder="Label"
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
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() =>
                      setEditSelectOptions((prev) => prev.filter((_, j) => j !== i))
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
                  setEditSelectOptions((prev) => [...prev, { value: `opt${prev.length + 1}`, label: `Option ${prev.length + 1}` }])
                }
              >
                + Add option
              </Button>
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
                  setEditScaleConfig((prev) => ({ ...prev, min: Number(v) || 1 }))
                }
              />
              <Input
                label="Max"
                size="sm"
                type="number"
                value={String(editScaleConfig.max)}
                onValueChange={(v) =>
                  setEditScaleConfig((prev) => ({ ...prev, max: Number(v) || 5 }))
                }
              />
              <Input
                label="Start label (e.g. Difficult)"
                size="sm"
                placeholder="Optional"
                value={editScaleConfig.minLabel ?? ""}
                onValueChange={(v) =>
                  setEditScaleConfig((prev) => ({ ...prev, minLabel: v || undefined }))
                }
              />
              <Input
                label="End label (e.g. Easy)"
                size="sm"
                placeholder="Optional"
                value={editScaleConfig.maxLabel ?? ""}
                onValueChange={(v) =>
                  setEditScaleConfig((prev) => ({ ...prev, maxLabel: v || undefined }))
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

  // Leaf property: render input only
  if (!hasSubproperties) {
    return (
      <div className="w-full">
        <DynamicFieldInput
          cardinality={property.cardinality}
          classId={property.class_id}
          createLink={property.create_link}
          inputType={inputType}
          label={effectiveLabel}
          placeholder={effectiveDescription}
          propertyId={propertyId}
          scaleConfig={scaleConfig}
          selectOptions={selectOptions}
          value={value}
          onChange={onChange}
        />
        {fieldEditorUi}
      </div>
    );
  }

  // Property with nested subtemplate_properties
  return (
    <Card className="w-full overflow-hidden rounded-xl border border-default-200 shadow-sm" shadow="sm">
      <CardHeader className="flex flex-col items-start gap-1 border-b border-default-200/60 px-5 pt-5">
        <div className="w-full">
          <DynamicFieldInput
            cardinality={property.cardinality}
            classId={property.class_id}
            createLink={property.create_link}
            inputType={inputType}
            label={effectiveLabel}
            placeholder={effectiveDescription}
            propertyId={propertyId}
            scaleConfig={scaleConfig}
            selectOptions={selectOptions}
            value={value}
            onChange={onChange}
          />
        </div>
        {fieldEditorUi}
      </CardHeader>
      <CardBody className="px-5 pb-5 pt-4">
        <div className="ml-2 mt-1 rounded-lg border border-default-100 bg-default-50/30 px-5 py-4">
          {effectiveDescription && (
            <p className="mb-3 text-sm text-default-500">
              {effectiveDescription}
            </p>
          )}
          <Accordion className="gap-2" variant="bordered" itemClasses={{ base: "rounded-xl border-default-200 overflow-hidden" }}>
            {[
              ...Object.entries(property.subtemplate_properties!).map(
                ([subPropId, subProp]) => (
                <AccordionItem
                  key={subPropId}
                  aria-label={(fieldOverrides[`${propertyPath}.${subPropId}`]?.label ?? subProp.label)}
                  classNames={{
                    title: "text-default-800 font-medium",
                    trigger: "py-3 px-4 data-[hover=true]:bg-primary/5 data-[open=true]:bg-default-50 rounded-xl min-h-0",
                    content: "px-4 pb-4",
                  }}
                  subtitle={subProp.cardinality}
                  title={fieldOverrides[`${propertyPath}.${subPropId}`]?.label ?? subProp.label}
                >
                  <div className="pb-2">
                    <TemplatePropertyRenderer
                      customBlocks={customBlocks}
                      depth={depth + 1}
                      editMode={editMode}
                      fieldOverrides={fieldOverrides}
                      getInputTypeForPath={getInputTypeForPath}
                      nestedCustomBlocksRecord={nestedCustomBlocksRecord}
                      nestedCustomBlockIds={
                        nestedCustomBlocksRecord[`${propertyPath}.${subPropId}`] ?? []
                      }
                      onAddChildToSection={onAddChildToSection}
                      onAddNestedBlock={onAddNestedBlock}
                      onRemoveChildFromSection={onRemoveChildFromSection}
                      onReorderSectionChildren={onReorderSectionChildren}
                      onFieldOverride={onFieldOverride}
                      onNestedCustomValueChange={onNestedCustomValueChange}
                      onRemoveNestedBlock={onRemoveNestedBlock}
                      onUpdateCustomBlock={onUpdateCustomBlock}
                      property={subProp}
                      propertyId={subPropId}
                      propertyPath={`${propertyPath}.${subPropId}`}
                      value={
                        typeof controlledValue === "object" &&
                        controlledValue !== null &&
                        !Array.isArray(controlledValue)
                          ? (controlledValue as Record<string, FormValue>)[subPropId]
                          : undefined
                      }
                      values={values}
                      onValueChange={(v) => {
                        if (!controlledOnChange) return;
                        const hasSub =
                          property.subtemplate_properties &&
                          Object.keys(property.subtemplate_properties).length > 0;
                        const current = controlledValue;
                        if (hasSub && typeof current === "object" && current !== null && !Array.isArray(current)) {
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
                </AccordionItem>
              )),
              ...nestedCustomBlockIds.map((blockId) => {
              const block = customBlocks[blockId];

              if (!block) return null;

              if (block.type === "text") {
                return (
                  <AccordionItem
                    key={blockId}
                    aria-label={block.heading ?? "Text block"}
                    classNames={{
                      title: "text-default-800 font-medium",
                      trigger: "py-3 px-4 data-[hover=true]:bg-primary/5 data-[open=true]:bg-default-50 rounded-xl min-h-0",
                      content: "px-4 pb-4",
                    }}
                    title={block.heading ?? "Text block"}
                  >
                    <div className="pb-2">
                      <TextBlock
                        block={block}
                        editMode={editMode}
                        onRemove={() => onRemoveNestedBlock?.(propertyPath!, blockId)}
                        onUpdate={(b) => onUpdateCustomBlock?.(blockId, b)}
                      />
                    </div>
                  </AccordionItem>
                );
              }
              if (block.type === "customField") {
                return (
                  <AccordionItem
                    key={blockId}
                    aria-label={block.label}
                    classNames={{
                      title: "text-default-800 font-medium",
                      trigger: "py-3 px-4 data-[hover=true]:bg-primary/5 data-[open=true]:bg-default-50 rounded-xl min-h-0",
                      content: "px-4 pb-4",
                    }}
                    title={block.label}
                  >
                    <div className="pb-2">
                      <CustomFieldBlock
                        block={block}
                        editMode={editMode}
                        value={
                          (values[`__custom_${blockId}`] as string | number | boolean | string[] | undefined) ?? ""
                        }
                        onChange={(v) => onNestedCustomValueChange?.(blockId, v)}
                        onRemove={() => onRemoveNestedBlock?.(propertyPath!, blockId)}
                        onUpdate={(b) => onUpdateCustomBlock?.(blockId, b)}
                      />
                    </div>
                  </AccordionItem>
                );
              }
              if (block.type === "html") {
                return (
                  <AccordionItem
                    key={blockId}
                    aria-label="HTML block"
                    classNames={{
                      title: "text-default-800 font-medium",
                      trigger: "py-3 px-4 data-[hover=true]:bg-primary/5 data-[open=true]:bg-default-50 rounded-xl min-h-0",
                      content: "px-4 pb-4",
                    }}
                    title="HTML block"
                  >
                    <div className="pb-2">
                      <HtmlBlock
                        block={block}
                        editMode={editMode}
                        onRemove={() => onRemoveNestedBlock?.(propertyPath!, blockId)}
                        onUpdate={(b) => onUpdateCustomBlock?.(blockId, b)}
                      />
                    </div>
                  </AccordionItem>
                );
              }
              if (block.type === "section") {
                return (
                  <AccordionItem
                    key={blockId}
                    aria-label={block.title}
                    classNames={{
                      title: "text-default-800 font-medium",
                      trigger: "py-3 px-4 data-[hover=true]:bg-primary/5 data-[open=true]:bg-default-50 rounded-xl min-h-0",
                      content: "px-4 pb-4",
                    }}
                    title={block.title}
                  >
                    <div className="pb-2">
                      <SectionBlock
                        block={block}
                        childBlocks={(block.childIds ?? [])
                          .map((cid) => customBlocks[cid])
                          .filter(Boolean)}
                        editMode={editMode}
                        getChildBlocks={(sectionId) =>
                          (
                            (customBlocks[sectionId] as { childIds?: string[] })?.childIds ?? []
                          ).map((cid) => customBlocks[cid]).filter(Boolean)
                        }
                        getChildValue={(cid) =>
                          (values[`__custom_${cid}`] as string | number | boolean | string[] | undefined) ?? ""
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
                  </AccordionItem>
                );
              }

              return null;
            }),
            ]}
          </Accordion>
          {editMode && onAddNestedBlock && (
            <Dropdown className="mt-2">
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
      </CardBody>
    </Card>
  );
}
