"use client";

import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Checkbox } from "@heroui/checkbox";
import { ResourceAutoselect } from "./ResourceAutoselect";
import { FieldLabel } from "./FieldLabel";
import type { InputType } from "@/types/template";

interface DynamicFieldInputProps {
  propertyId: string;
  label: string;
  inputType: InputType;
  placeholder?: string;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  /** class_id for IRI/resource fields - fetches options of this ORKG class */
  classId?: string;
}

const fieldInputClass = "w-full data-[focus=true]:border-primary";

const SELECT_OPTIONS = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
  { value: "option3", label: "Option 3" },
  { value: "other", label: "Other" },
];

export function DynamicFieldInput({
  propertyId,
  label,
  inputType,
  placeholder,
  value,
  onChange,
  classId,
}: DynamicFieldInputProps) {
  const id = `field-${propertyId}`;

  switch (inputType) {
    case "text":
      return (
        <Input
          id={id}
          label={<FieldLabel label={label} propertyId={propertyId} classId={classId} />}
          placeholder={placeholder ?? `Enter ${label.toLowerCase()}...`}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          labelPlacement="outside"
          classNames={{ inputWrapper: "border-default-200 data-[focus=true]:border-primary" }}
          className={fieldInputClass}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={id}
          label={<FieldLabel label={label} propertyId={propertyId} classId={classId} />}
          placeholder={placeholder ?? `Enter ${label.toLowerCase()}...`}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          labelPlacement="outside"
          minRows={3}
          classNames={{ inputWrapper: "border-default-200 data-[focus=true]:border-primary" }}
          className={fieldInputClass}
        />
      );

    case "number":
      return (
        <Input
          id={id}
          label={<FieldLabel label={label} propertyId={propertyId} classId={classId} />}
          type="number"
          placeholder={placeholder ?? `Enter number...`}
          value={
            typeof value === "number"
              ? String(value)
              : value === "" || value === undefined
                ? ""
                : String(value)
          }
          onValueChange={(v) =>
            onChange(
              v === ""
                ? ""
                : Number.isNaN(Number(v))
                  ? v
                  : Number(v)
            )
          }
          labelPlacement="outside"
          classNames={{ inputWrapper: "border-default-200 data-[focus=true]:border-primary" }}
          className={fieldInputClass}
        />
      );

    case "select":
      return (
        <Select
          id={id}
          label={<FieldLabel label={label} propertyId={propertyId} classId={classId} />}
          placeholder={placeholder ?? `Select ${label.toLowerCase()}...`}
          selectedKeys={
            typeof value === "string" && value ? new Set([value]) : new Set()
          }
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            onChange(selected ? String(selected) : "");
          }}
          labelPlacement="outside"
          classNames={{ trigger: "border-default-200 data-[focus=true]:border-primary" }}
          className={fieldInputClass}
        >
          {SELECT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </Select>
      );

    case "checkbox":
      return (
        <Checkbox
          id={id}
          isSelected={value === true}
          onValueChange={(checked) => onChange(checked)}
          classNames={{ base: "max-w-full", label: "text-primary/90" }}
        >
          <FieldLabel label={label} propertyId={propertyId} classId={classId} />
        </Checkbox>
      );

    case "date":
      return (
        <Input
          id={id}
          label={<FieldLabel label={label} propertyId={propertyId} classId={classId} />}
          type="date"
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          labelPlacement="outside"
          classNames={{ inputWrapper: "border-default-200 data-[focus=true]:border-primary" }}
          className={fieldInputClass}
        />
      );

    case "resource":
      return (
        <ResourceAutoselect
          propertyId={propertyId}
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          classId={classId}
        />
      );

    default:
      return (
        <Input
          id={id}
          label={<FieldLabel label={label} propertyId={propertyId} classId={classId} />}
          placeholder={placeholder ?? `Enter ${label.toLowerCase()}...`}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          labelPlacement="outside"
          classNames={{ inputWrapper: "border-default-200 data-[focus=true]:border-primary" }}
          className={fieldInputClass}
        />
      );
  }
}
