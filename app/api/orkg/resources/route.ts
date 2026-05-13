import { NextRequest, NextResponse } from "next/server";

import {
  normalizeOrkgResourceIri,
  orkgResourceIriTail,
} from "@/lib/orkg-resource-ids";
import {
  ORKG_SPARQL_ENDPOINT,
  buildResourcesQuery,
  type SparqlResult,
} from "@/lib/sparql/orkg-queries";

export interface OrkgResourceOption {
  id: string;
  label: string;
  creator?: string;
}

/** Normalize class id to short `C123` form for ORKG REST `include=` and SPARQL `orkgc:`. */
function orkgClassShortId(classId: string): string {
  const t = classId.trim();
  const tail = t.includes("/") ? (t.split("/").pop() ?? t) : t;
  const m = tail.match(/^C(\d+)$/i);

  if (m) return `C${m[1]}`;

  return tail;
}

type RestResourceItem = {
  id: string;
  label: string;
  created_by?: string;
};

/** Map ORKG REST `content[]` rows to options with resolved contributor display names. */
async function mapRestResourceItemsToOptionsWithCreators(
  items: RestResourceItem[],
): Promise<OrkgResourceOption[]> {
  if (items.length === 0) return [];

  const creatorIds = Array.from(
    new Set(
      items
        .map((i) => i.created_by)
        .filter(
          (id): id is string =>
            Boolean(id) && id !== "00000000-0000-0000-0000-000000000000",
        ),
    ),
  );

  const creatorsMap = new Map<string, string>();

  await Promise.all(
    creatorIds.map(async (cId) => {
      try {
        const cRes = await fetch(
          `https://orkg.org/api/contributors/${encodeURIComponent(cId)}`,
        );

        if (cRes.ok) {
          const cData = (await cRes.json()) as { display_name?: string };

          creatorsMap.set(cId, cData.display_name ?? "Unknown");
        }
      } catch {
        /* ignore */
      }
    }),
  );

  return items.map((i) => ({
    id: `http://orkg.org/orkg/resource/${i.id}`,
    label: i.label,
    creator:
      creatorsMap.get(i.created_by ?? "") ||
      (i.created_by === "00000000-0000-0000-0000-000000000000"
        ? "System"
        : "Unknown"),
  }));
}

/**
 * SPARQL rows lack `created_by`; resolve creators for up to `maxFetches` distinct
 * resource tails (R…) to keep ORKG traffic bounded on large result sets.
 */
async function enrichSparqlResourceOptionsWithCreators(
  resources: OrkgResourceOption[],
  maxFetches: number,
): Promise<OrkgResourceOption[]> {
  if (maxFetches <= 0 || resources.length === 0) return resources;
  const tailsOrdered: string[] = [];
  const seen = new Set<string>();

  for (const r of resources) {
    if (r.creator && r.creator !== "Unknown") continue;

    const rawTail = orkgResourceIriTail(normalizeOrkgResourceIri(r.id));
    const m = rawTail.match(/^R(\d+)$/i);

    if (!m) continue;

    const tail = `R${m[1]}`;

    if (seen.has(tail)) continue;
    seen.add(tail);
    tailsOrdered.push(tail);
    if (tailsOrdered.length >= maxFetches) break;
  }

  if (tailsOrdered.length === 0) return resources;

  const creatorByTail = new Map<string, string>();
  const BATCH = 12;

  for (let i = 0; i < tailsOrdered.length; i += BATCH) {
    const chunk = tailsOrdered.slice(i, i + BATCH);

    await Promise.all(
      chunk.map(async (tail) => {
        try {
          const res = await fetch(
            `https://orkg.org/api/resources/${encodeURIComponent(tail)}`,
          );

          if (!res.ok) return;

          const data = (await res.json()) as { created_by?: string };
          const uid = data.created_by;

          if (!uid || uid === "00000000-0000-0000-0000-000000000000") {
            creatorByTail.set(tail, "System");

            return;
          }

          const cRes = await fetch(
            `https://orkg.org/api/contributors/${encodeURIComponent(uid)}`,
          );

          if (cRes.ok) {
            const cData = (await cRes.json()) as { display_name?: string };

            creatorByTail.set(tail, cData.display_name ?? "Unknown");
          } else {
            creatorByTail.set(tail, "Unknown");
          }
        } catch {
          /* ignore */
        }
      }),
    );
  }

  if (creatorByTail.size === 0) return resources;

  return resources.map((r) => {
    const m = orkgResourceIriTail(normalizeOrkgResourceIri(r.id)).match(
      /^R(\d+)$/i,
    );

    if (!m) return r;

    const tail = `R${m[1]}`;
    const c = creatorByTail.get(tail);

    if (!c) return r;
    if (r.creator && r.creator !== "Unknown") return r;

    return { ...r, creator: c };
  });
}

