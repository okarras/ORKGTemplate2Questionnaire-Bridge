"use client";

import type { InputType } from "@/types/template";
import type { ScaleConfig, SelectOption } from "./QuestionnaireForm";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { RadioGroup, Radio } from "@heroui/radio";
import { Button } from "@heroui/button";

import { ResourceAutoselect } from "./ResourceAutoselect";
import { FieldLabel } from "./FieldLabel";
import { normalizeCheckboxFormValue } from "./questionnaire-form-value-helpers";

type FieldValue = string | number | boolean | string[];

interface DynamicFieldInputProps {
  propertyId: string;
  label: string;
  inputType: InputType;
  /** Description text shown above the input field */
  description?: string;
  placeholder?: string;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** Cardinality from template: "one to one" = single select, "one to many" = multiselect */
  cardinality?: string;
  /** class_id for IRI/resource fields - fetches options of this ORKG class */
  classId?: string;
  /** Link to create new ORKG resource (e.g. https://orkg.org/resources/create?classes={class_id}) */
  createLink?: string;
  /** Custom options for select/dropdown (PDF-style domain-specific options) */
  selectOptions?: SelectOption[];
  /** Config for scale/rating fields (Likert-style) */
  scaleConfig?: ScaleConfig;
  /**
   * When true, the visible FieldLabel is omitted (e.g. label already shown on an accordion trigger).
   * Controls keep an accessible name via aria-label / sr-only text.
   */
  hideLabel?: boolean;
  /** When set with `onResourceOptionsSnapshot`, identifies this field for the host (e.g. full property path). */
  resourceOptionsScope?: string;
  /**
   * ORKG resource list snapshot for AI / prompts. Second argument is `resourceOptionsScope ?? propertyId`.
   */
  onResourceOptionsSnapshot?: (
    options: SelectOption[],
    scopeKey: string,
  ) => void;
  /** Shown only in fill mode (`editMode` false): save/clear default when answer is left empty. */
  fillModeDefaultControls?: {
    emptyDefault?: string;
    emptyDefaultSummary: string;
    onSaveFromCurrent: () => void;
    onClear: () => void;
    /** Clear the current answer (not the saved default). */
    onClearAnswer?: () => void;
    /** Single-select only: options to pick a stored default without typing the answer first. */
    pickDefaultFromSelectOptions?: SelectOption[];
    onPickDefaultOption?: (value: string) => void;
  };
  /** Whether the form is in edit mode */
  editMode?: boolean;
  /** Shown beside the control (e.g. field customize button in edit mode). */
  trailingSlot?: ReactNode;
}

/** Fills the `.q-field-control` column (80% of section width via CSS variable). */
const fieldInputClass = "w-full min-w-0";
const inputWrapperClass =
  "min-w-0 w-full rounded-lg border border-default-300 bg-content1 shadow-sm data-[hover=true]:border-default-400 data-[focus=true]:border-primary data-[focus=true]:ring-2 data-[focus=true]:ring-primary/20 transition-[border-color,box-shadow]";
const selectTriggerClassNames = {
  base: "w-full min-w-0",
  mainWrapper: "w-full min-w-0",
  trigger: inputWrapperClass,
  innerWrapper: "min-w-0 w-full",
  value: "min-w-0 truncate",
  selectorIcon: "shrink-0",
};
const textInputClassNames = {
  base: "w-full min-w-0",
  mainWrapper: "w-full min-w-0",
  inputWrapper: inputWrapperClass,
  innerWrapper: "w-full min-w-0",
  input: "min-w-0 w-full",
};
const booleanSwitchClassNames = {
  base: "q-boolean-switch m-0 min-w-0 w-full",
  wrapper:
    "group-data-[selected=true]:bg-primary border-default-300 group-data-[selected=true]:border-primary",
  thumb: "bg-white shadow-sm",
  label: "text-sm font-medium text-default-700",
};

const DEFAULT_SELECT_OPTIONS: SelectOption[] = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
  { value: "option3", label: "Option 3" },
  { value: "other", label: "Other" },
];

const isOneToMany = (cardinality?: string) =>
  cardinality?.toLowerCase() === "one to many";

