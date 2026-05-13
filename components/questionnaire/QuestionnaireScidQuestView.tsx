"use client";

import type { ComponentProps, SetStateAction } from "react";
import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";
import type { FormValue } from "./questionnaire-form-types";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { ResearchQuestionnaireApp } from "@orkg/scidquest";

import { QuestionnaireForm } from "./QuestionnaireForm";
import { ScidQuestProviders } from "./ScidQuestProviders";

import { defaultScidQuestPdfTextExtractor } from "@/lib/scidquest-pdf-text-extractor";

type QuestionnaireFormProps = ComponentProps<typeof QuestionnaireForm>;

interface QuestionnaireScidQuestViewProps {
  formProps: QuestionnaireFormProps;
  templateSpec: ScidQuestQuestionnaireTemplate | null;
}

/**
 * Host ORKG {@link QuestionnaireForm} embedded in ScidQuest's
 * {@link ResearchQuestionnaireApp} (PDF upload, extraction, structured document, workspace state).
 */
export function QuestionnaireScidQuestView({
  formProps,
  templateSpec,
}: QuestionnaireScidQuestViewProps) {
  const setAnswers = useCallback(
    (next: SetStateAction<Record<string, unknown>>) => {
      const prev = formProps.values as Record<string, unknown>;
      const resolved =
        typeof next === "function"
          ? (next as (p: Record<string, unknown>) => Record<string, unknown>)(
              prev,
            )
          : next;

      formProps.onValuesChange?.(resolved as Record<string, FormValue>);
    },
    [formProps.values, formProps.onValuesChange],
  );

  const pdfTextExtractor = useMemo(() => defaultScidQuestPdfTextExtractor, []);

  const questionnaireSlot = useCallback(
    (_ctx: unknown) => <QuestionnaireForm {...formProps} />,
    [formProps],
  );

  if (!templateSpec) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <Spinner label="Preparing ScidQuest template…" />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 shrink-0 px-6 pt-4 md:px-10">
        <Button
          as={Link}
          className="w-fit"
          color="primary"
          href="/"
          size="sm"
          variant="flat"
        >
          ← Back to templates
        </Button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-6 pb-6 md:px-10">
        <ScidQuestProviders>
          <ResearchQuestionnaireApp
            answers={formProps.values as Record<string, unknown>}
            pdfTextExtractor={pdfTextExtractor}
            questionnaireSlot={questionnaireSlot}
            setAnswers={setAnswers}
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
            templateSpec={templateSpec}
          />
        </ScidQuestProviders>
      </div>
    </section>
  );
}
