"use client";

import { Tabs, Tab } from "@heroui/tabs";

export function QuestionnaireFormHeader({
  label,
  templateId,
  editMode,
  onEditModeChange,
}: {
  label: string;
  templateId: string;
  editMode: boolean;
  onEditModeChange: (next: boolean) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-default-200 bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6 shadow-sm">
      {/* Decorative gradient circle */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/8 blur-2xl"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-2xl" role="img" aria-label="questionnaire">
              📋
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {label}
            </h1>
          </div>
          <p className="text-sm text-default-500">
            Template:{" "}
            <code className="rounded-md bg-default-200/60 px-1.5 py-0.5 text-xs font-mono">
              {templateId}
            </code>
          </p>
          {!editMode && (
            <p className="mt-2.5 max-w-xl text-xs leading-relaxed text-default-400">
              <span className="font-semibold text-default-600">Fill mode</span>{" "}
              is active — answer the questions below. Use{" "}
              <span className="font-medium text-default-600">
                Save current value as default
              </span>{" "}
              on any field so preview, PDF, and ORKG submit use a value when you
              leave an answer empty.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <Tabs
              aria-label="Mode selection"
              color="primary"
              radius="full"
              selectedKey={editMode ? "edit" : "fill"}
              size="md"
              onSelectionChange={(key) => onEditModeChange(key === "edit")}
            >
              <Tab key="fill" title="Fill mode" />
              <Tab key="edit" title="Edit mode" />
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
