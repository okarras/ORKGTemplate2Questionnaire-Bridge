"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@heroui/button";

import { QuestionnairePageModeSwitcher } from "./QuestionnairePageModeSwitcher";

import {
  RAW_TEMPLATE_SESSION_KEY,
  type RawTemplatePayload,
  parseStoredRawTemplatePayload,
} from "@/lib/raw-template";

export function RawTemplateQuestionnaireLoader() {
  const [payload, setPayload] = useState<RawTemplatePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseStoredRawTemplatePayload(
      sessionStorage.getItem(RAW_TEMPLATE_SESSION_KEY),
    );

    if (!parsed) {
      setLoadError(
        "Raw template data is missing or invalid. Please paste JSON again from the templates page.",
      );

      return;
    }

    setPayload(parsed);
  }, []);

  if (loadError) {
    return (
      <section className="flex flex-col gap-4 py-8">
        <Button as={Link} color="primary" href="/" size="sm" variant="flat">
          ← Back to templates
        </Button>
        <h1 className="text-2xl font-bold text-primary">Raw JSON template</h1>
        <p className="text-danger">{loadError}</p>
      </section>
    );
  }

  if (!payload) {
    return (
      <section className="flex flex-col gap-3 py-8">
        <h1 className="text-2xl font-bold text-primary">
          Loading raw template…
        </h1>
      </section>
    );
  }

  return (
    <QuestionnairePageModeSwitcher
      label={payload.label}
      mapping={payload.mapping}
      targetClassId={payload.targetClassId}
      targetClassLabel={payload.targetClassLabel}
      templateId={payload.templateId}
    />
  );
}
