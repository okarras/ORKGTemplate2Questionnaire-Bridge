"use client";

import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";
import dynamic from "next/dynamic";

const QuestionnaireScidQuestView = dynamic(
  () =>
    import("./QuestionnaireScidQuestView").then(
      (m) => m.QuestionnaireScidQuestView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="py-8 text-default-500">Loading questionnaire…</div>
    ),
  },
);

interface QuestionnaireViewLoaderProps {
  label: string;
  templateSpec: ScidQuestQuestionnaireTemplate;
}

export function QuestionnaireViewLoader({
  label,
  templateSpec,
}: QuestionnaireViewLoaderProps) {
  return (
    <QuestionnaireScidQuestView label={label} templateSpec={templateSpec} />
  );
}
