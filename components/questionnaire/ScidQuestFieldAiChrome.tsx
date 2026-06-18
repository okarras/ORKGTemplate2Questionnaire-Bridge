"use client";

import type { InputType } from "@/types/template";
import type { SelectOption } from "./questionnaire-form-types";
import type { ReactNode } from "react";
import type { ResearchFieldAiQuestionType } from "@orkg/scidquest";

import { memo, useEffect, useState } from "react";

import {
  dedupeOrkgResourceIris,
  normalizeOrkgResourceIri,
  orkgResourceIriTail,
  resourceIrisEquivalent,
} from "@/lib/orkg-resource-ids";
import { ResourceLabelCache } from "@/lib/resource-label-cache";

type FieldValue = string | number | boolean | string[];

function fieldValueToAnswerString(value: FieldValue): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";

  return String(value);
}

/** Map stored option/resource ids to human-readable labels for LLM prompts. */
function fieldValueToLlmAnswerString(
  value: FieldValue,
  inputType: InputType,
  selectOptions?: SelectOption[],
): string {
  const useLabels =
    (inputType === "select" || inputType === "resource") &&
    selectOptions &&
    selectOptions.length > 0;

  if (!useLabels) {
    return fieldValueToAnswerString(value);
  }

  const resolve = (raw: string): string => {
    const trimmed = raw.trim();

    if (!trimmed) return "";

    const hit = selectOptions.find(
      (o) =>
        o.value === trimmed ||
        o.label.trim().toLowerCase() === trimmed.toLowerCase(),
    );

    return (hit?.label || hit?.value || trimmed).trim();
  };

  if (Array.isArray(value)) {
    return value
      .map((v) => resolve(String(v)))
      .filter(Boolean)
      .join(", ");
  }

  return resolve(String(value));
}

function mapToAiQuestionType(
  inputType: InputType,
  cardinality?: string,
): ResearchFieldAiQuestionType {
  const many = cardinality?.toLowerCase() === "one to many";

  if (inputType === "select" || inputType === "resource") {
    return many ? "multi_select" : "select";
  }

  return "text";
}

/** Map applied suggestion fragment (label or id) to stored option value (e.g. ORKG IRI). */
function resolveAppliedPartToOptionValue(
  raw: string,
  selectOptions?: SelectOption[],
): string {
  const t = raw.trim();

  if (!t) return raw;

  if (!selectOptions?.length) return t;

  const lower = t.toLowerCase();

  for (const o of selectOptions) {
    const lab = o.label?.trim() ?? "";

    if (lab && lab.toLowerCase() === lower) {
      return o.value;
    }

    if (o.value === t) return o.value;

    if (resourceIrisEquivalent(o.value, t)) return o.value;

    if (orkgResourceIriTail(o.value).toLowerCase() === lower) return o.value;

    if (normalizeOrkgResourceIri(o.value) === normalizeOrkgResourceIri(t)) {
      return o.value;
    }
  }

  return t;
}

function rememberOptionLabel(value: string, label: string) {
  const v = value.trim();
  const l = label.trim();

  if (!v || !l) return;

  ResourceLabelCache.set(v, l);
  ResourceLabelCache.set(normalizeOrkgResourceIri(v), l);
  const tail = orkgResourceIriTail(v);

  ResourceLabelCache.set(tail, l);
}

function applySuggestionToFieldValue(
  inputType: InputType,
  text: string,
  cardinality: string | undefined,
  selectOptions?: SelectOption[],
): FieldValue {
  if (inputType === "number") {
    const n = Number(text.trim());

    return Number.isFinite(n) ? n : text;
  }

  if (inputType === "checkbox") {
    const t = text.trim().toLowerCase();

    return t === "true" || t === "yes" || t === "1";
  }

  if (inputType === "select" || inputType === "resource") {
    const many = cardinality?.toLowerCase() === "one to many";
    const parts = text
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const resolved = parts.map((p) => {
      const v = resolveAppliedPartToOptionValue(p, selectOptions);
      const hit = selectOptions?.find(
        (o) =>
          o.value === v ||
          resourceIrisEquivalent(o.value, v) ||
          normalizeOrkgResourceIri(o.value) === normalizeOrkgResourceIri(v),
      );

      if (hit?.label) {
        rememberOptionLabel(hit.value, hit.label);
      }

      return v;
    });

    if (many) {
      if (inputType === "resource") {
        return dedupeOrkgResourceIris(
          resolved.map((r) => normalizeOrkgResourceIri(r)),
        );
      }

      return Array.from(new Set(resolved));
    }

    const single = resolved[0] ?? text.trim();

    if (inputType === "resource") {
      return normalizeOrkgResourceIri(single);
    }

    return single;
  }

  return text;
}

/**
 * ORKG-specific adapter around {@link ResearchQuestionnaireFieldAiWrapper} from `@orkg/scidquest`.
 * Renders `children` (the field control) with ScidQuest AI when inside ScidQuest workspace context.
 */
export const ScidQuestFieldAiChrome = memo(function ScidQuestFieldAiChrome({
  children,
  propertyId,
  label,
  inputType,
  value,
  onChange,
  selectOptions,
  cardinality,
}: {
  children: ReactNode;
  propertyId: string;
  label: string;
  inputType: InputType;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  selectOptions?: SelectOption[];
  cardinality?: string;
}) {
  const [AiWrapper, setAiWrapper] = useState<React.ComponentType<{
    children: ReactNode;
    currentAnswer: string;
    questionId: string;
    questionOptions?: string[];
    questionText: string;
    questionType: ResearchFieldAiQuestionType;
    onApplySuggestion: (text: string) => void;
    aiLayout?: "menu" | "buttons" | "both";
    aiActions?: Array<"suggest" | "verify" | "history" | "config">;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;

    void import("@orkg/scidquest")
      .then((mod) => {
        if (cancelled) return;
        const wrapper = mod.ResearchQuestionnaireFieldAiWrapper;

        if (typeof wrapper === "function") {
          setAiWrapper(() => wrapper);
        } else {
          setAiWrapper(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAiWrapper(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const questionType = mapToAiQuestionType(inputType, cardinality);
  const questionOptions =
    selectOptions?.map((o) => o.label || o.value).filter(Boolean) ?? [];

  if (typeof AiWrapper !== "function") {
    return <div className="min-w-0 w-full">{children}</div>;
  }

  return (
    <AiWrapper
      aiActions={["suggest", "verify"]}
      aiLayout="buttons"
      currentAnswer={fieldValueToLlmAnswerString(
        value,
        inputType,
        selectOptions,
      )}
      questionId={propertyId}
      questionOptions={questionOptions.length > 0 ? questionOptions : undefined}
      questionText={label}
      questionType={questionType}
      onApplySuggestion={(text) => {
        onChange(
          applySuggestionToFieldValue(
            inputType,
            text,
            cardinality,
            selectOptions,
          ),
        );
      }}
    >
      <div className="min-w-0 w-full">{children}</div>
    </AiWrapper>
  );
});
