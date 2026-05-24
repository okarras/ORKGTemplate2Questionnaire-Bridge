"use client";

import type { CustomBlock } from "@/types/template";
import type {
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";
import type {
  FieldOverrides,
  FormValue,
  OrderedBlock,
} from "./questionnaire-form-types";

import { Button } from "@heroui/button";

import { TemplatePropertyRenderer } from "./TemplatePropertyRenderer";
import {
  CustomFieldBlock,
  HtmlBlock,
  SectionBlock,
  TextBlock,
} from "./CustomBlocks";
import { SortableBlockWrapper } from "./SortableBlockItem";
import { AddBlockDropdown, type AddBlockKind } from "./AddBlockDropdown";
import { CUSTOM_PREFIX } from "./questionnaire-form-constants";

/** Chevron icon for the collapsible header */
function BlockChevron() {
  return (
    <svg
      aria-hidden
      className="q-chevron"
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

/** Block type badge label */
function blockTypeLabel(
  block: OrderedBlock,
  customBlocks: Record<string, CustomBlock>,
): { label: string; cssClass: string } {
  if (block.kind === "property") {
    return { label: "Property", cssClass: "q-type-badge--property" };
  }
  const custom = customBlocks[block.id];

  if (!custom) return { label: "Block", cssClass: "q-type-badge--custom" };
  switch (custom.type) {
    case "text":
      return { label: "Text", cssClass: "q-type-badge--text" };
    case "html":
      return { label: "HTML", cssClass: "q-type-badge--html" };
    case "section":
      return { label: "Section", cssClass: "q-type-badge--section" };
    case "customField":
      return { label: "Custom Field", cssClass: "q-type-badge--custom" };
    default:
      return { label: "Block", cssClass: "q-type-badge--custom" };
  }
}

/** Block card variant class */
function blockCardVariant(
  block: OrderedBlock,
  customBlocks: Record<string, CustomBlock>,
): string {
  if (block.kind === "property") return "q-block-card--property";
  const custom = customBlocks[block.id];

  if (!custom) return "";
  switch (custom.type) {
    case "text":
      return "q-block-card--text";
    case "html":
      return "q-block-card--html";
    case "section":
      return "q-block-card--section";
    case "customField":
      return "q-block-card--custom";
    default:
      return "";
  }
}

export interface QuestionnaireSortableBlockProps {
  sortId: string;
  block: OrderedBlock;
  index: number;
  editMode: boolean;
  mapping: EnrichedTemplateMapping;
  customBlocks: Record<string, CustomBlock>;
  nestedCustomBlocks: Record<string, string[]>;
  removedBuiltinProperties: string[];
  fieldOverrides: FieldOverrides;
  values: Record<string, FormValue>;
  getValue: (propertyId: string, hasSub: boolean) => FormValue;
  setValue: (propertyId: string, value: FormValue) => void;
  getInputTypeForPath: (path: string, prop: SubtemplateProperty) => InputType;
  onFieldOverride: (
    propertyPath: string,
    overrides: Partial<FieldOverrides[string]>,
  ) => void;
  addBlock: (
    type: AddBlockKind,
    afterIndex: number,
    parentSectionId?: string,
  ) => void;
  addNestedBlock: (propertyPath: string, type: AddBlockKind) => void;
  removeNestedBlock: (propertyPath: string, childId: string) => void;
  removeBuiltinProperty: (propertyPath: string) => void;
  addChildToSection: (sectionId: string, type: AddBlockKind) => void;
  removeChildFromSection: (sectionId: string, childId: string) => void;
  reorderSectionChildren: (sectionId: string, newChildIds: string[]) => void;
  updateCustomBlock: (id: string, data: CustomBlock) => void;
  removeCustomBlock: (id: string) => void;
  removeBlock: (block: OrderedBlock) => void;
}

export function QuestionnaireSortableBlock({
  sortId,
  block,
  index,
  editMode,
  mapping,
  customBlocks,
  nestedCustomBlocks,
  removedBuiltinProperties,
  fieldOverrides,
  values,
  getValue,
  setValue,
  getInputTypeForPath,
  onFieldOverride,
  addBlock,
  addNestedBlock,
  removeNestedBlock,
  removeBuiltinProperty,
  addChildToSection,
  removeChildFromSection,
  reorderSectionChildren,
  updateCustomBlock,
  removeCustomBlock,
  removeBlock,
}: QuestionnaireSortableBlockProps) {
  const propertyMeta =
    block.kind === "property" ? mapping[block.id] : undefined;
  const sectionSummaryTitle =
    block.kind === "property"
      ? (propertyMeta?.label ?? block.id)
      : (() => {
          const custom = customBlocks[block.id];

          if (!custom) return "Block";

          if (custom.type === "text") return custom.heading ?? "Text block";
          if (custom.type === "html") return "HTML block";
          if (custom.type === "section") return custom.title ?? "Section";
          return custom.label ?? "Custom field";
        })();

  const typeInfo = blockTypeLabel(block, customBlocks);
  const cardVariant = blockCardVariant(block, customBlocks);

  const blockContent =
    block.kind === "property" ? (
      <>
        <TemplatePropertyRenderer
          customBlocks={customBlocks}
          editMode={editMode}
          fieldOverrides={fieldOverrides}
          getInputTypeForPath={getInputTypeForPath}
          nestedCustomBlockIds={nestedCustomBlocks[block.id] ?? []}
          nestedCustomBlocksRecord={nestedCustomBlocks}
          property={mapping[block.id]!}
          propertyId={block.id}
          propertyPath={block.id}
          removedBuiltinProperties={removedBuiltinProperties}
          sectionTitleRenderedExternally
          value={getValue(
            block.id,
            !!mapping[block.id]?.subtemplate_properties?.length,
          )}
          values={values}
          onAddChildToSection={addChildToSection}
          onAddNestedBlock={addNestedBlock}
          onFieldOverride={onFieldOverride}
          onNestedCustomValueChange={(blockId, v) =>
            setValue(`${CUSTOM_PREFIX}${blockId}`, v)
          }
          onRemoveBuiltinProperty={removeBuiltinProperty}
          onRemoveChildFromSection={removeChildFromSection}
          onRemoveNestedBlock={removeNestedBlock}
          onReorderSectionChildren={reorderSectionChildren}
          onUpdateCustomBlock={updateCustomBlock}
          onValueChange={(v) => setValue(block.id, v)}
        />
        {editMode && (
          <div className="q-add-block-zone">
            <AddBlockDropdown addBlock={addBlock} afterIndex={index} />
          </div>
        )}
      </>
    ) : (
      <>
        {(() => {
          const custom = customBlocks[block.id];

          if (!custom) return null;
          if (custom.type === "text") {
            return (
              <TextBlock
                block={custom}
                editMode={editMode}
                onRemove={() => removeCustomBlock(block.id)}
                onUpdate={(b) => updateCustomBlock(block.id, b)}
              />
            );
          }
          if (custom.type === "html") {
            return (
              <HtmlBlock
                block={custom}
                editMode={editMode}
                onRemove={() => removeCustomBlock(block.id)}
                onUpdate={(b) => updateCustomBlock(block.id, b)}
              />
            );
          }
          if (custom.type === "section") {
            const sectionChildIds = custom.childIds ?? [];
            const sectionChildBlocks = sectionChildIds
              .map((cid) => customBlocks[cid])
              .filter(Boolean);

            return (
              <SectionBlock
                block={custom}
                childBlocks={sectionChildBlocks}
                editMode={editMode}
                getChildBlocks={(sectionId) => {
                  const s = customBlocks[sectionId] as
                    | { type: "section"; childIds?: string[] }
                    | undefined;

                  return (s?.childIds ?? [])
                    .map((cid) => customBlocks[cid])
                    .filter(Boolean) as CustomBlock[];
                }}
                getChildValue={(cid) =>
                  (values[CUSTOM_PREFIX + cid] as
                    | string
                    | number
                    | boolean
                    | string[]
                    | undefined) ?? ""
                }
                onAddChild={(sectionId, type) =>
                  addChildToSection(sectionId, type)
                }
                onChildValueChange={(cid, v) =>
                  setValue(CUSTOM_PREFIX + cid, v)
                }
                onRemove={() => removeCustomBlock(block.id)}
                onRemoveChild={(sectionId, cid) =>
                  removeChildFromSection(sectionId, cid)
                }
                onReorderChildren={reorderSectionChildren}
                onUpdate={(b) => updateCustomBlock(block.id, b)}
                onUpdateChild={(cid, b) => updateCustomBlock(cid, b)}
              />
            );
          }

          return (
            <CustomFieldBlock
              block={custom}
              editMode={editMode}
              value={
                (values[CUSTOM_PREFIX + block.id] as
                  | string
                  | number
                  | boolean
                  | string[]
                  | undefined) ?? ""
              }
              onChange={(v) => setValue(CUSTOM_PREFIX + block.id, v)}
              onRemove={() => removeCustomBlock(block.id)}
              onUpdate={(b) => updateCustomBlock(block.id, b)}
            />
          );
        })()}
        {editMode && (
          <div className="q-add-block-zone">
            <AddBlockDropdown addBlock={addBlock} afterIndex={index} />
          </div>
        )}
      </>
    );

  return (
    <div
      key={sortId}
      className={`group/block q-block-card ${cardVariant}`}
    >
      <SortableBlockWrapper id={sortId} disabled={!editMode}>
        <div className="flex w-full items-start justify-between gap-3 p-5">
          <div className="min-w-0 flex-1">
            <details className="group/qroot w-full" open>
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-1.5 text-left outline-none hover:bg-default-50/80 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {editMode && (
                    <span className={`q-type-badge ${typeInfo.cssClass}`}>
                      {typeInfo.label}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-base font-semibold text-default-900">
                    {sectionSummaryTitle}
                  </span>
                </div>
                <BlockChevron />
              </summary>
              <div className="q-collapsible-content mt-3 min-w-0 border-t border-default-100 pt-4">
                {blockContent}
              </div>
            </details>
          </div>
          {editMode && (
            <Button
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              color="danger"
              isIconOnly
              size="sm"
              title="Remove this block"
              variant="light"
              onPress={() => removeBlock(block)}
            >
              <svg
                aria-hidden
                fill="none"
                height="16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                viewBox="0 0 24 24"
                width="16"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </Button>
          )}
        </div>
      </SortableBlockWrapper>
    </div>
  );
}
