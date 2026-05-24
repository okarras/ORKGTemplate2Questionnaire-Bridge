"use client";

import type { ChangeEvent, RefObject } from "react";

import Link from "next/link";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";

/** Small SVG icon components for toolbar buttons */
function ArrowLeftIcon() {
  return (
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
function UndoIcon() {
  return (
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
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}
function RedoIcon() {
  return (
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
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  );
}
function UploadIcon() {
  return (
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}
function DownloadIcon() {
  return (
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
function FileIcon() {
  return (
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

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
  const hasHistoryControls = canUndo || canRedo;
  const hasAnswerHistory = canUndoAnswers || canRedoAnswers;

  return (
    <div className="q-toolbar">
      <div className="flex flex-wrap items-center gap-1">
        {/* Navigation group */}
        <div className="q-toolbar-group">
          <Tooltip content="Back to templates" delay={300}>
            <Button
              as={Link}
              href={backHref}
              isIconOnly
              size="sm"
              variant="flat"
            >
              <ArrowLeftIcon />
            </Button>
          </Tooltip>
        </div>

        {/* History group */}
        {(hasHistoryControls || hasAnswerHistory) && (
          <>
            <div className="q-toolbar-divider" />
            <div className="q-toolbar-group">
              {canUndo && (
                <Tooltip content="Undo layout" delay={300}>
                  <Button isIconOnly size="sm" variant="flat" onPress={onUndo}>
                    <UndoIcon />
                  </Button>
                </Tooltip>
              )}
              {canRedo && (
                <Tooltip content="Redo layout" delay={300}>
                  <Button isIconOnly size="sm" variant="flat" onPress={onRedo}>
                    <RedoIcon />
                  </Button>
                </Tooltip>
              )}
              {canUndoAnswers && (
                <Tooltip content="Undo answers" delay={300}>
                  <Button
                    isIconOnly
                    color="secondary"
                    size="sm"
                    variant="flat"
                    onPress={onUndoAnswers}
                  >
                    <UndoIcon />
                  </Button>
                </Tooltip>
              )}
              {canRedoAnswers && (
                <Tooltip content="Redo answers" delay={300}>
                  <Button
                    isIconOnly
                    color="secondary"
                    size="sm"
                    variant="flat"
                    onPress={onRedoAnswers}
                  >
                    <RedoIcon />
                  </Button>
                </Tooltip>
              )}
            </div>
          </>
        )}

        {/* Import/Export group */}
        <div className="q-toolbar-divider" />
        <div className="q-toolbar-group">
          <input
            ref={fileInputRef}
            accept="application/json"
            className="hidden"
            type="file"
            onChange={onImportFileChange}
          />
          <Tooltip content="Import JSON" delay={300}>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              onPress={() => fileInputRef.current?.click()}
            >
              <UploadIcon />
            </Button>
          </Tooltip>
          <Tooltip content="Export JSON" delay={300}>
            <Button
              isIconOnly
              size="sm"
              variant="bordered"
              onPress={onExportJson}
            >
              <DownloadIcon />
            </Button>
          </Tooltip>
          <Tooltip content="Export PDF" delay={300}>
            <Button
              color="primary"
              isIconOnly
              isLoading={isExportingPdf}
              size="sm"
              variant="solid"
              onPress={onExportPdf}
            >
              <FileIcon />
            </Button>
          </Tooltip>
        </div>

        {/* Submit group */}
        {showSubmitButton && (
          <>
            <div className="q-toolbar-divider" />
            <div className="q-toolbar-group">
              <Button
                color="success"
                id="orkg-submit-btn"
                size="sm"
                startContent={<span>🚀</span>}
                variant="flat"
                onPress={onOpenSubmitModal}
              >
                Submit to ORKG
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
