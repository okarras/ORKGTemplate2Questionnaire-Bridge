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
    <section className="flex flex-col flex-grow gap-6 py-8 w-full h-full">
      <div className="flex flex-col gap-4">
        <Button as={Link} color="primary" href="/" size="sm" variant="flat">
          ← Back to templates
        </Button>
        <h1 className="text-2xl font-bold text-primary">{label}</h1>
      </div>
      {/* Full-width breakout so split PDF + form use full viewport */}
      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
        <ScidQuestProviders>
          <div className="min-h-[600px] h-[calc(100vh-160px)] w-full max-w-full flex flex-col min-w-0 px-6">
            <ResearchQuestionnaireApp
              {...({
                templateSpec,
                layout: "split",
                showPdfViewer: true,
              } as React.ComponentProps<typeof ResearchQuestionnaireApp>)}
            />
          </div>
        </ScidQuestProviders>
      </div>
    </section>
  );
}
