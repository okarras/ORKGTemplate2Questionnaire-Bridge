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
    /**
     * When set, fill mode treats this path as answered with this value if the user left it empty.
     * Stored as a string (single value); one-to-many uses comma-separated values or IRIs.
     */
    emptyDefault?: string;
  }
>;

export type OrderedBlock =
  | { kind: "property"; id: string }
  | { kind: "custom"; id: string };
