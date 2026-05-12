"use client";

import type { EnrichedTemplateMapping } from "@/types/template";
import type { FormValue } from "./QuestionnaireForm";
import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Button } from "@heroui/button";

import { QuestionnaireForm } from "./QuestionnaireForm";
import { QuestionnaireOrkgPreview } from "./QuestionnaireOrkgPreview";
import { QuestionnaireViewLoader } from "./QuestionnaireViewLoader";
import { OrkgSubmitModal } from "./OrkgSubmitModal";
import {
  loadQuestionnaireDraft,
  mergeLoadedFormValues,
  reconcileStructureDraft,
  type QuestionnaireStructureDraft,
} from "./questionnaire-draft-storage";

import { ResourceLabelCache } from "@/lib/resource-label-cache";

type Mode = "form" | "scidquest" | "orkgPreview";
const PENDING_TEMPLATE_KEY = "pending_template_navigation";

function hasSubProperties(prop: {
  subtemplate_properties?: Record<string, unknown>;
}): boolean {
  return Boolean(
    prop.subtemplate_properties &&
      Object.keys(prop.subtemplate_properties).length > 0,
  );
}

function isManyCardinality(cardinality?: string): boolean {
  if (!cardinality) return false;
  const normalized = cardinality.toLowerCase();

  return (
    normalized === "one to many" ||
    normalized === "one-to-many" ||
    normalized === "many" ||
    normalized === "multiple"
  );
}

function createEmptyValueForProperty(prop: {
  subtemplate_properties?: Record<string, any>;
}): FormValue {
  if (!hasSubProperties(prop)) return "";

  const value: Record<string, FormValue> = { _: "" };

  for (const [subId, subProp] of Object.entries(
    prop.subtemplate_properties as Record<string, any>,
  )) {
    value[subId] = createEmptyValueForProperty(subProp);
  }

  return value;
}

function buildInitialFormValues(
  mapping: EnrichedTemplateMapping,
): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};

  for (const [propId, prop] of Object.entries(mapping)) {
    values[propId] = createEmptyValueForProperty(prop);
  }

  return values;
}

function convertFormValueToScidQuestAnswer(
  value: FormValue,
  prop: any,
): unknown {
  if (!hasSubProperties(prop)) {
    if (isManyCardinality(prop.cardinality)) {
      if (Array.isArray(value))
        return value.map((v) => ResourceLabelCache.get(v) || v);
      if (value === "" || value === undefined || value === null) return [];

      return [ResourceLabelCache.get(value as string) || value];
    }

    const val = Array.isArray(value) ? (value[0] ?? "") : value;

    return typeof val === "string" ? ResourceLabelCache.get(val) || val : val;
  }

  if (Array.isArray(value)) return value;
  if (typeof value !== "object" || value === null) return {};

  const obj = value as Record<string, FormValue>;
  const nested: Record<string, unknown> = {};

  if (obj._ !== undefined && obj._ !== "") {
    nested.value = obj._;
  }

  for (const [subId, subProp] of Object.entries(
    prop.subtemplate_properties as Record<string, any>,
  )) {
    nested[subId] = convertFormValueToScidQuestAnswer(
      obj[subId] ?? "",
      subProp,
    );
  }

  if (isManyCardinality(prop.cardinality)) {
    return Array.isArray(value) ? value : [nested];
  }

  return nested;
}

