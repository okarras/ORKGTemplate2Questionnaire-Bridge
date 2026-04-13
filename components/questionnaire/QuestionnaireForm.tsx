"use client";

import type {
  CustomBlock,
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";
import type { DragEndEvent } from "@dnd-kit/core";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@heroui/dropdown";
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";
import { DndContext, closestCenter } from "@dnd-kit/core";

import { TemplatePropertyRenderer } from "./TemplatePropertyRenderer";
import {
  CustomFieldBlock,
  HtmlBlock,
  SectionBlock,
  TextBlock,
} from "./CustomBlocks";
import {
  arrayMove,
  getBlockSortId,
  SortableBlockWrapper,
  SortableContext,
  useBlockDndSensors,
  verticalListSortingStrategy,
} from "./SortableBlockItem";
import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";
import { OrkgSubmitModal } from "./OrkgSubmitModal";

import { useUndoableState } from "@/hooks/useUndoableState";
import { getOrkgPropertyLink, getOrkgClassLink } from "@/lib/orkg-links";

type PropertyValue = string | number | boolean | string[];
export type FormValue =
  | PropertyValue
  | { _?: PropertyValue; [key: string]: FormValue | undefined };

function createEmptyValue(prop: SubtemplateProperty): FormValue {
  if (
    prop.subtemplate_properties &&
    Object.keys(prop.subtemplate_properties).length > 0
  ) {
    const obj: Record<string, FormValue> = { _: "" };

    for (const subId of Object.keys(prop.subtemplate_properties)) {
      obj[subId] = createEmptyValue(prop.subtemplate_properties[subId]);
    }

    return obj;
  }

  return "";
}

function buildInitialValues(
  mapping: EnrichedTemplateMapping,
): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};

  for (const [id, prop] of Object.entries(mapping)) {
    values[id] = createEmptyValue(prop);
  }

  return values;
}

