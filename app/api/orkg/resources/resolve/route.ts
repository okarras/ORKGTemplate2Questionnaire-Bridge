import { NextRequest, NextResponse } from "next/server";

import {
  normalizeOrkgResourceIri,
  orkgResourceIriTail,
} from "@/lib/orkg-resource-ids";

/**
 * GET /api/orkg/resources/resolve?ids=R1,R2
 * Fetches labels for ORKG resources (best-effort) for ids not in the SPARQL dropdown list.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam?.trim()) {
    return NextResponse.json({ labels: {} as Record<string, string> });
  }

  const rawIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const labels: Record<string, string> = {};

  await Promise.all(
    rawIds.map(async (id) => {
      const canonical = normalizeOrkgResourceIri(id);
      const tail = orkgResourceIriTail(canonical);

      try {
        const res = await fetch(
          `https://orkg.org/api/resources/${encodeURIComponent(tail)}`,
        );

        if (res.ok) {
          const data = (await res.json()) as { label?: string };

          if (data.label) {
            labels[canonical] = data.label;
            labels[tail] = data.label;
            labels[id] = data.label;
          }
        }
      } catch {
        /* ignore */
      }
    }),
  );

  return NextResponse.json({ labels });
}
