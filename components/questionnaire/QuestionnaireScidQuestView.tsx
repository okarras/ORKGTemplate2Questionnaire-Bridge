"use client";

import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";

import Link from "next/link";
import { Button } from "@heroui/button";
import { ResearchQuestionnaireApp } from "scidquest";

import { ScidQuestProviders } from "./ScidQuestProviders";

interface QuestionnaireScidQuestViewProps {
  templateSpec: ScidQuestQuestionnaireTemplate;
  label: string;
}

export function QuestionnaireScidQuestView({
  templateSpec,
  label,
}: QuestionnaireScidQuestViewProps) {
  return (
    <section className="flex flex-col flex-grow py-4 w-full h-full overflow-x-hidden overflow-y-hidden">
      <div className="flex flex-col gap-4 px-6 md:px-10 mb-2">
        <div className="flex items-center justify-between gap-4">
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
        <h1 className="text-2xl font-bold text-primary">{label}</h1>
      </div>

      <ScidQuestProviders>
        <div className="flex-grow w-full flex flex-col min-w-0 overflow-hidden h-[calc(100vh-200px)] min-h-[600px]">
          <ResearchQuestionnaireApp
            {...({
              templateSpec,
              layout: "split",
              showPdfViewer: true,
            } as React.ComponentProps<typeof ResearchQuestionnaireApp>)}
          />
        </div>
      </ScidQuestProviders>
    </section>
  );
}
