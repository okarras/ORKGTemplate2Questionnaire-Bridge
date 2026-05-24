"use client";

import {
  KeyboardSensor,
  PointerSensor,
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

export { arrayMove, SortableContext, verticalListSortingStrategy };

/** Get stable sortable id for a block */
export function getBlockSortId(block: { kind: string; id: string }) {
  return block.kind === "property" ? `prop-${block.id}` : block.id;
}

export function useSortableBlock(id: string) {
  return useSortable({ id });
}

/** Grip icon for drag handles */
function GripIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="5.5" cy="3.5" r="1.25" />
      <circle cx="5.5" cy="8" r="1.25" />
      <circle cx="5.5" cy="12.5" r="1.25" />
      <circle cx="10.5" cy="3.5" r="1.25" />
      <circle cx="10.5" cy="8" r="1.25" />
      <circle cx="10.5" cy="12.5" r="1.25" />
    </svg>
  );
}

/** Wrapper that makes its child sortable with a drag handle */
export function SortableBlockWrapper({
  id,
  children,
  /** When true, block stays in the sortable list but cannot be dragged (e.g. fill mode). */
  disabled = false,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "z-50 opacity-80 scale-[1.01]" : ""}
      style={{
        ...style,
        ...(isDragging
          ? { boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }
          : {}),
      }}
    >
      <div className="flex items-start gap-2">
        <div
          {...(disabled ? {} : attributes)}
          {...(disabled ? {} : listeners)}
          aria-hidden={disabled}
          className={
            disabled
              ? "mt-2 shrink-0 touch-none rounded-lg p-1.5 opacity-0 pointer-events-none"
              : "q-drag-handle mt-2"
          }
          title={disabled ? undefined : "Drag to reorder"}
        >
          <GripIcon />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function useBlockDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}
