import { NextRequest, NextResponse } from "next/server";
import {
  ORKG_SPARQL_ENDPOINT,
  buildResourcesQuery,
  type SparqlResult,
} from "@/lib/sparql/orkg-queries";

export interface OrkgResourceOption {
  id: string;
  label: string;
}

/**
 * GET /api/orkg/resources?predicateId=P181002&classId=C121018
 * Returns list of ORKG resources (IRIs) for user to choose from.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const predicateId = searchParams.get("predicateId");
  const classId = searchParams.get("classId");
  const limitParam = searchParams.get("limit");

  if (!predicateId && !classId) {
    return NextResponse.json(
      { error: "Missing predicateId or classId" },
      { status: 400 }
    );
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 500;
  const query = buildResourcesQuery(predicateId ?? "", {
    classId: classId ?? undefined,
    limit: Number.isNaN(limit) ? 500 : Math.min(limit, 1000),
  });
  if (!query) {
    return NextResponse.json({ resources: [] });
  }

  try {
    const response = await fetch(ORKG_SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (!response.ok) {
      return NextResponse.json({ resources: [] });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("sparql-results+json")) {
      return NextResponse.json({ resources: [] });
    }

    const result: SparqlResult = await response.json();
    const bindings = result?.results?.bindings ?? [];
    const resources: OrkgResourceOption[] = bindings.map((b) => {
      const iri = b.o?.value ?? "";
      const label = b.oLabel?.value ?? iri.split("/").pop() ?? iri;
      return { id: iri, label };
    });

    return NextResponse.json({ resources });
  } catch {
    return NextResponse.json({ resources: [] });
  }
}
