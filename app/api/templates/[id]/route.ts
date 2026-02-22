import { NextRequest, NextResponse } from "next/server";

import {
  loadTemplateFlowByID,
  generateTemplateMapping,
} from "@/lib/orkg-templates";
import { enrichTemplateMapping } from "@/lib/preprocessing/enrich-template-mapping";

/**
 * GET /api/templates/[id]
 * Load template flow by ID and return enriched mapping for questionnaire
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 },
      );
    }

    const flow = await loadTemplateFlowByID(id);
    const rawMapping = generateTemplateMapping(flow.allTemplates, flow.main.id);
    const enrichedMapping = await enrichTemplateMapping(rawMapping);

    return NextResponse.json({
      templateId: id,
      label: flow.main.label,
      description: flow.main.description,
      mapping: enrichedMapping,
    });
  } catch (err) {
    console.error("Template load error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load template";
    const status =
      message.includes("not found") || message.includes("Template not found")
        ? 404
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