function convertScidQuestAnswerToFormValue(
  answer: unknown,
  prop: any,
): FormValue {
  if (!hasSubProperties(prop)) {
    if (isManyCardinality(prop.cardinality)) {
      if (Array.isArray(answer)) {
        return answer.map(
          (a) => ResourceLabelCache.get(String(a)) || String(a),
        ) as FormValue;
      }
      if (answer === undefined || answer === null || answer === "") {
        return [];
      }
      if (
        typeof answer === "string" ||
        typeof answer === "number" ||
        typeof answer === "boolean"
      ) {
        return [ResourceLabelCache.get(String(answer)) || String(answer)];
      }

      return [];
    }

    if (
      answer &&
      typeof answer === "object" &&
      !Array.isArray(answer) &&
      "value" in (answer as Record<string, unknown>)
    ) {
      return convertScidQuestAnswerToFormValue(
        (answer as Record<string, unknown>).value,
        { ...prop, cardinality: undefined },
      );
    }

    if (
      typeof answer === "string" ||
      typeof answer === "number" ||
      typeof answer === "boolean" ||
      Array.isArray(answer)
    ) {
      if (typeof answer === "string")
        return ResourceLabelCache.get(answer) || answer;

      return answer as FormValue;
    }

    return "";
  }

  if (isManyCardinality(prop.cardinality)) {
    if (Array.isArray(answer) && answer.length > 0) {
      // The current form supports a single nested object shape.
      return convertScidQuestAnswerToFormValue(answer[0], {
        ...prop,
        cardinality: undefined,
      });
    }

    return createEmptyValueForProperty(prop);
  }

  const source =
    answer && typeof answer === "object" && !Array.isArray(answer)
      ? (answer as Record<string, unknown>)
      : {};
  const next: Record<string, FormValue> = { _: "" };

  if ("value" in source) {
    const v = source.value;

    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      Array.isArray(v)
    ) {
      next._ = v as FormValue;
    }
  }

  for (const [subId, subProp] of Object.entries(
    prop.subtemplate_properties as Record<string, any>,
  )) {
    next[subId] = convertScidQuestAnswerToFormValue(source[subId], subProp);
  }

  return next;
}

const ANSWER_HISTORY_MAX = 50;

type AnswerHistState = {
  values: Record<string, FormValue>;
  past: Record<string, FormValue>[];
  future: Record<string, FormValue>[];
};

function formValuesEqual(
  a: Record<string, FormValue>,
  b: Record<string, FormValue>,
) {
  return JSON.stringify(a) === JSON.stringify(b);
}

type AnswerHistAction =
  | { type: "commit"; next: Record<string, FormValue> }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "hydrate"; next: Record<string, FormValue> };

