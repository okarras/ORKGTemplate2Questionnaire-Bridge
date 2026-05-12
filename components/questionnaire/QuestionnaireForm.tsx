"use client";

import type { CustomBlock } from "@/types/template";
import type {
  EnrichedSubtemplateProperty,
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";
import type { DragEndEvent } from "@dnd-kit/core";
import type {
  FieldOverrides,
  FormValue,
  OrderedBlock,
} from "./questionnaire-form-types";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { Button } from "@heroui/button";

import {
  arrayMove,
  getBlockSortId,
  SortableContext,
  useBlockDndSensors,
  verticalListSortingStrategy,
} from "./SortableBlockItem";
import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";
import { OrkgSubmitModal } from "./OrkgSubmitModal";
import { AddBlockDropdown } from "./AddBlockDropdown";
import { QuestionnaireFormHeader } from "./QuestionnaireFormHeader";
import { QuestionnaireFormToolbar } from "./QuestionnaireFormToolbar";
import { QuestionnaireSortableBlock } from "./QuestionnaireSortableBlock";
import { CUSTOM_PREFIX } from "./questionnaire-form-constants";
import {
  buildInitialValues,
  inflateFromJson,
} from "./questionnaire-form-value-helpers";
import { downloadQuestionnaireJsonExport } from "./questionnaire-export-json";
import { exportQuestionnaireToPdf } from "./questionnaire-export-pdf";
import {
  defaultStructureDraftFromMapping,
  loadQuestionnaireDraft,
  QUESTIONNAIRE_DRAFT_STORAGE_VERSION,
  reconcileStructureDraft,
  saveQuestionnaireDraft,
  type PersistedQuestionnaireDraft,
  type QuestionnaireStructureDraft,
} from "./questionnaire-draft-storage";

import { useUndoableState } from "@/hooks/useUndoableState";

function labelForPropertyPath(
  mapping: EnrichedTemplateMapping,
  path: string,
): string {
  const parts = path.split(".");
  let prop: SubtemplateProperty | undefined = mapping[parts[0]!];

  if (!prop) return path;

  for (let i = 1; i < parts.length; i++) {
    const subMap: Record<string, SubtemplateProperty> | undefined =
      prop.subtemplate_properties;

    if (!subMap) return path;
    prop = subMap[parts[i]!];
    if (!prop) return path;
  }

  return prop.label ?? path;
}

interface QuestionnaireFormProps {
  templateId: string;
  targetClassId?: string;
  label: string;
  mapping: EnrichedTemplateMapping;
  backHref?: string;
  initialEditMode?: boolean;
  values?: Record<string, FormValue>;
  onValuesChange?: (values: Record<string, FormValue>) => void;
  showSubmitButton?: boolean;
  /** When set (e.g. from page mode switcher), shows Undo/Redo answers in the toolbar. */
  answerHistory?: {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
  };
  /** When set, latest answers + form structure are written to localStorage for this template. */
  persistDraftToTemplateId?: string;
  /** Debounced callback after persisting (e.g. ORKG preview structure sync). */
  onDraftPersist?: (draft: PersistedQuestionnaireDraft) => void;
}

export type {
  FieldOverrides,
  FormValue,
  ScaleConfig,
  SelectOption,
} from "./questionnaire-form-types";

export function QuestionnaireForm({
  templateId,
  targetClassId,
  label,
  mapping,
  backHref = "/",
  initialEditMode = true,
  values: controlledValues,
  onValuesChange,
  showSubmitButton = true,
  answerHistory,
  persistDraftToTemplateId,
  onDraftPersist,
}: QuestionnaireFormProps) {
  const isControlled = controlledValues !== undefined;
  const [localValues, setLocalValues] = useState<Record<string, FormValue>>(
    () => controlledValues ?? buildInitialValues(mapping),
  );
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [editMode, setEditMode] = useState(initialEditMode);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const values = isControlled ? controlledValues : localValues;

  const handleValuesChange = useCallback(
    (
      updater: (prev: Record<string, FormValue>) => Record<string, FormValue>,
    ) => {
      if (isControlled) {
        const next = updater(controlledValues);

        if (onValuesChange) onValuesChange(next);
      } else {
        setLocalValues((prev) => {
          const next = updater(prev);

          if (onValuesChange) onValuesChange(next);

          return next;
        });
      }
    },
    [isControlled, controlledValues, onValuesChange],
  );

  const [structure, setStructure, { undo, redo, canUndo, canRedo }] =
    useUndoableState<QuestionnaireStructureDraft>(
      defaultStructureDraftFromMapping(mapping),
    );

  const structureHydratedRef = useRef(false);

  useLayoutEffect(() => {
    if (structureHydratedRef.current) return;
    structureHydratedRef.current = true;
    if (persistDraftToTemplateId == null) return;
    const loaded = loadQuestionnaireDraft(persistDraftToTemplateId);

    if (!loaded?.structure) return;
    setStructure(() => reconcileStructureDraft(loaded.structure, mapping));
  }, [persistDraftToTemplateId, mapping, setStructure]);

  const {
    orderedBlocks,
    customBlocks,
    fieldOverrides,
    nestedCustomBlocks,
    removedBuiltinProperties = [],
  } = structure;

  const onDraftPersistRef = useRef(onDraftPersist);

  onDraftPersistRef.current = onDraftPersist;

  useEffect(() => {
    if (!persistDraftToTemplateId) return;
    const t = window.setTimeout(() => {
      const draft: PersistedQuestionnaireDraft = {
        v: QUESTIONNAIRE_DRAFT_STORAGE_VERSION,
        values,
        structure: {
          orderedBlocks,
          customBlocks,
          fieldOverrides,
          nestedCustomBlocks,
          removedBuiltinProperties,
        },
      };

      saveQuestionnaireDraft(persistDraftToTemplateId, draft);
      onDraftPersistRef.current?.(draft);
    }, 400);

    return () => window.clearTimeout(t);
  }, [
    persistDraftToTemplateId,
    values,
    orderedBlocks,
    customBlocks,
    fieldOverrides,
    nestedCustomBlocks,
    removedBuiltinProperties,
  ]);

  const addBlock = useCallback(
    (
      type: "text" | "section" | "customField" | "html",
      afterIndex: number,
      parentSectionId?: string,
    ) => {
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newBlock: OrderedBlock = { kind: "custom", id };
      let blockData: CustomBlock;

      if (type === "text") {
        blockData = { type: "text", id, body: "" };
      } else if (type === "section") {
        blockData = { type: "section", id, title: "New section", childIds: [] };
      } else if (type === "html") {
        blockData = { type: "html", id, html: "<p>Your content here...</p>" };
      } else {
        blockData = {
          type: "customField",
          id,
          label: "New field",
          inputType: "text",
        };
      }

      setStructure((prev) => {
        const nextCustom = { ...prev.customBlocks, [id]: blockData };

        if (parentSectionId !== undefined) {
          const section = nextCustom[parentSectionId];

          if (section?.type === "section") {
            const childIds = [...(section.childIds ?? []), id];
            const updatedSection: typeof section = { ...section, childIds };

            return {
              ...prev,
              customBlocks: {
                ...nextCustom,
                [parentSectionId]: updatedSection,
              },
            };
          }
        }

        const nextOrdered = [...prev.orderedBlocks];

        nextOrdered.splice(afterIndex + 1, 0, newBlock);

        return {
          ...prev,
          orderedBlocks: nextOrdered,
          customBlocks: nextCustom,
        };
      });

      if (type === "customField") {
        handleValuesChange((prev) => ({ ...prev, [CUSTOM_PREFIX + id]: "" }));
      }
    },
    [setStructure, handleValuesChange],
  );

  const removeBlock = useCallback(
    (block: OrderedBlock) => {
      if (block.kind === "custom") {
        setStructure((prev) => {
          const nextCustom = { ...prev.customBlocks };

          delete nextCustom[block.id];

          return {
            ...prev,
            orderedBlocks: prev.orderedBlocks.filter(
              (b) => !(b.kind === "custom" && b.id === block.id),
            ),
            customBlocks: nextCustom,
          };
        });
        handleValuesChange((prev) => {
          const next = { ...prev };

          delete next[CUSTOM_PREFIX + block.id];

          return next;
        });
      } else {
        setStructure((prev) => ({
          ...prev,
          orderedBlocks: prev.orderedBlocks.filter(
            (b) => !(b.kind === "property" && b.id === block.id),
          ),
        }));
      }
    },
    [setStructure, handleValuesChange],
  );

  const removeCustomBlock = useCallback(
    (id: string) => {
      removeBlock({ kind: "custom", id });
    },
    [removeBlock],
  );

  const updateCustomBlock = useCallback(
    (id: string, data: CustomBlock) => {
      setStructure((prev) => ({
        ...prev,
        customBlocks: { ...prev.customBlocks, [id]: data },
      }));
    },
    [setStructure],
  );

  const addChildToSection = useCallback(
    (sectionId: string, type: "text" | "section" | "customField" | "html") => {
      addBlock(type, -1, sectionId);
    },
    [addBlock],
  );

  const sensors = useBlockDndSensors();

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over == null || active.id === over.id) return;

      const oldIndex = orderedBlocks.findIndex(
        (b) => getBlockSortId(b) === active.id,
      );
      const newIndex = orderedBlocks.findIndex(
        (b) => getBlockSortId(b) === over.id,
      );

      if (oldIndex === -1 || newIndex === -1) return;

      setStructure((prev) => ({
        ...prev,
        orderedBlocks: arrayMove(prev.orderedBlocks, oldIndex, newIndex),
      }));
    },
    [orderedBlocks, setStructure],
  );

  const addNestedBlock = useCallback(
    (
      propertyPath: string,
      type: "text" | "section" | "customField" | "html",
    ) => {
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      let blockData: CustomBlock;

      if (type === "text") {
        blockData = { type: "text", id, body: "" };
      } else if (type === "section") {
        blockData = { type: "section", id, title: "New section", childIds: [] };
      } else if (type === "html") {
        blockData = { type: "html", id, html: "<p>Content...</p>" };
      } else {
        blockData = {
          type: "customField",
          id,
          label: "New field",
          inputType: "text",
        };
      }

      setStructure((prev) => ({
        ...prev,
        customBlocks: { ...prev.customBlocks, [id]: blockData },
        nestedCustomBlocks: {
          ...prev.nestedCustomBlocks,
          [propertyPath]: [
            ...(prev.nestedCustomBlocks[propertyPath] ?? []),
            id,
          ],
        },
      }));

      if (type === "customField") {
        handleValuesChange((prev) => ({ ...prev, [CUSTOM_PREFIX + id]: "" }));
      }
    },
    [setStructure, handleValuesChange],
  );

  const removeNestedBlock = useCallback(
    (propertyPath: string, childId: string) => {
      setStructure((prev) => {
        const nextCustom = { ...prev.customBlocks };

        delete nextCustom[childId];

        return {
          ...prev,
          customBlocks: nextCustom,
          nestedCustomBlocks: {
            ...prev.nestedCustomBlocks,
            [propertyPath]: (
              prev.nestedCustomBlocks[propertyPath] ?? []
            ).filter((cid) => cid !== childId),
          },
        };
      });
      handleValuesChange((prev) => {
        const next = { ...prev };

        delete next[CUSTOM_PREFIX + childId];

        return next;
      });
    },
    [setStructure, handleValuesChange],
  );

  const removeBuiltinProperty = useCallback(
    (propertyPath: string) => {
      setStructure((prev) => ({
        ...prev,
        removedBuiltinProperties: [
          ...(prev.removedBuiltinProperties ?? []),
          propertyPath,
        ],
      }));
    },
    [setStructure],
  );

  const restoreBuiltinProperty = useCallback(
    (propertyPath: string) => {
      setStructure((prev) => ({
        ...prev,
        removedBuiltinProperties: (prev.removedBuiltinProperties ?? []).filter(
          (p) => p !== propertyPath,
        ),
      }));
    },
    [setStructure],
  );

  const reorderSectionChildren = useCallback(
    (sectionId: string, newChildIds: string[]) => {
      setStructure((prev) => {
        const section = prev.customBlocks[sectionId];

        if (section?.type !== "section") return prev;

        const nextCustom = { ...prev.customBlocks };

        nextCustom[sectionId] = { ...section, childIds: newChildIds };

        return { ...prev, customBlocks: nextCustom };
      });
    },
    [setStructure],
  );

  const removeChildFromSection = useCallback(
    (sectionId: string, childId: string) => {
      setStructure((prev) => {
        const section = prev.customBlocks[sectionId];

        if (section?.type !== "section") return prev;

        const childIds = (section.childIds ?? []).filter((c) => c !== childId);
        const nextCustom = { ...prev.customBlocks };

        delete nextCustom[childId];
        nextCustom[sectionId] = { ...section, childIds };

        return { ...prev, customBlocks: nextCustom };
      });
      handleValuesChange((prev) => {
        const next = { ...prev };

        delete next[CUSTOM_PREFIX + childId];

        return next;
      });
    },
    [setStructure, handleValuesChange],
  );
  const getValue = useCallback(
    (propertyId: string, hasSub: boolean): FormValue => {
      const v = values[propertyId];

      if (v === undefined) return hasSub ? { _: "" } : "";

      return v;
    },
    [values],
  );

  const setValue = useCallback(
    (propertyId: string, value: FormValue) => {
      handleValuesChange((prev) => ({ ...prev, [propertyId]: value }));
    },
    [handleValuesChange],
  );

  const onFieldOverride = useCallback(
    (propertyPath: string, overrides: Partial<FieldOverrides[string]>) => {
      setStructure((prev) => {
        const current = prev.fieldOverrides[propertyPath] ?? {};
        const merged = { ...current, ...overrides };

        if (
          merged.label === undefined &&
          merged.description === undefined &&
          merged.inputType === undefined &&
          merged.selectOptions === undefined &&
          merged.scaleConfig === undefined
        ) {
          const next = { ...prev.fieldOverrides };

          delete next[propertyPath];

          return { ...prev, fieldOverrides: next };
        }

        return {
          ...prev,
          fieldOverrides: {
            ...prev.fieldOverrides,
            [propertyPath]: merged,
          },
        };
      });
    },
    [setStructure],
  );

  const getEffectiveProperty = useCallback(
    (path: string, prop: SubtemplateProperty): SubtemplateProperty => {
      const o = fieldOverrides[path];

      if (!o) return prop;

      return {
        ...prop,
        label: o.label ?? prop.label,
        description: o.description ?? prop.description,
      };
    },
    [fieldOverrides],
  );

  const getInputTypeForPath = useCallback(
    (path: string, prop: SubtemplateProperty): InputType => {
      const o = fieldOverrides[path];

      if (o?.inputType) return o.inputType;

      const enriched = prop as EnrichedSubtemplateProperty;

      return enriched.valueType !== undefined
        ? getInputTypeFromValueType(
            enriched.valueType,
            enriched.literalDatatype,
          )
        : getInputTypeForProperty(path.split(".").pop() ?? path);
    },
    [fieldOverrides],
  );

  const handleExportJson = useCallback(() => {
    downloadQuestionnaireJsonExport({
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
    });
  }, [
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
  ]);

  const handleImportJson = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as {
          templateId?: string;
          answers?: Record<string, unknown>;
          customAnswers?: Record<string, unknown>;
        };

        const answers = data.answers ?? {};
        const customAnswers = data.customAnswers ?? {};

        handleValuesChange((prev) => {
          const next = { ...prev };

          for (const [propId, prop] of Object.entries(mapping)) {
            const srcVal = (answers as Record<string, unknown>)[propId];

            if (srcVal !== undefined) {
              next[propId] = inflateFromJson(srcVal, prop);
            }
          }

          for (const [customId, v] of Object.entries(customAnswers)) {
            next[CUSTOM_PREFIX + customId] = (v as FormValue) ?? "";
          }

          return next;
        });
      } catch (err) {
        // eslint-disable-next-line no-console -- client-side import error
        console.error("Import JSON failed:", err);
        alert(
          `Import JSON failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      } finally {
        event.target.value = "";
      }
    },
    [mapping, handleValuesChange],
  );

  const runExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    await new Promise((r) => setTimeout(r, 0));
    try {
      await exportQuestionnaireToPdf({
        templateId,
        label,
        mapping,
        values,
        orderedBlocks,
        customBlocks,
        fieldOverrides,
        removedBuiltinProperties,
        nestedCustomBlocks,
        getEffectiveProperty,
        getInputTypeForPath,
      });
    } finally {
      setIsExportingPdf(false);
    }
  }, [
    templateId,
    label,
    mapping,
    values,
    orderedBlocks,
    customBlocks,
    fieldOverrides,
    removedBuiltinProperties,
    nestedCustomBlocks,
    getEffectiveProperty,
    getInputTypeForPath,
  ]);

  return (
    <section className="questionnaire-form flex w-full max-w-none flex-col gap-10 py-10 p-10">
      <QuestionnaireFormHeader
        editMode={editMode}
        label={label}
        templateId={templateId}
        onEditModeChange={setEditMode}
      />

      {editMode && removedBuiltinProperties.length > 0 && (
        <div className="rounded-xl border border-warning-200 bg-warning-50/50 px-4 py-3 text-sm text-default-800">
          <p className="mb-2 font-medium text-warning-900">
            Removed template fields — restore to show them on the form again:
          </p>
          <div className="flex flex-wrap gap-2">
            {removedBuiltinProperties.map((path) => (
              <div
                key={path}
                className="flex items-center gap-2 rounded-lg border border-warning-200/80 bg-background/80 px-2 py-1.5"
              >
                <span className="max-w-[14rem] truncate text-xs">
                  {labelForPropertyPath(mapping, path)}
                </span>
                <Button
                  color="warning"
                  size="sm"
                  variant="flat"
                  onPress={() => restoreBuiltinProperty(path)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <QuestionnaireFormToolbar
        backHref={backHref}
        canRedo={canRedo}
        canRedoAnswers={answerHistory?.canRedo}
        canUndo={canUndo}
        canUndoAnswers={answerHistory?.canUndo}
        fileInputRef={fileInputRef}
        isExportingPdf={isExportingPdf}
        showSubmitButton={showSubmitButton}
        onExportJson={handleExportJson}
        onExportPdf={runExportPdf}
        onImportFileChange={handleImportJson}
        onOpenSubmitModal={() => setShowSubmitModal(true)}
        onRedo={redo}
        onRedoAnswers={answerHistory?.onRedo}
        onUndo={undo}
        onUndoAnswers={answerHistory?.onUndo}
      />

      <div className="flex flex-col gap-8">
        {editMode && (
          <div className="flex justify-center rounded-xl border-2 border-dashed border-default-300 bg-default-50/50 py-6">
            <AddBlockDropdown addBlock={addBlock} afterIndex={-1} />
          </div>
        )}
        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedBlocks.map(getBlockSortId)}
            strategy={verticalListSortingStrategy}
          >
            {orderedBlocks.map((block, index) => (
              <QuestionnaireSortableBlock
                key={getBlockSortId(block)}
                addBlock={addBlock}
                addChildToSection={addChildToSection}
                addNestedBlock={addNestedBlock}
                block={block}
                customBlocks={customBlocks}
                editMode={editMode}
                fieldOverrides={fieldOverrides}
                getInputTypeForPath={getInputTypeForPath}
                getValue={getValue}
                index={index}
                mapping={mapping}
                nestedCustomBlocks={nestedCustomBlocks}
                removeBlock={removeBlock}
                removeBuiltinProperty={removeBuiltinProperty}
                removeChildFromSection={removeChildFromSection}
                removeCustomBlock={removeCustomBlock}
                removeNestedBlock={removeNestedBlock}
                removedBuiltinProperties={removedBuiltinProperties}
                reorderSectionChildren={reorderSectionChildren}
                setValue={setValue}
                sortId={getBlockSortId(block)}
                updateCustomBlock={updateCustomBlock}
                values={values}
                onFieldOverride={onFieldOverride}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {showSubmitButton && (
        <OrkgSubmitModal
          isOpen={showSubmitModal}
          mapping={mapping}
          targetClassId={targetClassId}
          templateId={templateId}
          templateLabel={label}
          values={values}
          onClose={() => setShowSubmitModal(false)}
        />
      )}
    </section>
  );
}