function flattenForJson(v: FormValue, prop: SubtemplateProperty): unknown {
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

function inflateFromJson(src: unknown, prop: SubtemplateProperty): FormValue {
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

export interface SelectOption {
  value: string;
  label: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

type OrderedBlock =
  | { kind: "property"; id: string }
  | { kind: "custom"; id: string };

const CUSTOM_PREFIX = "__custom_";

interface StructureState {
  orderedBlocks: OrderedBlock[];
  customBlocks: Record<string, CustomBlock>;
  fieldOverrides: FieldOverrides;
  /** Custom block ids per property path (inside template's nested accordion) */
  nestedCustomBlocks: Record<string, string[]>;
}

/** User overrides for field label, description, input type, and options (keyed by property path) */
export type FieldOverrides = Record<
  string,
  {
    label?: string;
    description?: string;
    inputType?: InputType;
    selectOptions?: SelectOption[];
    scaleConfig?: ScaleConfig;
  }
>;

interface QuestionnaireFormProps {
  templateId: string;
  /** ORKG target class ID (e.g. "C12345") used when creating the resource instance */
  targetClassId?: string;
  label: string;
  mapping: EnrichedTemplateMapping;
  backHref?: string;
  /**
   * When true, starts in "Edit mode" (draggable blocks / block editing).
   * When false, starts in "Fill mode" (just the questionnaire fields).
   */
  initialEditMode?: boolean;
}

export function QuestionnaireForm({
  templateId,
  targetClassId,
  label,
  mapping,
  backHref = "/",
  initialEditMode = true,
}: QuestionnaireFormProps) {
  const [values, setValues] = useState<Record<string, FormValue>>(() =>
    buildInitialValues(mapping),
  );
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [editMode, setEditMode] = useState(initialEditMode);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [structure, setStructure, { undo, redo, canUndo, canRedo }] =
    useUndoableState<StructureState>({
      orderedBlocks: (Object.keys(mapping) as string[]).map((id) => ({
        kind: "property" as const,
        id,
      })),
      customBlocks: {},
      fieldOverrides: {},
      nestedCustomBlocks: {},
    });

  const { orderedBlocks, customBlocks, fieldOverrides, nestedCustomBlocks } =
    structure;

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
        setValues((prev) => ({ ...prev, [CUSTOM_PREFIX + id]: "" }));
      }
    },
    [setStructure],
  );

  const moveBlock = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;

      if (newIndex < 0 || newIndex >= orderedBlocks.length) return;

      setStructure((prev) => {
        const next = [...prev.orderedBlocks];
        const [removed] = next.splice(index, 1);

        next.splice(newIndex, 0, removed);

        return { ...prev, orderedBlocks: next };
      });
    },
    [orderedBlocks.length, setStructure],
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
        setValues((prev) => {
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
    [setStructure],
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
        setValues((prev) => ({ ...prev, [CUSTOM_PREFIX + id]: "" }));
      }
    },
    [setStructure],
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
      setValues((prev) => {
        const next = { ...prev };

        delete next[CUSTOM_PREFIX + childId];

        return next;
      });
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
      setValues((prev) => {
        const next = { ...prev };

        delete next[CUSTOM_PREFIX + childId];

        return next;
      });
    },
    [setStructure],
  );
  const getValue = useCallback(
    (propertyId: string, hasSub: boolean): FormValue => {
      const v = values[propertyId];

      if (v === undefined) return hasSub ? { _: "" } : "";

      return v;
    },
    [values],
  );

  const setValue = useCallback((propertyId: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [propertyId]: value }));
  }, []);

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

      const enriched = prop as { valueType?: string };

      return enriched.valueType !== undefined
        ? getInputTypeFromValueType(enriched.valueType as never)
        : getInputTypeForProperty(path.split(".").pop() ?? path);
    },
    [fieldOverrides],
  );

  const handleExportJson = useCallback(() => {
    const exportData: Record<string, unknown> = {
      templateId,
      templateLabel: label,
      exportedAt: new Date().toISOString(),
      answers: {},
      customAnswers: {},
    };

    for (const [propId, prop] of Object.entries(mapping)) {
      const v = values[propId];
      const flattened = flattenForJson(v, prop);

      if (flattened !== undefined) {
        (exportData.answers as Record<string, unknown>)[propId] = flattened;
      }
    }

    for (const [key, v] of Object.entries(values)) {
      if (
        key.startsWith(CUSTOM_PREFIX) &&
        v !== undefined &&
        v !== "" &&
        v !== null
      ) {
        const customId = key.slice(CUSTOM_PREFIX.length);

        (exportData.customAnswers as Record<string, unknown>)[customId] = v;
      }
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `questionnaire-${templateId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [templateId, label, mapping, values]);

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

        setValues((prev) => {
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
        console.error("Import JSON failed:", err);
        alert(
          `Import JSON failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      } finally {
        // Allow selecting the same file again if needed
        event.target.value = "";
      }
    },
    [mapping, setValues],
  );

  const handleExportPdf = useCallback(async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      const W = 595,
        H = 842,
        M = 44;
      const CW = W - 2 * M; // content width
      const BM = 48; // bottom margin for footer

      // Theme colors
      const primary = rgb(232 / 255, 97 / 255, 97 / 255); // #e86161
      const primaryBg = rgb(254 / 255, 242 / 255, 242 / 255); // #fef2f2
      const accent = rgb(252 / 255, 165 / 255, 165 / 255); // #fca5a5
      const dark = rgb(0.13, 0.13, 0.13);
      const muted = rgb(0.55, 0.55, 0.55);
      const subtle = rgb(0.72, 0.72, 0.72);
      const divider = rgb(0.87, 0.87, 0.87);
      const fieldBdr = rgb(0.78, 0.78, 0.78);
      const fieldFill = rgb(0.97, 0.97, 0.97);
      const linkBlue = rgb(30 / 255, 136 / 255, 229 / 255); // #1e88e5 secondary

      const pages: (typeof page)[] = [];
      let page = pdfDoc.addPage([W, H]);

      pages.push(page);
      let y = M; // y = distance from top of page

      const py = (topY: number) => H - topY; // convert to PDF coords

      const newPage = () => {
        page = pdfDoc.addPage([W, H]);
        pages.push(page);
        y = M;
      };

      const need = (h: number) => {
        if (y + h > H - BM) newPage();
      };

      // ── Text helpers ───────────────────────────────────────────
      const wrap = (
        text: string,
        maxW: number,
        f: typeof font,
        sz: number,
      ): string[] => {
        if (!text) return [];
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let cur = "";

        for (const w of words) {
          const t = cur ? `${cur} ${w}` : w;

          if (f.widthOfTextAtSize(t, sz) <= maxW) {
            cur = t;
          } else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);

        return lines;
      };

      // Draw text and return the width
      const drawText = (
        text: string,
        x: number,
        sz: number,
        f: typeof font,
        color: typeof dark,
      ) => {
        page.drawText(text, { x, y: py(y), size: sz, font: f, color });

        return f.widthOfTextAtSize(text, sz);
      };

      // Collect links to add at the very end (after form fields) to avoid
      // corrupting the form widget annotations that addToPage creates.
      const pendingLinks: {
        pageRef: typeof page;
        x: number;
        yTop: number;
        w: number;
        h: number;
        url: string;
      }[] = [];

      // Draw property ID as an ORKG link (blue underlined text)
      const drawPropertyLink = (
        propId: string,
        x: number,
        classId?: string,
      ) => {
        const url =
          getOrkgPropertyLink(propId) ??
          (classId ? getOrkgClassLink(classId) : null);
        const sz = 7.5;
        const tw = font.widthOfTextAtSize(propId, sz);

        page.drawText(propId, {
          x,
          y: py(y),
          size: sz,
          font,
          color: url ? linkBlue : muted,
        });
        if (url) {
          page.drawLine({
            start: { x, y: py(y) - 1 },
            end: { x: x + tw, y: py(y) - 1 },
            thickness: 0.5,
            color: linkBlue,
          });
          pendingLinks.push({
            pageRef: page,
            x,
            yTop: y,
            w: tw,
            h: sz + 2,
            url,
          });
        }

        return tw;
      };

      const form = pdfDoc.getForm();
      let fc = 0;

      const getType = (path: string, prop: SubtemplateProperty): InputType =>
        getInputTypeForPath(path, prop);

      const getValueForPath = (
        path: string,
        prop: SubtemplateProperty,
      ): FormValue | undefined => {
        const segments = path.split(".");

        if (!segments.length) return undefined;

        const rootId = segments[0]!;
        let current = values[rootId];

        if (current === undefined) return undefined;

        if (segments.length === 1) {
          if (
            typeof current === "object" &&
            current !== null &&
            !Array.isArray(current) &&
            prop.subtemplate_properties &&
            Object.keys(prop.subtemplate_properties).length > 0
          ) {
            const obj = current as Record<string, FormValue>;

            return obj._ ?? "";
          }

          return current;
        }

        if (
          typeof current !== "object" ||
          current === null ||
          Array.isArray(current)
        ) {
          return undefined;
        }

        let obj: unknown = current;

        for (let i = 1; i < segments.length; i++) {
          const key = segments[i]!;

          if (
            typeof obj !== "object" ||
            obj === null ||
            Array.isArray(obj) ||
            !(key in (obj as Record<string, unknown>))
          ) {
            return undefined;
          }

          obj = (obj as Record<string, unknown>)[key];
        }

        if (
          typeof obj === "object" &&
          obj !== null &&
          !Array.isArray(obj) &&
          prop.subtemplate_properties &&
          Object.keys(prop.subtemplate_properties).length > 0
        ) {
          const nested = obj as Record<string, FormValue>;

          return nested._ ?? "";
        }

        return obj as FormValue;
      };

      const toDisplayString = (v: FormValue | undefined): string => {
        if (v === undefined || v === null) return "";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (Array.isArray(v)) return v.join(", ");

        return String(v);
      };

      const toBool = (v: FormValue | undefined): boolean => {
        if (typeof v === "boolean") return v;
        if (typeof v === "number") return v !== 0;
        if (typeof v === "string") {
          const s = v.trim().toLowerCase();

          return s === "true" || s === "yes" || s === "1";
        }

        return false;
      };

      const fetchOptions = async (
        pid: string,
        cid?: string,
      ): Promise<{ value: string; label: string }[]> => {
        try {
          const hasP = pid.match(/^P\d+$/);
          const hasC = cid?.match(/^C\d+$/);

          if (!hasP && !hasC) return [];
          const params = new URLSearchParams();

          if (hasP) params.set("predicateId", pid);
          if (cid) params.set("classId", cid);
          params.set("limit", "500");
          const res = await fetch(`/api/orkg/resources?${params.toString()}`);
          const data = await res.json();

          return (data.resources ?? []).map(
            (r: { id: string; label: string }) => {
              const rawLabel = r.label || r.id.split("/").pop() || r.id;

              return {
                value: r.id,
                label: rawLabel.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"),
              };
            },
          );
        } catch {
          return [];
        }
      };

      // ── Draw a form field ──────────────────────────────────────
      const getOptionsForField = async (
        path: string,
        type: InputType,
        pid: string,
        prop: SubtemplateProperty,
      ): Promise<{ value: string; label: string }[]> => {
        if (type === "resource") {
          return fetchOptions(pid, prop.class_id);
        }
        if (type === "select") {
          const o = fieldOverrides[path];

          if (o?.selectOptions && o.selectOptions.length > 0) {
            return o.selectOptions.map((opt) => ({
              value: opt.value,
              label: (opt.label || opt.value).replace(
                /[^\x20-\x7E\xA0-\xFF]/g,
                "?",
              ),
            }));
          }

          return [
            { value: "option1", label: "Option 1" },
            { value: "option2", label: "Option 2" },
            { value: "option3", label: "Option 3" },
            { value: "other", label: "Other" },
          ];
        }
        if (type === "scale") {
          const sc = fieldOverrides[path]?.scaleConfig ?? { min: 1, max: 5 };
          const { min, max, minLabel, maxLabel } = sc;
          const labels: { value: string; label: string }[] = [];

          for (let i = min; i <= max; i++) {
            if (i === min && minLabel) {
              labels.push({ value: String(i), label: minLabel });
            } else if (i === max && maxLabel) {
              labels.push({ value: String(i), label: maxLabel });
            } else {
              labels.push({ value: String(i), label: String(i) });
            }
          }

          return labels;
        }

        return [];
      };

      const drawField = async (
        type: InputType,
        x: number,
        w: number,
        pid: string,
        prop: SubtemplateProperty,
        path: string,
        fieldValue?: FormValue,
      ) => {
        const name = `f_${fc++}`;

        if (type === "checkbox") {
          need(18);
          const cb = form.createCheckBox(name);

          cb.addToPage(page, {
            x,
            y: py(y + 14),
            width: 14,
            height: 14,
            borderColor: fieldBdr,
            borderWidth: 1,
          });
          if (toBool(fieldValue)) {
            cb.check();
          }
          y += 20;
        } else if (
          type === "resource" ||
          type === "select" ||
          type === "scale"
        ) {
          need(26);
          const opts = await getOptionsForField(path, type, pid, prop);

          if (opts.length > 0) {
            const dd = form.createDropdown(name);

            dd.addOptions(opts.map((o) => o.label));
            dd.addToPage(page, {
              x,
              y: py(y + 22),
              width: w,
              height: 22,
              borderColor: fieldBdr,
              borderWidth: 1,
              backgroundColor: fieldFill,
            });
            const valueStr =
              Array.isArray(fieldValue) && fieldValue.length > 0
                ? String(fieldValue[0])
                : typeof fieldValue === "string" ||
                    typeof fieldValue === "number"
                  ? String(fieldValue)
                  : undefined;

            if (valueStr) {
              const match = opts.find((opt) => opt.value === valueStr);

              if (match) {
                dd.select(match.label);
              }
            }
          } else {
            const tf = form.createTextField(name);

            tf.addToPage(page, {
              x,
              y: py(y + 22),
              width: w,
              height: 22,
              borderColor: fieldBdr,
              borderWidth: 1,
              backgroundColor: fieldFill,
            });
            const display = toDisplayString(fieldValue);

            if (display) {
              tf.setText(display);
            }
          }
          y += 28;
        } else {
          const h = type === "textarea" ? 44 : 22;

          need(h + 4);
          const tf = form.createTextField(name);

          if (type === "textarea") tf.enableMultiline();
          tf.addToPage(page, {
            x,
            y: py(y + h),
            width: w,
            height: h,
            borderColor: fieldBdr,
            borderWidth: 1,
            backgroundColor: fieldFill,
          });
          const display = toDisplayString(fieldValue);

          if (display) {
            tf.setText(display);
          }
          y += h + 6;
        }
      };

      // ══════════════════════════════════════════════════════════════
      //  HEADER
      // ══════════════════════════════════════════════════════════════
      // Title
      const titleLines = wrap(label, CW - 8, fontBold, 16);

      for (const ln of titleLines) {
        need(20);
        drawText(ln, M, 16, fontBold, primary);
        y += 20;
      }
      y += 2;

      // Template link
      const tidUrl = `https://orkg.org/templates/${templateId}`;
      const tidLabel = `Template: ${templateId}`;
      const tidW = font.widthOfTextAtSize(tidLabel, 8.5);

      drawText(tidLabel, M, 8.5, font, linkBlue);
      page.drawLine({
        start: { x: M, y: py(y) - 1 },
        end: { x: M + tidW, y: py(y) - 1 },
        thickness: 0.4,
        color: linkBlue,
      });
      pendingLinks.push({
        pageRef: page,
        x: M,
        yTop: y,
        w: tidW,
        h: 10,
        url: tidUrl,
      });
      y += 13;

      drawText(`Exported: ${new Date().toLocaleString()}`, M, 8, font, muted);
      y += 14;

      // Divider
      page.drawLine({
        start: { x: M, y: py(y) },
        end: { x: M + CW, y: py(y) },
        thickness: 0.75,
        color: divider,
      });
      y += 12;

      // ══════════════════════════════════════════════════════════════
      //  PROPERTIES
      // ══════════════════════════════════════════════════════════════
      const renderProperty = async (
        path: string,
        prop: SubtemplateProperty,
        depth: number,
      ) => {
        const effectiveProp = getEffectiveProperty(path, prop);
        const type = getType(path, prop);
        const hasSubs =
          prop.subtemplate_properties &&
          Object.keys(prop.subtemplate_properties).length > 0;
        const indent = depth * 16;
        const x0 = M + indent;
        const fw = CW - indent;

        if (depth === 0) {
          // ── Top-level card ─────────────────────────────────────
          // Pre-compute content height for the card background
          const lblLines = wrap(effectiveProp.label, fw - 48, fontBold, 11);
          const descLines = effectiveProp.description
            ? wrap(effectiveProp.description, fw - 20, fontItalic, 8)
            : [];
          const headerH =
            10 +
            lblLines.length * 14 +
            (descLines.length > 0 ? descLines.length * 11 + 4 : 0) +
            8;

          need(headerH + 30);

          // Card background
          page.drawRectangle({
            x: x0,
            y: py(y + headerH),
            width: fw,
            height: headerH,
            color: primaryBg,
            borderWidth: 0,
          });
          // Left accent bar on card
          page.drawRectangle({
            x: x0,
            y: py(y + headerH),
            width: 3,
            height: headerH,
            color: primary,
          });

          y += 10;

          // Label + property ID link on same line
          for (let i = 0; i < lblLines.length; i++) {
            const lx = x0 + 10;

            drawText(lblLines[i], lx, 11, fontBold, primary);
            if (i === 0) {
              // Property ID link after first label line
              const lblW = fontBold.widthOfTextAtSize(lblLines[0], 11);

              drawPropertyLink(
                path.split(".").pop() ?? path,
                lx + lblW + 8,
                effectiveProp.class_id,
              );
            }
            y += 14;
          }

          // Description
          if (descLines.length > 0) {
            y += 2;
            for (const dl of descLines) {
              drawText(dl, x0 + 10, 8, fontItalic, muted);
              y += 11;
            }
          }
          y += 4;

          // Form field
          const valueForField = getValueForPath(path, prop);

          await drawField(
            type,
            x0 + 10,
            fw - 16,
            path.split(".").pop() ?? path,
            effectiveProp,
            path,
            valueForField,
          );

          // Sub-properties
          if (hasSubs) {
            for (const [sid, sp] of Object.entries(
              prop.subtemplate_properties!,
            )) {
              await renderProperty(`${path}.${sid}`, sp, depth + 1);
            }
          }

          y += 8; // Card bottom spacing
        } else {
          // ── Nested property ────────────────────────────────────
          const lblLines = wrap(effectiveProp.label, fw - 20, fontBold, 9.5);
          const descLines = effectiveProp.description
            ? wrap(effectiveProp.description, fw - 20, fontItalic, 7.5)
            : [];
          const blockH =
            6 +
            lblLines.length * 13 +
            10 +
            (descLines.length > 0 ? descLines.length * 10 + 2 : 0) +
            30;

          need(blockH);

          const blockTopY = y;

          y += 6;

          // Label
          for (let i = 0; i < lblLines.length; i++) {
            drawText(lblLines[i], x0 + 10, 9.5, fontBold, dark);
            if (i === 0) {
              const lblW = fontBold.widthOfTextAtSize(lblLines[0], 9.5);

              drawPropertyLink(
                path.split(".").pop() ?? path,
                x0 + 10 + lblW + 6,
                effectiveProp.class_id,
              );
            }
            y += 13;
          }

          // Cardinality
          if (effectiveProp.cardinality) {
            drawText(effectiveProp.cardinality, x0 + 10, 7, fontItalic, subtle);
            y += 9;
          }

          // Description
          if (descLines.length > 0) {
            for (const dl of descLines) {
              drawText(dl, x0 + 10, 7.5, fontItalic, muted);
              y += 10;
            }
            y += 2;
          }

          // Form field
          const valueForField = getValueForPath(path, prop);

          await drawField(
            type,
            x0 + 10,
            fw - 16,
            path.split(".").pop() ?? path,
            effectiveProp,
            path,
            valueForField,
          );

          // Sub-properties
          if (hasSubs) {
            for (const [sid, sp] of Object.entries(
              prop.subtemplate_properties!,
            )) {
              await renderProperty(`${path}.${sid}`, sp, depth + 1);
            }
          }

          // Left accent border for this block
          const bh = y - blockTopY;

          page.drawRectangle({
            x: x0 + 2,
            y: py(y),
            width: 2,
            height: bh,
            color: accent,
          });

          y += 4;
        }
      };

      const renderCustomBlock = async (block: CustomBlock) => {
        const x0 = M;
        const fw = CW;

        if (block.type === "text") {
          if (block.heading) {
            const lines = wrap(block.heading, fw - 20, fontBold, 11);

            for (const ln of lines) {
              need(14);
              drawText(ln, x0 + 10, 11, fontBold, primary);
              y += 14;
            }
            y += 2;
          }
          if (block.body) {
            const lines = wrap(block.body, fw - 20, fontItalic, 9);

            for (const ln of lines) {
              need(11);
              drawText(ln, x0 + 10, 9, fontItalic, muted);
              y += 11;
            }
          }
          y += 10;
        } else if (block.type === "section") {
          need(20);
          page.drawLine({
            start: { x: x0, y: py(y) },
            end: { x: x0 + fw, y: py(y) },
            thickness: 0.75,
            color: divider,
          });
          y += 8;
          const titleLines = wrap(
            block.title || "Section",
            fw - 20,
            fontBold,
            11,
          );

          for (const ln of titleLines) {
            need(14);
            drawText(ln, x0 + 10, 11, fontBold, primary);
            y += 14;
          }
          page.drawLine({
            start: { x: x0, y: py(y) },
            end: { x: x0 + fw, y: py(y) },
            thickness: 0.5,
            color: divider,
          });
          y += 12;
          const sectionChildIds = block.childIds ?? [];

          for (const cid of sectionChildIds) {
            const child = customBlocks[cid];

            if (child) await renderCustomBlock(child);
          }
        } else if (block.type === "customField") {
          need(40);
          const lblLines = wrap(block.label, fw - 48, fontBold, 11);
          const descLines = block.description
            ? wrap(block.description, fw - 20, fontItalic, 8)
            : [];
          const headerH =
            10 +
            lblLines.length * 14 +
            (descLines.length > 0 ? descLines.length * 11 + 4 : 0) +
            8;

          need(headerH + 30);
          page.drawRectangle({
            x: x0,
            y: py(y + headerH),
            width: fw,
            height: headerH,
            color: primaryBg,
            borderWidth: 0,
          });
          page.drawRectangle({
            x: x0,
            y: py(y + headerH),
            width: 3,
            height: headerH,
            color: primary,
          });
          y += 10;
          for (const ln of lblLines) {
            drawText(ln, x0 + 10, 11, fontBold, primary);
            y += 14;
          }
          if (descLines.length > 0) {
            y += 2;
            for (const dl of descLines) {
              drawText(dl, x0 + 10, 8, fontItalic, muted);
              y += 11;
            }
          }
          y += 4;
          const opts =
            block.type === "customField" &&
            block.inputType === "select" &&
            block.selectOptions
              ? block.selectOptions.map((o) => ({
                  value: o.value,
                  label: (o.label || o.value).replace(
                    /[^\x20-\x7E\xA0-\xFF]/g,
                    "?",
                  ),
                }))
              : block.type === "customField" &&
                  block.inputType === "scale" &&
                  block.scaleConfig
                ? (() => {
                    const sc = block.scaleConfig;
                    const labels: { value: string; label: string }[] = [];

                    for (let i = sc.min; i <= sc.max; i++) {
                      if (i === sc.min && sc.minLabel) {
                        labels.push({ value: String(i), label: sc.minLabel });
                      } else if (i === sc.max && sc.maxLabel) {
                        labels.push({ value: String(i), label: sc.maxLabel });
                      } else {
                        labels.push({ value: String(i), label: String(i) });
                      }
                    }

                    return labels;
                  })()
                : [];
          const customDrawField = async (
            type: InputType,
            x: number,
            w: number,
            fieldValue?: FormValue,
          ) => {
            const name = `f_${fc++}`;

            if (type === "checkbox") {
              need(18);
              const cb = form.createCheckBox(name);

              cb.addToPage(page, {
                x,
                y: py(y + 14),
                width: 14,
                height: 14,
                borderColor: fieldBdr,
                borderWidth: 1,
              });
              if (toBool(fieldValue)) {
                cb.check();
              }
              y += 20;
            } else if (
              (type === "select" || type === "scale") &&
              opts.length > 0
            ) {
              need(26);
              const dd = form.createDropdown(name);

              dd.addOptions(opts.map((o) => o.label));
              dd.addToPage(page, {
                x,
                y: py(y + 22),
                width: w,
                height: 22,
                borderColor: fieldBdr,
                borderWidth: 1,
                backgroundColor: fieldFill,
              });
              const valueStr =
                Array.isArray(fieldValue) && fieldValue.length > 0
                  ? String(fieldValue[0])
                  : typeof fieldValue === "string" ||
                      typeof fieldValue === "number"
                    ? String(fieldValue)
                    : undefined;

              if (valueStr) {
                const match = opts.find((opt) => opt.value === valueStr);

                if (match) {
                  dd.select(match.label);
                }
              }
              y += 28;
            } else {
              const h = type === "textarea" ? 44 : 22;

              need(h + 4);
              const tf = form.createTextField(name);

              if (type === "textarea") tf.enableMultiline();
              tf.addToPage(page, {
                x,
                y: py(y + h),
                width: w,
                height: h,
                borderColor: fieldBdr,
                borderWidth: 1,
                backgroundColor: fieldFill,
              });
              const display = toDisplayString(fieldValue);

              if (display) {
                tf.setText(display);
              }
              y += h + 6;
            }
          };

          const customValue = values[CUSTOM_PREFIX + block.id];

          await customDrawField(block.inputType, x0 + 10, fw - 16, customValue);
          y += 8;
        } else if (block.type === "html" && block.html) {
          const stripped = block.html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (stripped) {
            const lines = wrap(stripped, fw - 20, fontItalic, 9);

            for (const ln of lines) {
              need(11);
              drawText(ln, x0 + 10, 9, fontItalic, muted);
              y += 11;
            }
          }
          y += 10;
        }
      };

      for (const block of orderedBlocks) {
        if (block.kind === "property") {
          const prop = mapping[block.id];

          if (prop) await renderProperty(block.id, prop, 0);
        } else {
          const custom = customBlocks[block.id];

          if (custom) await renderCustomBlock(custom);
        }
      }

      form.updateFieldAppearances(font);

      // ── Add link annotations (deferred to avoid corrupting form widgets) ──
      try {
        const ctx = pdfDoc.context;

        for (const link of pendingLinks) {
          const annotObj = ctx.obj({
            Type: "Annot",
            Subtype: "Link",
            Rect: [
              link.x,
              py(link.yTop + link.h),
              link.x + link.w,
              py(link.yTop - 2),
            ],
            Border: [0, 0, 0],
            A: { Type: "Action", S: "URI", URI: PDFString.of(link.url) },
          });
          const ref = ctx.register(annotObj);
          const annots = link.pageRef.node.get(PDFName.of("Annots"));

          if (annots && "push" in annots) {
            (annots as { push: (a: unknown) => void }).push(ref);
          } else {
            link.pageRef.node.set(PDFName.of("Annots"), ctx.obj([ref]));
          }
        }
      } catch (linkErr) {
        console.warn("PDF link annotations failed (non-blocking):", linkErr);
      }

      // ── Footer ─────────────────────────────────────────────────
      const total = pages.length;

      pages.forEach((p, i) => {
        const ft = `Page ${i + 1} of ${total}`;
        const fw = font.widthOfTextAtSize(ft, 7.5);

        p.drawLine({
          start: { x: M, y: 38 },
          end: { x: W - M, y: 38 },
          thickness: 0.5,
          color: divider,
        });
        p.drawText(ft, {
          x: (W - fw) / 2,
          y: 26,
          size: 7.5,
          font,
          color: muted,
        });
      });

      const bytes = await pdfDoc.save();
      //@ts-ignore
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `questionnaire-${templateId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export error:", err);
      alert(
        `PDF export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [
    templateId,
    label,
    mapping,
    fieldOverrides,
    getEffectiveProperty,
    getInputTypeForPath,
    orderedBlocks,
    customBlocks,
    values,
  ]);

  const AddBlockDropdown = useCallback(
    ({ afterIndex }: { afterIndex: number }) => (
      <Dropdown>
        <DropdownTrigger>
          <Button
            className="border-dashed border-2 border-default-400 font-medium text-default-600 hover:border-primary hover:bg-primary/5 hover:text-primary"
            size="md"
            variant="bordered"
          >
            + Add block
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Add block">
          <DropdownSection title="Insert">
            <DropdownItem
              key="text"
              onPress={() => addBlock("text", afterIndex)}
            >
              Text / instructions
            </DropdownItem>
            <DropdownItem
              key="section"
              onPress={() => addBlock("section", afterIndex)}
            >
              Section header
            </DropdownItem>
            <DropdownItem
              key="field"
              onPress={() => addBlock("customField", afterIndex)}
            >
              Custom field
            </DropdownItem>
            <DropdownItem
              key="html"
              onPress={() => addBlock("html", afterIndex)}
            >
              HTML block
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>
    ),
    [addBlock],
  );

  return (
    <section className="questionnaire-form flex w-full max-w-none flex-col gap-10 py-10 p-10">
      {/* Header card */}
      <div className="rounded-2xl border border-default-200 bg-default-50/50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {label}
            </h1>
            <p className="mt-1.5 text-sm text-default-500">
              Template:{" "}
              <code className="rounded bg-default-200 px-1.5 py-0.5 text-xs">
                {templateId}
              </code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-default-600">
              {editMode ? "Edit mode" : "Fill mode"}
            </span>
            <Switch
              classNames={{ wrapper: "group-data-[selected=true]:bg-primary" }}
              isSelected={editMode}
              size="md"
              onValueChange={setEditMode}
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            as={Link}
            className="font-medium"
            color="primary"
            href={backHref}
            size="sm"
            variant="flat"
          >
            ← Back to templates
          </Button>
          <div className="h-4 w-px bg-default-300" />
          {(canUndo || canRedo) && (
            <div className="flex items-center gap-1">
              {canUndo && (
                <Button
                  className="min-w-0"
                  size="sm"
                  title="Undo last change"
                  variant="flat"
                  onPress={undo}
                >
                  Undo
                </Button>
              )}
              {canRedo && (
                <Button
                  className="min-w-0"
                  size="sm"
                  title="Redo"
                  variant="flat"
                  onPress={redo}
                >
                  Redo
                </Button>
              )}
            </div>
          )}
          <div className="h-4 w-px bg-default-300" />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              accept="application/json"
              className="hidden"
              type="file"
              onChange={handleImportJson}
            />
            <Button
              color="primary"
              size="sm"
              variant="flat"
              onPress={() => fileInputRef.current?.click()}
            >
              Import JSON
            </Button>
            <Button
              color="primary"
              size="sm"
              variant="bordered"
              onPress={handleExportJson}
            >
              Export JSON
            </Button>
            <Button
              color="primary"
              isLoading={isExportingPdf}
              size="sm"
              variant="solid"
              onPress={async () => {
                setIsExportingPdf(true);
                await new Promise((r) => setTimeout(r, 0));
                try {
                  await handleExportPdf();
                } finally {
                  setIsExportingPdf(false);
                }
              }}
            >
              Export PDF
            </Button>
          </div>
          <div className="h-4 w-px bg-default-300" />
          <Button
            id="orkg-submit-btn"
            color="success"
            size="sm"
            variant="flat"
            onPress={() => setShowSubmitModal(true)}
          >
            🚀 Submit to ORKG
          </Button>
        </div>
      </div>

      {/* Blocks */}
      <div className="flex flex-col gap-8">
        {editMode && (
          <div className="flex justify-center rounded-xl border-2 border-dashed border-default-300 bg-default-50/50 py-6">
            <AddBlockDropdown afterIndex={-1} />
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
            {orderedBlocks.map((block, index) => {
              const sortId = getBlockSortId(block);
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
                      value={getValue(
                        block.id,
                        !!mapping[block.id]?.subtemplate_properties?.length,
                      )}
                      values={values}
                      onAddChildToSection={addChildToSection}
                      onAddNestedBlock={addNestedBlock}
                      onFieldOverride={onFieldOverride}
                      onNestedCustomValueChange={(blockId, v) =>
                        setValue(`__custom_${blockId}`, v)
                      }
                      onRemoveChildFromSection={removeChildFromSection}
                      onRemoveNestedBlock={removeNestedBlock}
                      onReorderSectionChildren={reorderSectionChildren}
                      onUpdateCustomBlock={updateCustomBlock}
                      onValueChange={(v) => setValue(block.id, v)}
                    />
                    {editMode && (
                      <div className="flex justify-center">
                        <AddBlockDropdown afterIndex={index} />
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
                            onUpdateChild={(cid, b) =>
                              updateCustomBlock(cid, b)
                            }
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
                          onChange={(v) =>
                            setValue(CUSTOM_PREFIX + block.id, v)
                          }
                          onRemove={() => removeCustomBlock(block.id)}
                          onUpdate={(b) => updateCustomBlock(block.id, b)}
                        />
                      );
                    })()}
                    {editMode && (
                      <div className="flex justify-center">
                        <AddBlockDropdown afterIndex={index} />
                      </div>
                    )}
                  </>
                );

              return (
                <div
                  key={sortId}
                  className="group/block rounded-xl border border-default-100 bg-background p-5 transition-colors hover:border-default-200"
                >
                  {editMode ? (
                    <SortableBlockWrapper id={sortId}>
                      <div className="flex w-full items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">{blockContent}</div>
                        <Button
                          className="opacity-70 hover:opacity-100"
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
                  ) : (
                    blockContent
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* ORKG Sandbox submission modal */}
      <OrkgSubmitModal
        isOpen={showSubmitModal}
        mapping={mapping}
        targetClassId={targetClassId}
        templateId={templateId}
        templateLabel={label}
        values={values}
        onClose={() => setShowSubmitModal(false)}
      />
    </section>
  );
}
