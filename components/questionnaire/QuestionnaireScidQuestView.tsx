"use client";

import type { ComponentProps, SetStateAction } from "react";
import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";
import type { FormValue } from "./questionnaire-form-types";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";

import { QuestionnaireForm } from "./QuestionnaireForm";

import { defaultScidQuestPdfTextExtractor } from "@/lib/scidquest-pdf-text-extractor";
import { ensureReactPdfWorkerConfigured } from "@/lib/pdf-worker";

const ScidQuestProviders = dynamic(
  () =>
    import("./ScidQuestProviders").then((mod) => ({
      default: mod.ScidQuestProviders,
    })),
  { ssr: false },
);

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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mod = await import("@orkg/scidquest");

        await ensureReactPdfWorkerConfigured();

        if (!cancelled) {
          setResearchQuestionnaireApp(() => mod.ResearchQuestionnaireApp);
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

    return () => {
      cancelled = true;
    };
  }, []);

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
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
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
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
            templateSpec={templateSpec}
          />
        </ScidQuestProviders>
      </div>
    </section>
  );
}
