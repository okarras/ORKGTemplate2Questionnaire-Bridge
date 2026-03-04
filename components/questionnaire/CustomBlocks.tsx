"use client";

import type {
  CustomBlock,
  CustomFieldBlockData,
  HtmlBlockData,
  InputType,
  SectionBlockData,
  TextBlockData,
} from "@/types/template";
import type { ScaleConfig, SelectOption } from "./QuestionnaireForm";
import type { DragEndEvent } from "@dnd-kit/core";

import DOMPurify from "dompurify";
import { useState, useCallback } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { DynamicFieldInput } from "./DynamicFieldInput";

type FieldValue = string | number | boolean | string[];

function SortableSectionChild({
  id,
  child,
  block,
  editMode,
  getChildBlocks,
  getChildValue,
  onAddChild,
  onChildValueChange,
  onRemoveChild,
  onReorderChildren,
  onUpdateChild,
  renderChild,
}: {
  id: string;
  child: CustomBlock;
  block: SectionBlockData;
  editMode: boolean;
  getChildBlocks?: (sectionId: string) => CustomBlock[];
  getChildValue?: (childId: string) => string | number | boolean | string[];
  onAddChild?: (
    sectionId: string,
    type: "text" | "section" | "customField" | "html",
  ) => void;
  onChildValueChange?: (
    childId: string,
    value: string | number | boolean | string[],
  ) => void;
  onRemoveChild?: (sectionId: string, childId: string) => void;
  onReorderChildren?: (sectionId: string, newChildIds: string[]) => void;
  onUpdateChild?: (childId: string, data: CustomBlock) => void;
  renderChild: (child: CustomBlock) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "opacity-80" : ""}
      style={style}
    >
      <div className="flex items-start gap-2">
        {editMode && (
          <div
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing touch-none rounded p-1 text-default-400 hover:bg-default-100 hover:text-default-600"
          >
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="14"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">{renderChild(child)}</div>
      </div>
    </div>
  );
}

const INPUT_TYPE_OPTIONS: { value: InputType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text (textarea)" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (select)" },
  { value: "scale", label: "Scale / rating (e.g. 1–5)" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
];

// ── Text block ────────────────────────────────────────────────────
interface TextBlockProps {
  block: TextBlockData;
  onUpdate: (block: TextBlockData) => void;
  onRemove: () => void;
  editMode: boolean;
}

export function TextBlock({
  block,
  onUpdate,
  onRemove,
  editMode,
}: TextBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editHeading, setEditHeading] = useState(block.heading ?? "");
  const [editBody, setEditBody] = useState(block.body ?? "");

  const handleSave = useCallback(() => {
    onUpdate({
      ...block,
      heading: editHeading.trim() || undefined,
      body: editBody.trim() || block.body,
    });
    setIsEditing(false);
  }, [block, editHeading, editBody, onUpdate]);

  if (editMode && isEditing) {
    return (
      <Card className="w-full border-dashed border-2 border-default-300 bg-default-50/50">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-default-600">
              Edit text block
            </span>
            <div className="flex gap-1">
              <Button
                color="primary"
                size="sm"
                variant="flat"
                onPress={handleSave}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  setIsEditing(false);
                  setEditHeading(block.heading ?? "");
                  setEditBody(block.body ?? "");
                }}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                size="sm"
                variant="flat"
                onPress={onRemove}
              >
                Remove
              </Button>
            </div>
          </div>
          <Input
            label="Heading (optional)"
            placeholder="Section heading"
            size="sm"
            value={editHeading}
            onValueChange={setEditHeading}
          />
          <Textarea
            label="Body"
            minRows={3}
            placeholder="Instructional or explanatory text..."
            size="sm"
            value={editBody}
            onValueChange={setEditBody}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="group relative w-full">
      <div className="rounded-xl border border-default-200 bg-default-50/60 px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
        {block.heading && (
          <h3 className="mb-2 text-base font-semibold text-default-800">
            {block.heading}
          </h3>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-default-700">
          {block.body || (
            <span className="italic text-default-400">No content yet</span>
          )}
        </p>
      </div>
      {editMode && (
        <div className="absolute -right-1 -top-1 z-10 flex gap-1 rounded-lg bg-background/95 p-1 shadow-md opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setEditHeading(block.heading ?? "");
              setEditBody(block.body ?? "");
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
          <Button color="danger" size="sm" variant="flat" onPress={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────
interface SectionBlockProps {
  block: SectionBlockData;
  onUpdate: (block: SectionBlockData) => void;
  onRemove: () => void;
  editMode: boolean;
  /** Child blocks (custom blocks inside this section), or use getChildBlocks for nested */
  childBlocks?: CustomBlock[];
  /** For nested sections: (sectionId) => child blocks of that section */
  getChildBlocks?: (sectionId: string) => CustomBlock[];
  /** (sectionId, type) - allows nested sections to add their own children */
  onAddChild?: (
    sectionId: string,
    type: "text" | "section" | "customField" | "html",
  ) => void;
  onRemoveChild?: (sectionId: string, childId: string) => void;
  onUpdateChild?: (childId: string, data: CustomBlock) => void;
  onReorderChildren?: (sectionId: string, newChildIds: string[]) => void;
  getChildValue?: (childId: string) => string | number | boolean | string[];
  onChildValueChange?: (
    childId: string,
    value: string | number | boolean | string[],
  ) => void;
}

export function SectionBlock({
  block,
  onUpdate,
  onRemove,
  editMode,
  childBlocks = [],
  getChildBlocks,
  onAddChild,
  onRemoveChild,
  onUpdateChild,
  onReorderChildren,
  getChildValue,
  onChildValueChange,
}: SectionBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(block.title ?? "");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleSave = useCallback(() => {
    onUpdate({ ...block, title: editTitle.trim() || block.title });
    setIsEditing(false);
  }, [block, editTitle, onUpdate]);

  if (editMode && isEditing) {
    return (
      <Card className="w-full border-dashed border-2 border-default-300 bg-default-50/50">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-default-600">
              Edit section header
            </span>
            <div className="flex gap-1">
              <Button
                color="primary"
                size="sm"
                variant="flat"
                onPress={handleSave}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  setIsEditing(false);
                  setEditTitle(block.title ?? "");
                }}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                size="sm"
                variant="flat"
                onPress={onRemove}
              >
                Remove
              </Button>
            </div>
          </div>
          <Input
            label="Section title"
            placeholder="Section title"
            size="sm"
            value={editTitle}
            onValueChange={setEditTitle}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="group relative w-full">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
        <h3 className="text-base font-semibold text-primary">
          {block.title || "Untitled section"}
        </h3>
      </div>
      {(() => {
        const children = getChildBlocks
          ? getChildBlocks(block.id)
          : childBlocks;

        if (children.length === 0) return null;

        const childIds = children.map((c) => c.id);

        const renderChild = (child: CustomBlock) => {
          if (child.type === "text") {
            return (
              <TextBlock
                key={child.id}
                block={child}
                editMode={editMode}
                onRemove={() => onRemoveChild?.(block.id, child.id)}
                onUpdate={(b) => onUpdateChild?.(child.id, b)}
              />
            );
          }
          if (child.type === "section") {
            return (
              <SectionBlock
                key={child.id}
                block={child}
                editMode={editMode}
                getChildBlocks={getChildBlocks}
                getChildValue={getChildValue}
                onAddChild={onAddChild}
                onChildValueChange={onChildValueChange}
                onRemove={() => onRemoveChild?.(block.id, child.id)}
                onRemoveChild={onRemoveChild}
                onReorderChildren={onReorderChildren}
                onUpdate={(b) => onUpdateChild?.(child.id, b)}
                onUpdateChild={onUpdateChild}
              />
            );
          }
          if (child.type === "html") {
            return (
              <HtmlBlock
                key={child.id}
                block={child}
                editMode={editMode}
                onRemove={() => onRemoveChild?.(block.id, child.id)}
                onUpdate={(b) => onUpdateChild?.(child.id, b)}
              />
            );
          }
          if (child.type === "customField") {
            return (
              <CustomFieldBlock
                key={child.id}
                block={child}
                editMode={editMode}
                value={(getChildValue?.(child.id) as FieldValue) ?? ""}
                onChange={(v) => onChildValueChange?.(child.id, v)}
                onRemove={() => onRemoveChild?.(block.id, child.id)}
                onUpdate={(b) => onUpdateChild?.(child.id, b)}
              />
            );
          }

          return null;
        };

        const handleChildDragEnd = (event: DragEndEvent) => {
          const { active, over } = event;

          if (over == null || active.id === over.id) return;

          const oldIdx = childIds.indexOf(String(active.id));
          const newIdx = childIds.indexOf(String(over.id));

          if (oldIdx === -1 || newIdx === -1) return;

          onReorderChildren?.(block.id, arrayMove(childIds, oldIdx, newIdx));
        };

        const listContent =
          editMode && onReorderChildren ? (
            <DndContext
              collisionDetection={closestCenter}
              sensors={sensors}
              onDragEnd={handleChildDragEnd}
            >
              <SortableContext
                items={childIds}
                strategy={verticalListSortingStrategy}
              >
                {children.map((child) => (
                  <SortableSectionChild
                    key={child.id}
                    block={block}
                    child={child}
                    editMode={editMode}
                    getChildBlocks={getChildBlocks}
                    getChildValue={getChildValue}
                    id={child.id}
                    renderChild={renderChild}
                    onAddChild={onAddChild}
                    onChildValueChange={onChildValueChange}
                    onRemoveChild={onRemoveChild}
                    onReorderChildren={onReorderChildren}
                    onUpdateChild={onUpdateChild}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            children.map((child) => (
              <div key={child.id}>{renderChild(child)}</div>
            ))
          );

        return (
          <div className="mt-4 space-y-4 rounded-lg border border-primary/15 bg-background/50 px-5 py-4">
            {listContent}
          </div>
        );
      })()}
      {editMode && onAddChild && (
        <Dropdown>
          <DropdownTrigger>
            <Button
              className="mt-3 border-2 border-dashed border-default-300 font-medium text-default-600 hover:border-primary hover:bg-primary/5 hover:text-primary"
              size="sm"
              variant="flat"
            >
              + Add field to section
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Add to section">
            <DropdownItem
              key="text"
              onPress={() => onAddChild(block.id, "text")}
            >
              Text
            </DropdownItem>
            <DropdownItem
              key="section"
              onPress={() => onAddChild(block.id, "section")}
            >
              Subsection
            </DropdownItem>
            <DropdownItem
              key="field"
              onPress={() => onAddChild(block.id, "customField")}
            >
              Field
            </DropdownItem>
            <DropdownItem
              key="html"
              onPress={() => onAddChild(block.id, "html")}
            >
              HTML
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      )}
      {editMode && (
        <div className="absolute -right-1 -top-1 z-10 flex gap-1 rounded-lg bg-background/95 p-1 shadow-md opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setEditTitle(block.title ?? "");
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
          <Button color="danger" size="sm" variant="flat" onPress={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

// ── HTML block ─────────────────────────────────────────────────────
interface HtmlBlockProps {
  block: HtmlBlockData;
  onUpdate: (block: HtmlBlockData) => void;
  onRemove: () => void;
  editMode: boolean;
}

export function HtmlBlock({
  block,
  onUpdate,
  onRemove,
  editMode,
}: HtmlBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editHtml, setEditHtml] = useState(block.html ?? "");

  const handleSave = useCallback(() => {
    onUpdate({ ...block, html: editHtml });
    setIsEditing(false);
  }, [block, editHtml, onUpdate]);

  const sanitizedHtml = block.html
    ? DOMPurify.sanitize(block.html, {
        ALLOWED_TAGS: [
          "a",
          "b",
          "strong",
          "i",
          "em",
          "u",
          "s",
          "br",
          "p",
          "div",
          "span",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "blockquote",
          "code",
          "pre",
          "img",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
        ],
        ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class"],
      })
    : "";

  if (editMode && isEditing) {
    return (
      <Card className="w-full border-dashed border-2 border-default-300 bg-default-50/50">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-default-600">
              Edit HTML block
            </span>
            <div className="flex gap-1">
              <Button
                color="primary"
                size="sm"
                variant="flat"
                onPress={handleSave}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  setIsEditing(false);
                  setEditHtml(block.html ?? "");
                }}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                size="sm"
                variant="flat"
                onPress={onRemove}
              >
                Remove
              </Button>
            </div>
          </div>
          <Textarea
            classNames={{
              input: "font-mono text-sm",
            }}
            label="HTML"
            minRows={6}
            placeholder="<p>Your HTML content here...</p>"
            size="sm"
            value={editHtml}
            onValueChange={setEditHtml}
          />
          <p className="text-xs text-default-500">
            Supports: headings, links, lists, bold, italic, images, tables.
            Scripts and unsafe tags are stripped for security.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="group relative w-full">
      <div
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        className="[&_a]:text-primary [&_a]:underline [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 rounded-xl border border-default-200 bg-default-50/60 px-5 py-4 text-sm leading-relaxed text-default-700 shadow-sm [&_p]:mb-2 [&_p:last-child]:mb-0"
      />
      {editMode && (
        <div className="absolute -right-1 -top-1 z-10 flex gap-1 rounded-lg bg-background/95 p-1 shadow-md opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setEditHtml(block.html ?? "");
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
          <Button color="danger" size="sm" variant="flat" onPress={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Custom field block ────────────────────────────────────────────
interface CustomFieldBlockProps {
  block: CustomFieldBlockData;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onUpdate: (block: CustomFieldBlockData) => void;
  onRemove: () => void;
  editMode: boolean;
}

export function CustomFieldBlock({
  block,
  value,
  onChange,
  onUpdate,
  onRemove,
  editMode,
}: CustomFieldBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(block.label ?? "");
  const [editDescription, setEditDescription] = useState(
    block.description ?? "",
  );
  const [editInputType, setEditInputType] = useState<InputType>(
    block.inputType,
  );
  const [editSelectOptions, setEditSelectOptions] = useState<SelectOption[]>(
    block.selectOptions ?? [
      { value: "opt1", label: "Option 1" },
      { value: "other", label: "Other" },
    ],
  );
  const [editScaleConfig, setEditScaleConfig] = useState<ScaleConfig>(
    block.scaleConfig ?? { min: 1, max: 5 },
  );

  const handleSave = useCallback(() => {
    onUpdate({
      ...block,
      label: editLabel.trim() || block.label,
      description: editDescription.trim() || undefined,
      inputType: editInputType,
      selectOptions:
        editInputType === "select" && editSelectOptions.length > 0
          ? editSelectOptions
          : undefined,
      scaleConfig: editInputType === "scale" ? editScaleConfig : undefined,
    });
    setIsEditing(false);
  }, [
    block,
    editLabel,
    editDescription,
    editInputType,
    editSelectOptions,
    editScaleConfig,
    onUpdate,
  ]);

  if (editMode && isEditing) {
    return (
      <Card className="w-full border-dashed border-2 border-default-300 bg-default-50/50">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-default-600">
              Edit custom field
            </span>
            <div className="flex gap-1">
              <Button
                color="primary"
                size="sm"
                variant="flat"
                onPress={handleSave}
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
              <Button
                color="danger"
                size="sm"
                variant="flat"
                onPress={onRemove}
              >
                Remove
              </Button>
            </div>
          </div>
          <Input
            label="Label"
            placeholder="Field label"
            size="sm"
            value={editLabel}
            onValueChange={setEditLabel}
          />
          <Textarea
            label="Description (optional)"
            minRows={2}
            placeholder="Help text"
            size="sm"
            value={editDescription}
            onValueChange={setEditDescription}
          />
          <Select
            label="Field type"
            selectedKeys={new Set([editInputType])}
            size="sm"
            onSelectionChange={(keys) => {
              const k = (keys as Set<string>).values().next().value;

              if (k) setEditInputType(k as InputType);
            }}
          >
            {INPUT_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
          {editInputType === "select" && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-default-600">
                Options
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
          {editInputType === "scale" && (
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
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="group relative w-full">
      <DynamicFieldInput
        cardinality="one to one"
        inputType={block.inputType}
        label={block.label}
        placeholder={block.description}
        propertyId={block.id}
        scaleConfig={block.scaleConfig}
        selectOptions={block.selectOptions}
        value={value}
        onChange={onChange}
      />
      {editMode && (
        <div className="absolute -right-1 -top-1 z-10 flex gap-1 rounded-lg bg-background/95 p-1 shadow-md opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setEditLabel(block.label ?? "");
              setEditDescription(block.description ?? "");
              setEditInputType(block.inputType);
              setEditSelectOptions(
                block.selectOptions ?? [
                  { value: "opt1", label: "Option 1" },
                  { value: "other", label: "Other" },
                ],
              );
              setEditScaleConfig(block.scaleConfig ?? { min: 1, max: 5 });
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
          <Button color="danger" size="sm" variant="flat" onPress={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
