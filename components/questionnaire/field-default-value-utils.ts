import { dedupeOrkgResourceIris } from "@/lib/orkg-resource-ids";

/** Split stored multi-defaults (`|` preferred; `,` supported for older drafts). */
export function parseStoredMultiDefault(value: string): string[] {
  if (!value.trim()) return [];

  return dedupeOrkgResourceIris(
    value
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function formatStoredMultiDefault(values: string[]): string {
  return dedupeOrkgResourceIris(values).join("|");
}
