"use client";

import type { ComponentProps, SetStateAction } from "react";
import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";
import type { FormValue } from "./questionnaire-form-types";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";

import { QuestionnaireForm } from "./QuestionnaireForm";
import { defaultScidQuestPdfTextExtractor } from "@/lib/scidquest-pdf-text-extractor";
import { ensureReactPdfWorkerConfigured } from "@/lib/pdf-worker";
import { ScidQuestProviders } from "./ScidQuestProviders";

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
  const [ResearchQuestionnaireApp, setResearchQuestionnaireApp] =
    useState<React.ComponentType<any> | null>(null);
  const [PdfFileTabsConnected, setPdfFileTabsConnected] =
    useState<React.ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mod = await import("@orkg/scidquest");

        await ensureReactPdfWorkerConfigured();

        if (!cancelled) {
          setResearchQuestionnaireApp(() => mod.ResearchQuestionnaireApp);
          if (mod.PdfFileTabsConnected) {
            setPdfFileTabsConnected(() => mod.PdfFileTabsConnected);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load ScidQuest",
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const formValuesRef = useRef(formProps.values);
  formValuesRef.current = formProps.values;
  const onValuesChangeRef = useRef(formProps.onValuesChange);
  onValuesChangeRef.current = formProps.onValuesChange;

  const setAnswers = useCallback(
    (next: SetStateAction<Record<string, unknown>>) => {
      const prev = formValuesRef.current as Record<string, unknown>;
      const resolved =
        typeof next === "function"
          ? (next as (p: Record<string, unknown>) => Record<string, unknown>)(prev)
          : next;
      onValuesChangeRef.current?.(resolved as Record<string, FormValue>);
    },
    [],
  );

  const pdfTextExtractor = useMemo(() => defaultScidQuestPdfTextExtractor, []);

  const questionnaireSlot = useCallback(
    (_ctx: unknown) => <QuestionnaireForm {...formProps} />,
    [formProps],
  );

  if (loadError) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <p className="text-danger">Failed to load ScidQuest: {loadError}</p>
        <Button as={Link} color="primary" href="/" size="sm" variant="flat">
          ← Back to templates
        </Button>
      </section>
    );
  }

  if (!templateSpec || !ResearchQuestionnaireApp) {
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
          {/* File tabs from library — rendered OUTSIDE ResearchQuestionnaireApp
              so they survive its remounts. Uses external store. */}
          {PdfFileTabsConnected && <PdfFileTabsConnected />}

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
