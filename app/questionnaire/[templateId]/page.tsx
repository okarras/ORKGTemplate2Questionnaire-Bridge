import type { EnrichedTemplateMapping } from "@/types/template";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@heroui/button";

import {
  loadTemplateFlowByID,
  generateTemplateMapping,
} from "@/lib/orkg-templates";
import { enrichTemplateMapping } from "@/lib/preprocessing/enrich-template-mapping";
import { QuestionnaireForm } from "@/components/questionnaire";

interface QuestionnairePageProps {
  params: Promise<{ templateId: string }>;
}

export default async function QuestionnairePage({
  params,
}: QuestionnairePageProps) {
  const { templateId } = await params;

  if (!templateId) {
    notFound();
  }

  let mapping: EnrichedTemplateMapping;
  let label: string;

  try {
    const flow = await loadTemplateFlowByID(templateId);
    const rawMapping = generateTemplateMapping(flow.allTemplates, flow.main.id);

    label = flow.main.label;
    try {
      mapping = await enrichTemplateMapping(rawMapping);
    } catch {
      // Fallback: use raw mapping without SPARQL value types (defaults to text)
      mapping = rawMapping as EnrichedTemplateMapping;
    }
  } catch (err) {
    console.error("Questionnaire load error:", err);
    notFound();
  }

  const entries = Object.entries(mapping);

  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-8 py-8">
        <div className="flex flex-col gap-4">
          <Button as={Link} color="primary" href="/" size="sm" variant="flat">
            ← Back to templates
          </Button>
          <h1 className="text-2xl font-bold text-primary">{label}</h1>
          <p className="text-default-500">
            This template has no properties to display.
          </p>
        </div>
      </section>
    );
  }

  return (
    <QuestionnaireForm
      backHref="/"
      label={label}
      mapping={mapping}
      templateId={templateId}
    />
  );
}