async function fetchResourcesViaSparql(
  predicateId: string,
  options: { classId?: string; limit: number },
): Promise<OrkgResourceOption[]> {
  const classNorm = options.classId
    ? orkgClassShortId(options.classId)
    : undefined;
  const query = buildResourcesQuery(predicateId || "", {
    classId: classNorm,
    limit: options.limit,
  });

  if (!query) return [];

  try {
    const response = await fetch(ORKG_SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (!response.ok) return [];

    const contentType = response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("application/json") &&
      !contentType.includes("sparql-results+json")
    ) {
      return [];
    }

    const result: SparqlResult = await response.json();
    const bindings = result?.results?.bindings ?? [];

    const mapped = bindings.map((b) => {
      const iri = b.o?.value ?? "";
      const label = b.oLabel?.value ?? iri.split("/").pop() ?? iri;

      return { id: iri, label };
    });

    if (mapped.length === 0) return [];

    return enrichSparqlResourceOptionsWithCreators(
      mapped,
      Math.min(120, mapped.length),
    );
  } catch {
    return [];
  }
}

/**
 * List resources by class via ORKG REST (with creator display names).
 */
async function fetchResourcesRestByClass(
  classIdForInclude: string,
  effectiveLimit: number,
): Promise<OrkgResourceOption[]> {
  const classIdClean = orkgClassShortId(classIdForInclude);

  try {
    const restRes = await fetch(
      `https://orkg.org/api/resources/?include=${encodeURIComponent(classIdClean)}&size=${Math.min(effectiveLimit, 1000)}&sort=created_at,desc`,
    );

    if (!restRes.ok) return [];

    const data = await restRes.json();
    const items = (data.content || []) as RestResourceItem[];

    return mapRestResourceItemsToOptionsWithCreators(items);
  } catch {
    return [];
  }
}

/**
 * GET /api/orkg/resources?predicateId=P181002&classId=C121018
 * GET /api/orkg/resources?q=keyword&classId=C121018 (optional) — ORKG label search
 * Returns list of ORKG resources (IRIs) for user to choose from.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const predicateId = searchParams.get("predicateId");
  const classId = searchParams.get("classId");
  const qRaw = searchParams.get("q");
  const q = qRaw?.trim() ?? "";
  const limitParam = searchParams.get("limit");

  const limit = limitParam ? parseInt(limitParam, 10) : 500;
  const effectiveLimit = Number.isNaN(limit)
    ? 500
    : Math.min(Math.max(limit, 1), 5000);

  /** Live label search on ORKG (used while typing in resource autoselect). */
  if (q.length >= 2) {
    const searchSize = Math.min(Math.max(effectiveLimit, 1), 50);
    const classIdClean = classId ? orkgClassShortId(classId) : undefined;
    const url = new URL("https://orkg.org/api/resources");

    url.searchParams.set("q", q);
    url.searchParams.set("size", String(searchSize));
    url.searchParams.set("sort", "label");
    if (classIdClean) url.searchParams.set("include", classIdClean);

    try {
      const restRes = await fetch(url.toString());

      if (restRes.ok) {
        const data = await restRes.json();
        const items = (data.content || []) as RestResourceItem[];
        const resources =
          await mapRestResourceItemsToOptionsWithCreators(items);

        return NextResponse.json({ resources });
      }
    } catch (e) {
      // eslint-disable-next-line no-console -- server-side diagnostic
      console.error("ORKG resource search failed", e);
    }

    return NextResponse.json({ resources: [] });
  }

  if (!predicateId && !classId) {
    return NextResponse.json(
      {
        error:
          "Missing predicateId or classId (or use q= with at least 2 characters)",
      },
      { status: 400 },
    );
  }

  /**
   * Predicate + class: prefer SPARQL (objects of predicate typed as class).
   * If that yields nothing (common for template fields with sparse graph usage),
   * fall back to REST class listing — same behaviour as before the SPARQL-only change.
   */
  if (predicateId && classId) {
    const classShort = orkgClassShortId(classId);
    let resources = await fetchResourcesViaSparql(predicateId, {
      classId: classShort,
      limit: effectiveLimit,
    });

    if (resources.length === 0) {
      resources = await fetchResourcesRestByClass(classShort, effectiveLimit);
    }

    return NextResponse.json({ resources });
  }

  /** Class-only: REST list with creator info; fall back to SPARQL instances of class. */
  if (classId && !predicateId) {
    const resources = await fetchResourcesRestByClass(classId, effectiveLimit);

    if (resources.length > 0) {
      return NextResponse.json({ resources });
    }

    const sparql = await fetchResourcesViaSparql("", {
      classId: orkgClassShortId(classId),
      limit: effectiveLimit,
    });

    return NextResponse.json({ resources: sparql });
  }

  /** Predicate-only (no class): SPARQL distinct objects. */
  if (predicateId) {
    const resources = await fetchResourcesViaSparql(predicateId, {
      limit: effectiveLimit,
    });

    return NextResponse.json({ resources });
  }

  return NextResponse.json({ resources: [] });
}
