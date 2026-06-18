"use client";

import type { EnrichedTemplateMapping } from "@/types/template";
import type { FormValue } from "./QuestionnaireForm";

import { Button } from "@heroui/button";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import { QuestionnaireForm } from "./QuestionnaireForm";
import { QuestionnaireOrkgPreview } from "./QuestionnaireOrkgPreview";
import { QuestionnaireViewLoader } from "./QuestionnaireViewLoader";
import { OrkgSubmitModal } from "./OrkgSubmitModal";
import {
  loadQuestionnaireDraft,
  mergeLoadedFormValues,
  reconcileStructureDraft,
  type PersistedQuestionnaireDraft,
  type QuestionnaireStructureDraft,
} from "./questionnaire-draft-storage";

import {
  orkgToScidQuestTemplate,
  type ScidQuestQuestionnaireTemplate,
} from "@/lib/orkg-to-scidquest-adapter";

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
}: {
  templateId: string;
  targetClassId?: string;
  targetClassLabel?: string;
  label: string;
  mapping: EnrichedTemplateMapping;
}) {
  const [mode, setMode] = useState<Mode>("form");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [previewStructure, setPreviewStructure] =
    useState<QuestionnaireStructureDraft | null>(null);

  const [scidQuestTemplate, setScidQuestTemplate] =
    useState<ScidQuestQuestionnaireTemplate | null>(null);

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

  const commitSharedValues = useCallback((next: Record<string, FormValue>) => {
    dispatchAnswer({ type: "commit", next });
  }, []);

  const undoAnswers = useCallback(() => {
    dispatchAnswer({ type: "undo" });
  }, []);

  const redoAnswers = useCallback(() => {
    dispatchAnswer({ type: "redo" });
  }, []);

  const scidQuestFormProps = useMemo(
    () => ({
      answerHistory: {
        canRedo: answerHist.future.length > 0,
        canUndo: answerHist.past.length > 0,
        onRedo: redoAnswers,
        onUndo: undoAnswers,
      },
      backHref: "/" as const,
      initialEditMode: false,
      label,
      mapping,
      persistDraftToTemplateId: templateId,
      showSubmitButton: false,
      targetClassId,
      templateId,
      values: sharedValues,
      onDraftPersist: (d: PersistedQuestionnaireDraft) =>
        setPreviewStructure(reconcileStructureDraft(d.structure, mapping)),
      onValuesChange: commitSharedValues,
    }),
    [
      answerHist.future.length,
      answerHist.past.length,
      redoAnswers,
      undoAnswers,
      label,
      mapping,
      templateId,
      targetClassId,
      sharedValues,
      commitSharedValues,
    ],
  );

  useEffect(() => {
    try {
      sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    void orkgToScidQuestTemplate(mapping, templateId, label).then((t) => {
      if (!cancelled) setScidQuestTemplate(t);
    });

    return () => {
      cancelled = true;
    };
  }, [mapping, templateId, label]);

  return (
    <section className="flex min-h-0 w-full flex-grow flex-col overflow-x-hidden h-[calc(100dvh-64px)] max-h-[calc(100dvh-64px)] [scrollbar-gutter:stable]">
      <div className="flex shrink-0 items-center justify-end gap-3 px-6 pb-4 pt-0 md:px-10">
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
        className={
          mode === "form" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"
        }
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
          mode === "scidquest"
            ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden px-0"
            : "hidden"
        }
      >
        <QuestionnaireViewLoader
          formProps={scidQuestFormProps}
          templateSpec={scidQuestTemplate}
        />
      </div>
      <div
        aria-hidden={mode !== "orkgPreview"}
        className={
          mode === "orkgPreview" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"
        }
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
        fieldOverrides={previewStructure?.fieldOverrides ?? {}}
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
