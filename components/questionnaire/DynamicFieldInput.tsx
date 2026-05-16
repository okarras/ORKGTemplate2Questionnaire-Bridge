"use client";

import type { InputType } from "@/types/template";
import type { ScaleConfig, SelectOption } from "./QuestionnaireForm";

import { useMemo, useState } from "react";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Checkbox } from "@heroui/checkbox";
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
}

const fieldInputClass = "w-full data-[focus=true]:border-primary";
const inputWrapperClass =
  "rounded-lg border-default-200 data-[focus=true]:border-primary transition-colors";

const DEFAULT_SELECT_OPTIONS: SelectOption[] = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
  { value: "option3", label: "Option 3" },
  { value: "other", label: "Other" },
];

const isOneToMany = (cardinality?: string) =>
  cardinality?.toLowerCase() === "one to many";

function FillModeDefaultFooter({
  controls,
  disableSave,
  defaultPickerOpen,
  setDefaultPickerOpen,
}: {
  controls?: DynamicFieldInputProps["fillModeDefaultControls"];
  disableSave?: boolean;
  defaultPickerOpen?: boolean;
  setDefaultPickerOpen?: (open: boolean) => void;
}) {
  if (!controls) return null;

  const pickOpts = controls.pickDefaultFromSelectOptions;
  const showPicker =
    pickOpts &&
    pickOpts.length > 0 &&
    controls.onPickDefaultOption &&
    setDefaultPickerOpen;

  return (
    <div className="mt-2 border-t border-default-200 pt-2">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-default-500">
        Fill mode — default if left empty
      </p>
      <p className="mb-2 text-[11px] leading-snug text-default-500">
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
}: DynamicFieldInputProps) {
  const id = `field-${propertyId}`;
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
  const visibleLabel = hideLabel ? (
    <span className="sr-only">{label}</span>
  ) : (
    <FieldLabel classId={classId} label={label} propertyId={propertyId} />
  );

  switch (inputType) {
    case "text":
      return (
        <div className="flex flex-col gap-1.5">
          <Input
            className={fieldInputClass}
            classNames={{
              inputWrapper: inputWrapperClass,
            }}
            id={id}
            label={visibleLabel}
            labelPlacement="outside"
            placeholder={placeholder ?? `Enter ${label.toLowerCase()}...`}
            value={typeof value === "string" ? value : ""}
            onValueChange={(v) => onChange(v)}
          />
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="flex flex-col gap-1.5">
          <Textarea
            className={fieldInputClass}
            classNames={{
              inputWrapper: inputWrapperClass,
            }}
            id={id}
            label={visibleLabel}
            labelPlacement="outside"
            minRows={3}
            placeholder={placeholder ?? `Enter ${label.toLowerCase()}...`}
            value={typeof value === "string" ? value : ""}
            onValueChange={(v) => onChange(v)}
          />
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
          />
        </div>
      );

    case "number":
      return (
        <div className="flex flex-col gap-1.5">
          <Input
            className={fieldInputClass}
            classNames={{
              inputWrapper: inputWrapperClass,
            }}
            id={id}
            label={visibleLabel}
            labelPlacement="outside"
            placeholder={placeholder ?? `Enter number...`}
            type="number"
            value={
              typeof value === "number"
                ? String(value)
                : value === "" || value === undefined
                  ? ""
                  : String(value)
            }
            onValueChange={(v) =>
              onChange(v === "" ? "" : Number.isNaN(Number(v)) ? v : Number(v))
            }
          />
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={value === "" || value === undefined}
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
        <div className="flex flex-col gap-1.5">
          <Select
            aria-label={hideLabel ? label : undefined}
            className={fieldInputClass}
            classNames={{
              trigger: inputWrapperClass,
            }}
            id={id}
            isOpen={selectOpen}
            label={hideLabel ? undefined : visibleLabel}
            labelPlacement="outside"
            placeholder={
              placeholder ??
              (multiselect
                ? `Select one or more ${label.toLowerCase()}...`
                : `Select ${label.toLowerCase()}...`)
            }
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
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            defaultPickerOpen={defaultPickerOpen}
            disableSave={
              multiselect
                ? !Array.isArray(value) || value.length === 0
                : typeof value !== "string" || value.trim().length === 0
            }
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
        <div className="flex flex-col gap-3">
          {hideLabel ? (
            <span className="sr-only">{label}</span>
          ) : (
            <FieldLabel
              classId={undefined}
              label={label}
              propertyId={propertyId}
            />
          )}
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
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={currentVal === undefined || currentVal === null}
          />
        </div>
      );
    }

    case "checkbox": {
      const coerced = normalizeCheckboxFormValue(value);

      return (
        <div className="flex flex-col gap-1.5">
          <Checkbox
            classNames={{ base: "max-w-full", label: "text-primary/90" }}
            id={id}
            isSelected={coerced === true}
            onValueChange={(checked) => onChange(checked)}
          >
            {hideLabel ? (
              <span className="sr-only">{label}</span>
            ) : (
              <FieldLabel
                classId={classId}
                label={label}
                propertyId={propertyId}
              />
            )}
          </Checkbox>
          <FillModeDefaultFooter controls={fillModeDefaultControls} />
        </div>
      );
    }

    case "date":
      return (
        <div className="flex flex-col gap-1.5">
          <Input
            className={fieldInputClass}
            classNames={{
              inputWrapper: inputWrapperClass,
            }}
            id={id}
            label={visibleLabel}
            labelPlacement="outside"
            type="date"
            value={typeof value === "string" ? value : ""}
            onValueChange={(v) => onChange(v)}
          />
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
          />
        </div>
      );

    case "resource":
      return (
        <div className="flex flex-col gap-1.5">
          <ResourceAutoselect
            classId={classId}
            hideLabel={hideLabel}
            label={label}
            multiselect={multiselect}
            optionsScopeKey={resourceOptionsScope ?? propertyId}
            placeholder={placeholder}
            propertyId={propertyId}
            selectOptions={selectOptions}
            value={value}
            onChange={onChange}
            onResourceOptionsSnapshot={onResourceOptionsSnapshot}
          />
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={
              multiselect
                ? !Array.isArray(value) || value.length === 0
                : !value ||
                  (typeof value === "string" && value.trim().length === 0)
            }
          />
        </div>
      );

    default:
      return (
        <div className="flex flex-col gap-1.5">
          <Input
            className={fieldInputClass}
            classNames={{
              inputWrapper: inputWrapperClass,
            }}
            id={id}
            label={visibleLabel}
            labelPlacement="outside"
            placeholder={placeholder ?? `Enter ${label.toLowerCase()}...`}
            value={typeof value === "string" ? value : ""}
            onValueChange={(v) => onChange(v)}
          />
          <FillModeDefaultFooter
            controls={fillModeDefaultControls}
            disableSave={typeof value !== "string" || value.trim().length === 0}
          />
        </div>
      );
  }
}
