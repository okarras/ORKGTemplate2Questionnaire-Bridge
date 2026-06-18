import type { Metadata } from "next";

import { TemplateSelector } from "@/components/TemplateSelector";
import { SiteLogo } from "@/components/site-logo";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Templates",
};

export default function Home() {
  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 md:py-10 flex flex-col gap-8 flex-grow">
      <div className="flex flex-col gap-4 text-center">
        <SiteLogo className="mx-auto" size={120} />
        <h1 className="text-4xl font-bold tracking-tight text-primary md:text-5xl">
          Dynamic questionnaire generation
        </h1>
        <p className="max-w-2xl text-lg text-default-500 mx-auto">
          Select or search for an ORKG template, then fill out the generated
          questionnaire.
        </p>
      </div>

      <TemplateSelector />
      <Footer />
    </section>
  );
}
