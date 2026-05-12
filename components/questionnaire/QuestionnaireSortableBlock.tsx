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
          <div className="flex justify-center">
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
          <div className="flex justify-center">
            <AddBlockDropdown addBlock={addBlock} afterIndex={index} />
          </div>
        )}
      </>
    );

  return (
    <div
      key={sortId}
      className="group/block rounded-xl border border-default-100 bg-background p-5 transition-colors hover:border-default-200"
    >
      <SortableBlockWrapper disabled={!editMode} id={sortId}>
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0 flex-1">{blockContent}</div>
          <Button
            className={
              editMode
                ? "opacity-70 hover:opacity-100"
                : "opacity-0 transition-opacity group-hover/block:opacity-70 hover:opacity-100"
            }
            color="danger"
            size="sm"
            title="Remove this block"
            variant="light"
            onPress={() => removeBlock(block)}
          >
            Remove
          </Button>
        </div>
      </SortableBlockWrapper>
    </div>
  );
}
