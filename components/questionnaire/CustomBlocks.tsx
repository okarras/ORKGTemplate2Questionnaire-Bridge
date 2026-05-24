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

import { CustomFieldEditDialog } from "./CustomFieldEditDialog";
import { DynamicFieldInput } from "./DynamicFieldInput";
import { FieldEditButton } from "./FieldEditButton";

type FieldValue = string | number | boolean | string[];

function SortableSectionChild({
  id,
  child,
  block: _block,
  editMode,
  getChildBlocks: _getChildBlocks,
  getChildValue: _getChildValue,
  onAddChild: _onAddChild,
  onChildValueChange: _onChildValueChange,
  onRemoveChild: _onRemoveChild,
  onReorderChildren: _onReorderChildren,
  onUpdateChild: _onUpdateChild,
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
          <div {...attributes} {...listeners} className="q-drag-handle mt-1">
            <svg
              aria-hidden
              fill="currentColor"
              height="14"
              viewBox="0 0 16 16"
              width="14"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="5.5" cy="3.5" r="1.25" />
              <circle cx="5.5" cy="8" r="1.25" />
              <circle cx="5.5" cy="12.5" r="1.25" />
              <circle cx="10.5" cy="3.5" r="1.25" />
              <circle cx="10.5" cy="8" r="1.25" />
              <circle cx="10.5" cy="12.5" r="1.25" />
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

/** Inline action bar for blocks — appears on hover */
function BlockActionBar({
  editMode,
  onEdit,
  onRemove,
}: {
  editMode: boolean;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      {editMode && onEdit && (
        <Button
          isIconOnly
          size="sm"
          title="Edit"
          variant="light"
          onPress={onEdit}
        >
          <svg
            aria-hidden
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </Button>
      )}
      <Button
        isIconOnly
        color="danger"
        size="sm"
        title="Remove"
        variant="light"
        onPress={onRemove}
      >
        <svg
          aria-hidden
          fill="none"
          height="14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
          width="14"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}

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
      <Card className="w-full border-2 border-dashed border-default-300 bg-default-50/50 shadow-none">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-default-700">
              Edit text block
            </span>
            <div className="flex gap-1.5">
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
      <div
        className="rounded-xl border border-default-200 bg-default-50/60 px-5 py-4 transition-all hover:shadow-sm"
        style={{ borderLeft: "3px solid var(--q-accent-text)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {block.heading && (
              <h3 className="mb-2 text-base font-semibold text-default-800">
                {block.heading}
              </h3>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-default-600">
              {block.body || (
                <span className="italic text-default-400">No content yet</span>
              )}
            </p>
          </div>
          <BlockActionBar
            editMode={editMode}
            onEdit={() => {
              setEditHeading(block.heading ?? "");
              setEditBody(block.body ?? "");
              setIsEditing(true);
            }}
            onRemove={onRemove}
          />
        </div>
      </div>
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
      <Card className="w-full border-2 border-dashed border-default-300 bg-default-50/50 shadow-none">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-default-700">
              Edit section header
            </span>
            <div className="flex gap-1.5">
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
      <div className="q-section-header">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-default-800">
            {block.title || "Untitled section"}
          </h3>
          <BlockActionBar
            editMode={editMode}
            onEdit={() => {
              setEditTitle(block.title ?? "");
              setIsEditing(true);
            }}
            onRemove={onRemove}
          />
        </div>
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
          <div className="mt-3 space-y-3 rounded-lg border border-default-100 bg-background/50 p-4">
            {listContent}
          </div>
        );
      })()}
      {editMode && onAddChild && (
        <div className="mt-3">
          <Dropdown>
            <DropdownTrigger>
              <Button
                className="border-2 border-dashed border-default-300 font-medium text-default-500 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                size="sm"
                variant="flat"
              >
                + Add to section
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
      <Card className="w-full border-2 border-dashed border-default-300 bg-default-50/50 shadow-none">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-default-700">
              Edit HTML block
            </span>
            <div className="flex gap-1.5">
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
          <p className="text-xs text-default-400">
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
        className="rounded-xl border border-default-200 bg-default-50/60 px-5 py-4 transition-all hover:shadow-sm"
        style={{ borderLeft: "3px solid var(--q-accent-html)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            className="min-w-0 flex-1 [&_a]:text-primary [&_a]:underline [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 text-sm leading-relaxed text-default-700 [&_p]:mb-2 [&_p:last-child]:mb-0"
          />
          <BlockActionBar
            editMode={editMode}
            onEdit={() => {
              setEditHtml(block.html ?? "");
              setIsEditing(true);
            }}
            onRemove={onRemove}
          />
        </div>
      </div>
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  return (
    <div className="group relative min-w-0 w-full">
      <DynamicFieldInput
        editMode={editMode}
        cardinality="one to one"
        description={block.description}
        inputType={block.inputType}
        label={block.label}
        propertyId={block.id}
        scaleConfig={block.scaleConfig}
        selectOptions={block.selectOptions}
        trailingSlot={
          editMode ? (
            <FieldEditButton
              customized={Boolean(
                block.description ||
                  block.emptyDefault ||
                  block.selectOptions ||
                  block.scaleConfig,
              )}
              fieldLabel={block.label}
              onPress={() => setIsEditDialogOpen(true)}
            />
          ) : undefined
        }
        value={value}
        onChange={onChange}
      />
      {editMode ? (
        <div className="mt-2 flex justify-end">
          <BlockActionBar editMode={editMode} onRemove={onRemove} />
        </div>
      ) : null}
      <CustomFieldEditDialog
        block={block}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={onUpdate}
      />
    </div>
  );
}
