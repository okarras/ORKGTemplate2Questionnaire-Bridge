"use client";

import type { InputType } from "@/types/template";
import type { ScaleConfig, SelectOption } from "./QuestionnaireForm";

import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Checkbox } from "@heroui/checkbox";
import { RadioGroup, Radio } from "@heroui/radio";

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

export function DynamicFieldInput({
  propertyId,
  label,
  inputType,
  placeholder,
  value,
  onChange,
  cardinality,
  classId,
  createLink,
  selectOptions = DEFAULT_SELECT_OPTIONS,
  scaleConfig = { min: 1, max: 5 },
  hideLabel = false,
  resourceOptionsScope,
  onResourceOptionsSnapshot,
}: DynamicFieldInputProps) {
  const id = `field-${propertyId}`;
  const multiselect = isOneToMany(cardinality);
  const visibleLabel = hideLabel ? (
    <span className="sr-only">{label}</span>
  ) : (
    <FieldLabel classId={classId} label={label} propertyId={propertyId} />
  );

  switch (inputType) {
    case "text":
      return (
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
      );

    case "textarea":
      return (
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
      );

    case "number":
      return (
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
      );

    case "select":
      return (
        <Select
          aria-label={hideLabel ? label : undefined}
          className={fieldInputClass}
          classNames={{
            trigger: inputWrapperClass,
          }}
          id={id}
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
                      selectOptions.find((o) => o.value === v || o.label === v)
                        ?.value ?? String(v),
                  ),
                )
              : (() => {
                  const val = typeof value === "string" ? value : "";

                  if (!val) return new Set();
                  const match = selectOptions.find(
                    (o) => o.value === val || o.label === val,
                  );

                  return new Set([match ? match.value : val]);
                })()
          }
          selectionMode={multiselect ? "multiple" : "single"}
          onSelectionChange={(keys) => {
            if (multiselect) {
              if (keys === "all") {
                onChange(selectOptions.map((o) => o.value));

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
          {selectOptions.map((opt) => (
            <SelectItem key={opt.value}>{opt.label}</SelectItem>
          ))}
        </Select>
      );

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
        </div>
      );
    }

    case "checkbox": {
      const coerced = normalizeCheckboxFormValue(value);

      return (
        <Checkbox
          classNames={{ base: "max-w-full", label: "text-primary/90" }}
          id={id}
          isSelected={coerced === true}
          onValueChange={(checked) => onChange(checked)}
        >
          {hideLabel ? (
            <span className="sr-only">{label}</span>
          ) : (
            <FieldLabel classId={classId} label={label} propertyId={propertyId} />
          )}
        </Checkbox>
      );
    }

    case "date":
      return (
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
      );

    case "resource":
      return (
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
      );

    default:
      return (
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
      );
  }
}