function answerHistoryReducer(
  state: AnswerHistState,
  action: AnswerHistAction,
): AnswerHistState {
  switch (action.type) {
    case "commit": {
      if (formValuesEqual(state.values, action.next)) return state;

      return {
        values: action.next,
        past: [
          ...state.past.slice(-(ANSWER_HISTORY_MAX - 1)),
          structuredClone(state.values),
        ],
        future: [],
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1]!;

      return {
        values: structuredClone(prev),
        past: state.past.slice(0, -1),
        future: [
          ...state.future.slice(-(ANSWER_HISTORY_MAX - 1)),
          structuredClone(state.values),
        ],
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const nextVal = state.future[state.future.length - 1]!;

      return {
        values: structuredClone(nextVal),
        future: state.future.slice(0, -1),
        past: [
          ...state.past.slice(-(ANSWER_HISTORY_MAX - 1)),
          structuredClone(state.values),
        ],
      };
    }
    case "hydrate": {
      return {
        values: structuredClone(action.next),
        past: [],
        future: [],
      };
    }
    default:
      return state;
  }
}

export function QuestionnairePageModeSwitcher({
  templateId,
  targetClassId,
  targetClassLabel,
  label,
  mapping,
  scidQuestTemplate,
}: {
  templateId: string;
  targetClassId?: string;
  targetClassLabel?: string;
  label: string;
  mapping: EnrichedTemplateMapping;
  scidQuestTemplate: ScidQuestQuestionnaireTemplate;
}) {
  const [mode, setMode] = useState<Mode>("form");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [previewStructure, setPreviewStructure] =
    useState<QuestionnaireStructureDraft | null>(null);

  const [answerHist, dispatchAnswer] = useReducer(
    answerHistoryReducer,
    undefined,
    (): AnswerHistState => ({
      values: buildInitialFormValues(mapping),
      past: [],
      future: [],
    }),
  );

  useLayoutEffect(() => {
    const d = loadQuestionnaireDraft(templateId);

    if (d?.structure) {
      setPreviewStructure(reconcileStructureDraft(d.structure, mapping));
    }

    if (d?.values) {
      dispatchAnswer({
        type: "hydrate",
        next: mergeLoadedFormValues(mapping, d.values),
      });
    }
  }, [templateId, mapping]);

  const sharedValues = answerHist.values;
  const answerValuesRef = useRef(sharedValues);

  answerValuesRef.current = sharedValues;

  const commitSharedValues = useCallback((next: Record<string, FormValue>) => {
    dispatchAnswer({ type: "commit", next });
  }, []);

  const undoAnswers = useCallback(() => {
    dispatchAnswer({ type: "undo" });
  }, []);

  const redoAnswers = useCallback(() => {
    dispatchAnswer({ type: "redo" });
  }, []);

  useEffect(() => {
    try {
      sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
    } catch {}
  }, []);

  const scidQuestInitialAnswers = useMemo(() => {
    const answers: Record<string, unknown> = {};

    for (const [propId, prop] of Object.entries(mapping)) {
      answers[propId] = convertFormValueToScidQuestAnswer(
        sharedValues[propId],
        prop,
      );
    }

    return answers;
  }, [mapping, sharedValues]);

  const handleScidQuestAnswersChange = useCallback(
    (answers: Record<string, unknown>) => {
      const prev = answerValuesRef.current;
      const next = { ...prev };
      let hasChanges = false;

      for (const [propId, prop] of Object.entries(mapping)) {
        if (!(propId in answers)) continue;
        const newVal = convertScidQuestAnswerToFormValue(answers[propId], prop);

        if (JSON.stringify(prev[propId]) !== JSON.stringify(newVal)) {
          next[propId] = newVal;
          hasChanges = true;
        }
      }

      if (!hasChanges) return;
      dispatchAnswer({ type: "commit", next });
    },
    [mapping],
  );

  return (
    <section className="w-full h-[calc(100vh-140px)] overflow-x-hidden overflow-y-auto">
      <div className="flex items-center justify-end gap-3 pb-4 px-6 md:px-10">
        <Button
          color="success"
          size="sm"
          variant="flat"
          onPress={() => setShowSubmitModal(true)}
        >
          🚀 Submit to ORKG
        </Button>
        <Button
          color={mode === "form" ? "primary" : "default"}
          size="sm"
          variant={mode === "form" ? "solid" : "flat"}
          onPress={() => setMode("form")}
        >
          Form mode
        </Button>
        <Button
          color={mode === "scidquest" ? "secondary" : "default"}
          size="sm"
          variant={mode === "scidquest" ? "solid" : "flat"}
          onPress={() => setMode("scidquest")}
        >
          ScidQuest mode
        </Button>
        <Button
          color={mode === "orkgPreview" ? "danger" : "default"}
          size="sm"
          variant={mode === "orkgPreview" ? "solid" : "flat"}
          onPress={() => setMode("orkgPreview")}
        >
          ORKG preview
        </Button>
      </div>

      <div
        aria-hidden={mode !== "form"}
        className={mode === "form" ? "block" : "hidden"}
      >
        <QuestionnaireForm
          answerHistory={{
            canRedo: answerHist.future.length > 0,
            canUndo: answerHist.past.length > 0,
            onRedo: redoAnswers,
            onUndo: undoAnswers,
          }}
          backHref="/"
          initialEditMode={false}
          label={label}
          mapping={mapping}
          persistDraftToTemplateId={templateId}
          showSubmitButton={false}
          targetClassId={targetClassId}
          templateId={templateId}
          values={sharedValues}
          onDraftPersist={(d) =>
            setPreviewStructure(reconcileStructureDraft(d.structure, mapping))
          }
          onValuesChange={commitSharedValues}
        />
      </div>
      <div
        aria-hidden={mode !== "scidquest"}
        className={
          mode === "scidquest" ? "w-full h-full flex flex-col" : "hidden"
        }
      >
        <QuestionnaireViewLoader
          initialAnswers={scidQuestInitialAnswers}
          label={label}
          templateSpec={scidQuestTemplate}
          onAnswersChange={
            mode === "scidquest" ? handleScidQuestAnswersChange : undefined
          }
        />
      </div>
      <div
        aria-hidden={mode !== "orkgPreview"}
        className={mode === "orkgPreview" ? "block" : "hidden"}
      >
        <QuestionnaireOrkgPreview
          label={label}
          mapping={mapping}
          structure={previewStructure}
          targetClassId={targetClassId}
          targetClassLabel={targetClassLabel}
          templateId={templateId}
          values={sharedValues}
        />
      </div>

      <OrkgSubmitModal
        isOpen={showSubmitModal}
        mapping={mapping}
        targetClassId={targetClassId}
        templateId={templateId}
        templateLabel={label}
        values={sharedValues}
        onClose={() => setShowSubmitModal(false)}
      />
    </section>
  );
}
