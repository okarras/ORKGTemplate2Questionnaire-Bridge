"use client";

import { Switch } from "@heroui/switch";

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
            onValueChange={onEditModeChange}
          />
        </div>
      </div>
    </div>
  );
}
