"use client";

import type { TemplateListItem } from "@/lib/orkg-templates";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";

import { getOrkgResourceLink } from "@/lib/orkg-links";

const ORKG_TEMPLATES_URL = "https://orkg.org/templates";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function TemplateSelector() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [directId, setDirectId] = useState("");
  const [loadingQId, setLoadingQId] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  const fetchTemplates = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      if (q.trim()) params.set("q", q.trim());
      params.set("page", "0");
      params.set("size", "24");
      const res = await fetch(`/api/templates?${params}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        throw new Error(
          data.error ?? `Failed to load templates (${res.status})`,
        );
      }
      const data = await res.json();

      setTemplates(data.content ?? []);
      setTotal(data.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
      setTemplates([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates(debouncedQuery);
  }, [debouncedQuery, fetchTemplates]);

  const handleDirectId = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = directId.trim();

    if (!raw) return;
    const match = raw.match(/R\d+/);
    const templateId = match ? match[0] : raw;

    setLoadingQId(templateId);
    router.push(`/questionnaire/${templateId}`);
  };

  const handleStartQuestionnaire = (id: string) => {
    setLoadingQId(id);
    router.push(`/questionnaire/${id}`);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-primary">
          Search for a template
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            aria-label="Search templates"
            className="flex-1"
            classNames={{
              inputWrapper:
                "border-default-200 data-[focus=true]:border-primary shadow-sm",
            }}
            placeholder="Search by label (e.g. NLP, contribution...)"
            startContent={
              loading ? (
                <Spinner color="primary" size="sm" />
              ) : (
                <svg
                  className="w-5 h-5 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              )
            }
            value={query}
            onValueChange={setQuery}
          />
        </div>

        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={handleDirectId}
        >
          <Input
            className="flex-1"
            classNames={{
              inputWrapper:
                "border-default-200 data-[focus=true]:border-primary",
            }}
            name="templateId"
            placeholder="Or enter template ID (e.g. R12002)"
            value={directId}
            onValueChange={setDirectId}
          />
          <Button
            className="font-medium"
            color="primary"
            isLoading={loadingQId === directId.trim()}
            type="submit"
            variant="flat"
          >
            Open questionnaire
          </Button>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-danger">
          <p className="text-sm">{error}</p>
          <p className="mt-2 text-xs text-default-500">
            You can still try a template ID directly above, or browse{" "}
            <a
              className="underline hover:text-primary"
              href={ORKG_TEMPLATES_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              orkg.org/templates
            </a>{" "}
            to find IDs.
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground">
            {debouncedQuery ? "Results" : "Featured templates"}
          </h3>
          {total > 0 && (
            <span className="text-sm text-default-500">
              {total} template{total !== 1 ? "s" : ""} found
            </span>
          )}
        </div>

        {loading && templates.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner color="primary" size="lg" />
          </div>
        ) : templates.length === 0 ? (
          <Card className="border border-dashed border-default-300">
            <CardBody className="py-12 text-center">
              <p className="text-default-500">
                {debouncedQuery
                  ? "No templates match your search."
                  : "No templates available. Try searching or enter a template ID."}
              </p>
              <p className="mt-2 text-sm text-default-400">
                Browse templates on{" "}
                <a
                  className="text-primary hover:underline"
                  href={ORKG_TEMPLATES_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  orkg.org/templates
                </a>
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card
                key={t.id}
                className="border border-default-200 hover:border-primary/40 transition-colors"
              >
                <CardBody className="gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-foreground line-clamp-2">
                      {t.label}
                    </h4>
                    <Chip color="default" size="sm" variant="flat">
                      {t.id}
                    </Chip>
                  </div>
                  {t.description && (
                    <p className="text-sm text-default-500 line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      color="primary"
                      isLoading={loadingQId === t.id}
                      size="sm"
                      variant="flat"
                      onPress={() => handleStartQuestionnaire(t.id)}
                    >
                      {loadingQId === t.id
                        ? "Loading..."
                        : "Start questionnaire"}
                    </Button>
                    {getOrkgResourceLink(t.id) && (
                      <Button
                        as="a"
                        href={getOrkgResourceLink(t.id)!}
                        rel="noopener noreferrer"
                        size="sm"
                        target="_blank"
                        variant="flat"
                      >
                        View on ORKG
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
