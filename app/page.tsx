import templateMapping from "@/template-mapping-20260215-193915.json";
import { TemplatePropertyRenderer } from "@/components/questionnaire";
import { enrichTemplateMapping } from "@/lib/preprocessing/enrich-template-mapping";
import type { TemplateMapping, EnrichedTemplateMapping } from "@/types/template";

export default async function Home() {
  const rawMapping = templateMapping as TemplateMapping;
  const mapping: EnrichedTemplateMapping =
    await enrichTemplateMapping(rawMapping);

  return (
    <section className="flex flex-col gap-8 py-8 md:py-10">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary md:text-5xl">
          dynamic questionnaire generation
        </h1>
        <p className="max-w-2xl text-lg text-default-500 mx-auto">
          A dynamic questionnaire generation system for ORKG templates.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <h2 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
          Templates
        </h2>
        <div className="flex flex-col gap-6">
          {Object.entries(mapping).map(([propertyId, property]) => (
            <TemplatePropertyRenderer
              key={propertyId}
              propertyId={propertyId}
              property={property}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