/** Renders description text above a field (skipped when it duplicates the label/title). */
function FieldDescription({ text, label }: { text?: string; label: string }) {
  const trimmed = text?.trim();

  if (!trimmed) return null;
  if (trimmed.toLowerCase() === label.trim().toLowerCase()) return null;

  return <p className="q-field-description">{trimmed}</p>;
}

function FieldLabelRow({
  hideLabel,
  label,
  classId,
  propertyId,
}: {
  hideLabel: boolean;
  label: string;
  classId?: string;
  propertyId: string;
}) {
  if (hideLabel) {
    return <span className="sr-only">{label}</span>;
  }

  return <FieldLabel classId={classId} label={label} propertyId={propertyId} />;
}

function FieldControlRow({
  trailing,
  children,
}: {
  trailing?: ReactNode;
  children: ReactNode;
}) {
  if (!trailing) {
    return <div className="q-field-control min-w-0">{children}</div>;
  }

  return (
    <div className="q-field-control-row">
      <div className="q-field-control min-w-0">{children}</div>
      <div className="q-field-edit-action">{trailing}</div>
    </div>
  );
}

/** Local draft + debounced commit so typing does not re-render the whole questionnaire on each key. */
const DebouncedTextField = memo(function DebouncedTextField({
  id,
  label,
  ariaLabel,
  placeholder,
  value,
  onChange,
  multiline = false,
  type = "text",
  classNames,
}: {
  id: string;
  label?: ReactNode;
  ariaLabel?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  classNames: typeof textInputClassNames;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(
    (next: string) => {
      if (next !== value) onChange(next);
    },
    [onChange, value],
  );

  useEffect(() => {
    if (draft === value) return;
    const t = window.setTimeout(() => commit(draft), 200);

    return () => window.clearTimeout(t);
  }, [draft, value, commit]);

  const shared = {
    id,
    "aria-label": ariaLabel,
    className: fieldInputClass,
    classNames,
    label,
    labelPlacement: "outside" as const,
    placeholder,
    value: draft,
    variant: "bordered" as const,
    onValueChange: setDraft,
    onBlur: () => commit(draft),
  };

  if (multiline) {
    return <Textarea {...shared} minRows={3} />;
  }

  return <Input {...shared} type={type} />;
});

function FillModeDefaultFooter({
  controls,
  disableSave,
  defaultPickerOpen,
  setDefaultPickerOpen,
  editMode,
}: {
  controls?: DynamicFieldInputProps["fillModeDefaultControls"];
  disableSave?: boolean;
  defaultPickerOpen?: boolean;
  setDefaultPickerOpen?: (open: boolean) => void;
  editMode?: boolean;
}) {
  if (!controls || !editMode) return null;

  const pickOpts = controls.pickDefaultFromSelectOptions;
  const showPicker =
    pickOpts &&
    pickOpts.length > 0 &&
    controls.onPickDefaultOption &&
    setDefaultPickerOpen;

  return (
    <div className="mt-3 rounded-lg border border-default-100 bg-default-50/50 p-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-default-400">
        Fill mode — default if left empty
      </p>
      <p className="mb-2 text-[11px] leading-snug text-default-400">
        When you leave this field empty, the saved default is used for preview,
        PDF export, and ORKG submit.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-default-600">
        {controls.onClearAnswer ? (
          <Button size="sm" variant="light" onPress={controls.onClearAnswer}>
            Clear answer
          </Button>
        ) : null}
        {controls.emptyDefault ? (
          <>
            <span>
              Saved default:{" "}
              <span className="font-medium text-default-800">
                {controls.emptyDefaultSummary}
              </span>
            </span>
            <Button size="sm" variant="light" onPress={controls.onClear}>
              Clear default
            </Button>
          </>
        ) : null}
        <Button
          isDisabled={disableSave}
          size="sm"
          variant="flat"
          onPress={controls.onSaveFromCurrent}
        >
          {controls.emptyDefault
            ? "Update default from current value"
            : "Save current value as default"}
        </Button>
      </div>
      {showPicker ? (
        <div className="mt-2">
          <Select
            aria-label="Choose default value when field is empty"
            className="max-w-md"
            classNames={{ trigger: inputWrapperClass }}
            isOpen={defaultPickerOpen}
            label="Or choose default from list"
            labelPlacement="outside"
            placeholder="Pick an option as default…"
            selectedKeys={
              controls.emptyDefault
                ? new Set([controls.emptyDefault])
                : new Set()
            }
            size="sm"
            onOpenChange={setDefaultPickerOpen}
            onSelectionChange={(keys) => {
              if (keys === "all") return;
              const k = keys instanceof Set ? Array.from(keys)[0] : undefined;

              if (k != null) {
                controls.onPickDefaultOption?.(String(k));
                setDefaultPickerOpen?.(false);
              }
            }}
          >
            {pickOpts.map((opt) => (
              <SelectItem key={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}

export function DynamicFieldInput({
  propertyId,
  label,
  inputType,
  description,
  placeholder,
  value,
  onChange,
  cardinality,
  classId,
  createLink: _createLink,
  selectOptions = DEFAULT_SELECT_OPTIONS,
  scaleConfig = { min: 1, max: 5 },
  hideLabel = false,
  resourceOptionsScope,
  onResourceOptionsSnapshot,
  fillModeDefaultControls,
  editMode,
  trailingSlot,
}: DynamicFieldInputProps) {
  const id = `field-${propertyId}`;
  const fieldLabel =
    typeof label === "string" && label.trim().length > 0
      ? label
      : propertyId || "field";
  const multiselect = isOneToMany(cardinality);
  const [selectOpen, setSelectOpen] = useState(false);
  const [defaultPickerOpen, setDefaultPickerOpen] = useState(false);
  const dedupedSelectOptions = useMemo(() => {
    const raw = selectOptions ?? DEFAULT_SELECT_OPTIONS;
    const seen = new Set<string>();
    const out: SelectOption[] = [];

    for (const o of raw) {
      const k = String(o.value);

      if (seen.has(k)) continue;
      seen.add(k);
      out.push(o);
    }

    return out;
  }, [selectOptions]);
  const useExternalLabel = Boolean(trailingSlot);
  const visibleLabel = hideLabel ? (
    <span className="sr-only">{fieldLabel}</span>
  ) : (
    <FieldLabel classId={classId} label={fieldLabel} propertyId={propertyId} />
  );

  /** Generic hint placeholder — never the description */
  const hintPlaceholder =
    placeholder ??
    (() => {
      switch (inputType) {
        case "text":
          return `Enter ${fieldLabel.toLowerCase()}…`;
        case "textarea":
          return `Enter ${fieldLabel.toLowerCase()}…`;
        case "number":
          return "Enter number…";
        case "date":
          return "Select date…";
        case "select":
          return multiselect ? `Select one or more…` : `Select an option…`;
        default:
          return `Enter ${fieldLabel.toLowerCase()}…`;
      }
    })();

  switch (inputType) {
    case "text":
      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          {useExternalLabel ? (
            <FieldLabelRow
              classId={classId}
              hideLabel={hideLabel}
              label={fieldLabel}
              propertyId={propertyId}
            />
          ) : null}
          <FieldControlRow trailing={trailingSlot}>
            <DebouncedTextField
              ariaLabel={hideLabel || useExternalLabel ? fieldLabel : undefined}
              classNames={textInputClassNames}
              id={id}
              label={useExternalLabel || hideLabel ? undefined : visibleLabel}
              placeholder={hintPlaceholder}
              value={typeof value === "string" ? value : ""}
              onChange={(v) => onChange(v)}
            />
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
            editMode={editMode}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          {useExternalLabel ? (
            <FieldLabelRow
              classId={classId}
              hideLabel={hideLabel}
              label={fieldLabel}
              propertyId={propertyId}
            />
          ) : null}
          <FieldControlRow trailing={trailingSlot}>
            <DebouncedTextField
              multiline
              ariaLabel={hideLabel || useExternalLabel ? fieldLabel : undefined}
              classNames={textInputClassNames}
              id={id}
              label={useExternalLabel || hideLabel ? undefined : visibleLabel}
              placeholder={hintPlaceholder}
              value={typeof value === "string" ? value : ""}
              onChange={(v) => onChange(v)}
            />
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
            editMode={editMode}
          />
        </div>
      );

    case "number":
      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          {useExternalLabel ? (
            <FieldLabelRow
              classId={classId}
              hideLabel={hideLabel}
              label={fieldLabel}
              propertyId={propertyId}
            />
          ) : null}
          <FieldControlRow trailing={trailingSlot}>
            <Input
              aria-label={hideLabel || useExternalLabel ? fieldLabel : undefined}
              className={fieldInputClass}
              classNames={textInputClassNames}
              id={id}
              label={useExternalLabel || hideLabel ? undefined : visibleLabel}
              labelPlacement="outside"
              placeholder={hintPlaceholder}
              type="number"
              value={
                typeof value === "number"
                  ? String(value)
                  : value === "" || value === undefined
                    ? ""
                    : String(value)
              }
              variant="bordered"
              onValueChange={(v) =>
                onChange(
                  v === "" ? "" : Number.isNaN(Number(v)) ? v : Number(v),
                )
              }
            />
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={value === "" || value === undefined}
            editMode={editMode}
          />
        </div>
      );

    case "select": {
      const selectChevron = (
        <svg
          aria-hidden
          className={`h-4 w-4 text-default-400 transition-transform duration-200 ${
            selectOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      );

      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          {useExternalLabel ? (
            <FieldLabelRow
              classId={classId}
              hideLabel={hideLabel}
              label={fieldLabel}
              propertyId={propertyId}
            />
          ) : null}
          <FieldControlRow trailing={trailingSlot}>
            <Select
              aria-label={
                hideLabel || useExternalLabel ? fieldLabel : undefined
              }
              className={fieldInputClass}
              classNames={selectTriggerClassNames}
              id={id}
              isOpen={selectOpen}
              label={useExternalLabel || hideLabel ? undefined : visibleLabel}
              labelPlacement="outside"
              placeholder={hintPlaceholder}
              selectedKeys={
                multiselect
                  ? new Set(
                      (Array.isArray(value) ? value : []).map(
                        (v) =>
                          dedupedSelectOptions.find(
                            (o) => o.value === v || o.label === v,
                          )?.value ?? String(v),
                      ),
                    )
                  : (() => {
                      const val = typeof value === "string" ? value : "";

                      if (!val) return new Set();
                      const match = dedupedSelectOptions.find(
                        (o) => o.value === val || o.label === val,
                      );

                      return new Set([match ? match.value : val]);
                    })()
              }
              selectionMode={multiselect ? "multiple" : "single"}
              selectorIcon={selectChevron}
              variant="bordered"
              onOpenChange={setSelectOpen}
              onSelectionChange={(keys) => {
                if (multiselect) {
                  if (keys === "all") {
                    onChange(dedupedSelectOptions.map((o) => o.value));

                    return;
                  }
                  const next =
                    keys instanceof Set ? Array.from(keys).map(String) : [];

                  onChange(next);
                } else {
                  if (keys === "all") {
                    onChange("");

                    return;
                  }
                  const selected =
                    keys instanceof Set ? Array.from(keys)[0] : undefined;

                  onChange(selected != null ? String(selected) : "");
                }
              }}
            >
              {dedupedSelectOptions.map((opt) => (
                <SelectItem key={opt.value}>{opt.label}</SelectItem>
              ))}
            </Select>
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            defaultPickerOpen={defaultPickerOpen}
            disableSave={
              multiselect
                ? !Array.isArray(value) || value.length === 0
                : typeof value !== "string" || value.trim().length === 0
            }
            editMode={editMode}
            setDefaultPickerOpen={setDefaultPickerOpen}
          />
        </div>
      );
    }

    case "scale": {
      const { min, max, minLabel, maxLabel } = scaleConfig;
      const steps = max - min + 1;
      const labels = Array.from({ length: steps }, (_, i) => {
        const v = min + i;

        if (i === 0 && minLabel) return { value: String(v), label: minLabel };
        if (i === steps - 1 && maxLabel)
          return { value: String(v), label: maxLabel };

        return { value: String(v), label: String(v) };
      });
      const currentVal =
        typeof value === "number"
          ? value
          : typeof value === "string" && value
            ? Number(value)
            : undefined;

      return (
        <div className="q-field-card flex min-w-0 flex-col gap-2">
          <FieldLabelRow
            classId={undefined}
            hideLabel={hideLabel}
            label={fieldLabel}
            propertyId={propertyId}
          />
          <FieldDescription label={fieldLabel} text={description} />
          <FieldControlRow trailing={trailingSlot}>
            <RadioGroup
              classNames={{ wrapper: "flex-wrap gap-2" }}
              orientation="horizontal"
              value={currentVal != null ? String(currentVal) : undefined}
              onValueChange={(v) => onChange(v ? Number(v) : "")}
            >
              {labels.map((opt) => (
                <Radio
                  key={opt.value}
                  classNames={{ base: "m-0" }}
                  value={opt.value}
                >
                  {opt.label}
                </Radio>
              ))}
            </RadioGroup>
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={currentVal === undefined || currentVal === null}
            editMode={editMode}
          />
        </div>
      );
    }

    case "checkbox": {
      const coerced = normalizeCheckboxFormValue(value);
      const isOn = coerced === true;

      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          <FieldLabelRow
            classId={classId}
            hideLabel={hideLabel}
            label={fieldLabel}
            propertyId={propertyId}
          />
          <FieldControlRow trailing={trailingSlot}>
            <div
              className={`q-boolean-field w-full ${isOn ? "q-boolean-field--on" : ""}`}
            >
              <Switch
                aria-label={hideLabel ? fieldLabel : undefined}
                className={fieldInputClass}
                classNames={booleanSwitchClassNames}
                id={id}
                isSelected={isOn}
                onValueChange={(checked) => onChange(checked)}
              >
                {isOn ? "Yes" : "No"}
              </Switch>
            </div>
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            editMode={editMode}
          />
        </div>
      );
    }

    case "date":
      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          {useExternalLabel ? (
            <FieldLabelRow
              classId={classId}
              hideLabel={hideLabel}
              label={fieldLabel}
              propertyId={propertyId}
            />
          ) : null}
          <FieldControlRow trailing={trailingSlot}>
            <Input
              aria-label={hideLabel || useExternalLabel ? fieldLabel : undefined}
              className={fieldInputClass}
              classNames={textInputClassNames}
              id={id}
              label={useExternalLabel || hideLabel ? undefined : visibleLabel}
              labelPlacement="outside"
              type="date"
              value={typeof value === "string" ? value : ""}
              variant="bordered"
              onValueChange={(v) => onChange(v)}
            />
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
            editMode={editMode}
          />
        </div>
      );

    case "resource":
      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          {useExternalLabel ? (
            <FieldLabelRow
              classId={classId}
              hideLabel={hideLabel}
              label={fieldLabel}
              propertyId={propertyId}
            />
          ) : null}
          <div className="q-field-control min-w-0 w-full">
            <ResourceAutoselect
              classId={classId}
              hideLabel={hideLabel || useExternalLabel}
              label={fieldLabel}
              multiselect={multiselect}
              optionsScopeKey={resourceOptionsScope ?? propertyId}
              placeholder={hintPlaceholder}
              propertyId={propertyId}
              selectOptions={selectOptions}
              trailingAction={trailingSlot}
              value={value}
              onChange={onChange}
              onResourceOptionsSnapshot={onResourceOptionsSnapshot}
            />
          </div>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={
              multiselect
                ? !Array.isArray(value) || value.length === 0
                : !value ||
                  (typeof value === "string" && value.trim().length === 0)
            }
            editMode={editMode}
          />
        </div>
      );

    default:
      return (
        <div className="q-field-card flex min-w-0 flex-col gap-1.5">
          <FieldDescription label={fieldLabel} text={description} />
          {useExternalLabel ? (
            <FieldLabelRow
              classId={classId}
              hideLabel={hideLabel}
              label={fieldLabel}
              propertyId={propertyId}
            />
          ) : null}
          <FieldControlRow trailing={trailingSlot}>
            <DebouncedTextField
              ariaLabel={hideLabel || useExternalLabel ? fieldLabel : undefined}
              classNames={textInputClassNames}
              id={id}
              label={useExternalLabel || hideLabel ? undefined : visibleLabel}
              placeholder={hintPlaceholder}
              value={typeof value === "string" ? value : ""}
              onChange={(v) => onChange(v)}
            />
          </FieldControlRow>
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
            editMode={editMode}
          />
        </div>
      );
  }
}
