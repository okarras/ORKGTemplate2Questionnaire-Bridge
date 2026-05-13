"use client";

import type { ComponentProps } from "react";
import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";

import { QuestionnaireForm } from "./QuestionnaireForm";
import { QuestionnaireScidQuestView } from "./QuestionnaireScidQuestView";

type QuestionnaireFormProps = ComponentProps<typeof QuestionnaireForm>;

interface QuestionnaireViewLoaderProps {
  formProps: QuestionnaireFormProps;
  templateSpec: ScidQuestQuestionnaireTemplate | null;
}

export function QuestionnaireViewLoader({
  formProps,
  templateSpec,
}: QuestionnaireViewLoaderProps) {
  return (
    <QuestionnaireScidQuestView
      formProps={formProps}
      templateSpec={templateSpec}
    />
  );
}
