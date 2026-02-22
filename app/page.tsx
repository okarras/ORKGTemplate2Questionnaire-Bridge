import { TemplateSelector } from "@/components/TemplateSelector";
import { SiteLogo } from "@/components/site-logo";

export default function Home() {
  return (
    <section className="flex flex-col gap-8 py-8 md:py-10">
      <div className="flex flex-col gap-4 text-center">
        <SiteLogo size={120} className="mx-auto" />
        <h1 className="text-4xl font-bold tracking-tight text-primary md:text-5xl">
          Dynamic questionnaire generation
        </h1>
        <p className="max-w-2xl text-lg text-default-500 mx-auto">
          Select or search for an ORKG template, then fill out the generated
          questionnaire.
        </p>
      </div>

      <TemplateSelector />
    </section>
  );
}
