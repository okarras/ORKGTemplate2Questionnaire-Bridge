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
          {!editMode && (
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-default-500">
              With{" "}
              <span className="font-medium text-default-700">Fill mode</span> on
              (switch), use{" "}
              <span className="font-medium text-default-700">
                Save current value as default
              </span>{" "}
              or{" "}
              <span className="font-medium text-default-700">
                choose default from list
              </span>{" "}
              on dropdown fields so preview, PDF, and ORKG submit can use a
              value when you leave an answer empty.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-default-600">
            {editMode ? "Edit mode" : "Fill mode"}
          </span>
          <Switch
            classNames={{ wrapper: "group-data-[selected=true]:bg-primary" }}
            isSelected={!editMode}
            size="md"
            onValueChange={(fillModeOn) => onEditModeChange(!fillModeOn)}
          />
        </div>
      </div>
    </div>
  );
}
