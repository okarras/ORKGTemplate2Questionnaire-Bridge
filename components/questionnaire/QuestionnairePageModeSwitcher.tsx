"use client";

import type { EnrichedTemplateMapping } from "@/types/template";
import type { ScidQuestQuestionnaireTemplate } from "@/lib/orkg-to-scidquest-adapter";

import { useState } from "react";
import { Button } from "@heroui/button";

import { QuestionnaireForm } from "./QuestionnaireForm";
import { QuestionnaireViewLoader } from "./QuestionnaireViewLoader";

type Mode = "form" | "scidquest";

export function QuestionnairePageModeSwitcher({
  templateId,
  label,
  mapping,
  scidQuestTemplate,
}: {
  templateId: string;
  label: string;
  mapping: EnrichedTemplateMapping;
  scidQuestTemplate: ScidQuestQuestionnaireTemplate;
}) {
  const [mode, setMode] = useState<Mode>("form");

  return (
    <section
      className="w-full h-[calc(100vh-140px)] overflow-x-hidden overflow-y-auto"
    >
      <div className="flex items-center justify-end gap-3 pb-4 px-6 md:px-10">
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
      </div>

      {mode === "form" ? (
        <QuestionnaireForm
          backHref="/"
          initialEditMode={false}
          label={label}
          mapping={mapping}
          templateId={templateId}
        />
      ) : (
        <div className="w-full h-full flex flex-col">
          <QuestionnaireViewLoader
            label={label}
            templateSpec={scidQuestTemplate}
          />
        </div>
      )}
    </section>
  );
}
