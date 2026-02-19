import { NextRequest, NextResponse } from "next/server";
import { enrichTemplateMapping } from "@/lib/preprocessing/enrich-template-mapping";
import type { TemplateMapping } from "@/types/template";

/**
 * POST /api/preprocess
 * Body: { mapping: TemplateMapping }
 * Returns: EnrichedTemplateMapping with valueType per property
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapping } = body as { mapping: TemplateMapping };

    if (!mapping || typeof mapping !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid mapping" },
        { status: 400 }
      );
    }

    const enriched = await enrichTemplateMapping(mapping);
    return NextResponse.json(enriched);
  } catch (err) {
    console.error("Preprocessing error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Preprocessing failed",
      },
      { status: 500 }
    );
  }
}
