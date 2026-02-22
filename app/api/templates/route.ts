import { NextRequest, NextResponse } from "next/server";

import { listTemplates } from "@/lib/orkg-templates";

/**
 * GET /api/templates?q=search&page=0&size=20
 * List/search ORKG templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "0", 10);
    const size = Math.min(parseInt(searchParams.get("size") ?? "20", 10), 50);

    const result = await listTemplates({
      q: q || undefined,
      page: Number.isNaN(page) ? 0 : page,
      size: Number.isNaN(size) ? 20 : size,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Templates list error:", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to list templates",
      },
      { status: 500 },
    );
  }
}
