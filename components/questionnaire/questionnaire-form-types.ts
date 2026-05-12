import type { InputType } from "@/types/template";

type PropertyValue = string | number | boolean | string[];

export type FormValue =
  | PropertyValue
  | { _?: PropertyValue; [key: string]: FormValue | undefined };

export interface SelectOption {
  value: string;
  label: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export type FieldOverrides = Record<
  string,
  {
    label?: string;
    description?: string;
    inputType?: InputType;
    selectOptions?: SelectOption[];
    scaleConfig?: ScaleConfig;
  }
>;

export type OrderedBlock =
  | { kind: "property"; id: string }
  | { kind: "custom"; id: string };
