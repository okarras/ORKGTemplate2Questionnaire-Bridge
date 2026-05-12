"use client";

import type { ChangeEvent, RefObject } from "react";

import Link from "next/link";
import { Button } from "@heroui/button";

export function QuestionnaireFormToolbar({
  backHref,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canUndoAnswers,
  canRedoAnswers,
  onUndoAnswers,
  onRedoAnswers,
  fileInputRef,
  onImportFileChange,
  onExportJson,
  isExportingPdf,
  onExportPdf,
  showSubmitButton,
  onOpenSubmitModal,
}: {
  backHref: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Optional: undo/redo for answer values (e.g. when parent tracks history). */
  canUndoAnswers?: boolean;
  canRedoAnswers?: boolean;
  onUndoAnswers?: () => void;
  onRedoAnswers?: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onExportJson: () => void;
  isExportingPdf: boolean;
  onExportPdf: () => void | Promise<void>;
  showSubmitButton: boolean;
  onOpenSubmitModal: () => void;
}) {
  return (
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
                title="Undo layout (blocks, order, removed fields list)"
                variant="flat"
                onPress={onUndo}
              >
                Undo layout
              </Button>
            )}
            {canRedo && (
              <Button
                className="min-w-0"
                size="sm"
                title="Redo layout"
                variant="flat"
                onPress={onRedo}
              >
                Redo layout
              </Button>
            )}
          </div>
        )}
        {(canUndoAnswers || canRedoAnswers) && (
          <div className="flex items-center gap-1">
            {canUndoAnswers && (
              <Button
                className="min-w-0"
                size="sm"
                title="Undo last answer change"
                variant="flat"
                onPress={onUndoAnswers}
              >
                Undo answers
              </Button>
            )}
            {canRedoAnswers && (
              <Button
                className="min-w-0"
                size="sm"
                title="Redo answers"
                variant="flat"
                onPress={onRedoAnswers}
              >
                Redo answers
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
            onChange={onImportFileChange}
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
            onPress={onExportJson}
          >
            Export JSON
          </Button>
          <Button
            color="primary"
            isLoading={isExportingPdf}
            size="sm"
            variant="solid"
            onPress={onExportPdf}
          >
            Export PDF
          </Button>
        </div>
        {showSubmitButton && (
          <>
            <div className="h-4 w-px bg-default-300" />
            <Button
              color="success"
              id="orkg-submit-btn"
              size="sm"
              variant="flat"
              onPress={onOpenSubmitModal}
            >
              🚀 Submit to ORKG
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
