"use client";

import type { InputType } from "@/types/template";
import type { ScaleConfig, SelectOption } from "./questionnaire-form-types";

import { Checkbox } from "@heroui/checkbox";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import {
  normalizeOrkgResourceIri,
  resourceIrisEquivalent,
} from "@/lib/orkg-resource-ids";

import {
  formatStoredMultiDefault,
  parseStoredMultiDefault,
} from "./field-default-value-utils";
import { ResourceDefaultPicker } from "./ResourceDefaultPicker";

function isOneToMany(cardinality?: string) {
  return cardinality?.toLowerCase() === "one to many";
}

function dedupeOptions(options: SelectOption[]): SelectOption[] {
  const seen = new Set<string>();
  const out: SelectOption[] = [];

  for (const o of options) {
    const k = String(o.value);

    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }

  return out;
}

function isOptionSelected(stored: string[], optionValue: string): boolean {
  return stored.some((s) => resourceIrisEquivalent(s, optionValue));
}

function DefaultFromOptionsMulti({
  label,
  description,
  options,
  value,
  onChange,
  normalizeValues,
}: {
  label: string;
  description?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Canonicalize stored ids (e.g. ORKG resource IRIs). */
  normalizeValues?: boolean;
}) {
  const deduped = dedupeOptions(options);
  const selected = parseStoredMultiDefault(value);
  const canon = (raw: string) =>
    normalizeValues ? normalizeOrkgResourceIri(raw) : raw.trim();

  const toggle = (optionValue: string, checked: boolean) => {
    const id = canon(optionValue);
    let next = [...selected];

    if (checked) {
      if (!next.some((s) => resourceIrisEquivalent(s, id))) {
        next.push(id);
      }
    } else {
      next = next.filter((s) => !resourceIrisEquivalent(s, id));
    }

    onChange(formatStoredMultiDefault(next));
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-default-700">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-default-500">{description}</p>
        ) : null}
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-default-200 bg-default-50/40 p-3">
        {deduped.map((opt) => (
          <Checkbox
            key={opt.value}
            isSelected={isOptionSelected(selected, opt.value)}
            onValueChange={(checked) => toggle(opt.value, checked)}
          >
            <span className="text-sm">{opt.label}</span>
          </Checkbox>
        ))}
      </div>
      {selected.length > 0 ? (
        <p className="text-xs text-default-500">
          {selected.length} default{selected.length !== 1 ? "s" : ""} selected
        </p>
      ) : null}
    </div>
  );
}

function DefaultFromOptionsSingle({
  label,
  description,
  options,
  value,
  onChange,
  normalizeValue,
}: {
  label: string;
  description?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  normalizeValue?: boolean;
}) {
  const deduped = dedupeOptions(options);
  const stored = value.trim();
  const selectedKeys = (() => {
    if (!stored) return new Set<string>();
    const hit = deduped.find((o) => resourceIrisEquivalent(o.value, stored));

    return new Set([hit ? hit.value : stored]);
  })();

  return (
    <Select
      description={description}
      label={label}
      placeholder="No default"
      selectedKeys={selectedKeys}
      variant="bordered"
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        const first =
          keys instanceof Set ? Array.from(keys)[0] : undefined;

        if (first == null) {
          onChange("");

          return;
        }
        const hit = deduped.find((o) => o.value === String(first));

        onChange(
          normalizeValue
            ? normalizeOrkgResourceIri(hit?.value ?? String(first))
            : String(hit?.value ?? first),
        );
      }}
    >
      {deduped.map((opt) => (
        <SelectItem key={opt.value} textValue={opt.label}>
          {opt.label}
        </SelectItem>
      ))}
    </Select>
  );
}

export function FieldDefaultValueEditor({
  inputType,
  value,
  onChange,
  selectOptions = [],
  scaleConfig = { min: 1, max: 5 },
  cardinality,
  propertyId,
  classId,
}: {
  inputType: InputType;
  value: string;
  onChange: (value: string) => void;
  selectOptions?: SelectOption[];
  scaleConfig?: ScaleConfig;
  cardinality?: string;
  /** ORKG resource fields: load defaults from API when no restricted list. */
  propertyId?: string;
  classId?: string;
}) {
  const deduped = dedupeOptions(selectOptions);
  const many = isOneToMany(cardinality);

  switch (inputType) {
    case "checkbox":
      return (
        <Switch
          isSelected={value === "true"}
          onValueChange={(on) => onChange(on ? "true" : "false")}
        >
          <span className="text-sm">Default: Yes</span>
        </Switch>
      );

    case "select":
      if (deduped.length === 0) {
        return (
          <Input
            description="Add select options above, or enter a stored value."
            label="Default value (when empty)"
            placeholder="Option value"
            value={value}
            variant="bordered"
            onValueChange={onChange}
          />
        );
      }

      if (many) {
        return (
          <DefaultFromOptionsMulti
            description="Used in fill mode when the respondent leaves this field empty."
            label="Default value (when empty)"
            options={deduped}
            value={value}
            onChange={onChange}
          />
        );
      }

      return (
        <DefaultFromOptionsSingle
          description="Used in fill mode when the respondent leaves this field empty."
          label="Default value (when empty)"
          options={deduped}
          value={value}
          onChange={onChange}
        />
      );

    case "resource":
      if (propertyId) {
        return (
          <ResourceDefaultPicker
            cardinality={cardinality}
            classId={classId}
            propertyId={propertyId}
            restrictedOptions={deduped}
            value={value}
            onChange={onChange}
          />
        );
      }

      return (
        <p className="text-sm text-default-500">
          Cannot load ORKG resources for this field (missing property id).
        </p>
      );

    case "scale": {
      const steps = Math.max(1, scaleConfig.max - scaleConfig.min + 1);
      const scaleItems = Array.from({ length: steps }, (_, i) => {
        const v = String(scaleConfig.min + i);

        return { value: v, label: v };
      });

      return (
        <Select
          label="Default value (when empty)"
          placeholder="No default"
          selectedKeys={value ? new Set([value]) : new Set()}
          variant="bordered"
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const k =
              keys instanceof Set ? Array.from(keys)[0] : undefined;

            onChange(k != null ? String(k) : "");
          }}
        >
          {scaleItems.map((opt) => (
            <SelectItem key={opt.value}>{opt.label}</SelectItem>
          ))}
        </Select>
      );
    }

    case "number":
      return (
        <Input
          label="Default value (when empty)"
          placeholder="e.g. 0"
          type="number"
          value={value}
          variant="bordered"
          onValueChange={onChange}
        />
      );

    case "date":
      return (
        <Input
          label="Default value (when empty)"
          type="date"
          value={value}
          variant="bordered"
          onValueChange={onChange}
        />
      );

    case "textarea":
      return (
        <Textarea
          description="Used in fill mode when the respondent leaves this field empty."
          label="Default value (when empty)"
          minRows={2}
          placeholder="Default text…"
          value={value}
          variant="bordered"
          onValueChange={onChange}
        />
      );

    default:
      return (
        <Input
          description="Used in fill mode when the respondent leaves this field empty."
          label="Default value (when empty)"
          placeholder="Default text…"
          value={value}
          variant="bordered"
          onValueChange={onChange}
        />
      );
  }
}
