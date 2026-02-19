import type { OrkgValueType } from "@/types/template";

import { NextRequest, NextResponse } from "next/server";

import {
  ORKG_SPARQL_ENDPOINT,
  buildValueTypeQuery,
  parseValueTypeResult,
  type SparqlResult,
} from "@/lib/sparql/orkg-queries";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, predicateId } = body as {
      query?: string;
      predicateId?: string;
    };

    let sparqlQuery: string | null | undefined = query;

    if (!sparqlQuery && predicateId) {
      sparqlQuery = buildValueTypeQuery(predicateId);
    }

    if (!sparqlQuery) {
      return NextResponse.json(
        { error: "Missing query or predicateId" },
        { status: 400 },
      );
    }

    const response = await fetch(ORKG_SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query: sparqlQuery }).toString(),
    });

    if (!response.ok) {
      const text = await response.text();

      return NextResponse.json(
        { error: `ORKG SPARQL error: ${response.status}`, details: text },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("application/json") &&
      !contentType.includes("sparql-results+json")
    ) {
      return NextResponse.json(
        {
          error:
            "ORKG returned non-JSON response (may be rate limited or unavailable)",
        },
        { status: 502 },
      );
    }

    const result: SparqlResult = await response.json();

    return NextResponse.json(result);
  } catch (err) {
    // eslint-disable-next-line no-console -- server-side error logging for API route
    console.error("SPARQL proxy error:", err);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SPARQL request failed" },
      { status: 500 },
    );
  }
}

/** GET handler for value type detection by predicateId */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const predicateId = searchParams.get("predicateId");

  if (!predicateId) {
    return NextResponse.json({ error: "Missing predicateId" }, { status: 400 });
  }

  const query = buildValueTypeQuery(predicateId);

  if (!query) {
    return NextResponse.json(
      { valueType: "Literal" as OrkgValueType },
      { status: 200 },
    );
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
      return NextResponse.json(
        { valueType: "Literal" as OrkgValueType },
        { status: 200 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("application/json") &&
      !contentType.includes("sparql-results+json")
    ) {
      return NextResponse.json(
        { valueType: "Literal" as OrkgValueType },
        { status: 200 },
      );
    }

    const result: SparqlResult = await response.json();
    const valueType = parseValueTypeResult(result);

    return NextResponse.json({ valueType });
  } catch {
    return NextResponse.json(
      { valueType: "Literal" as OrkgValueType },
      { status: 200 },
    );
  }
}
