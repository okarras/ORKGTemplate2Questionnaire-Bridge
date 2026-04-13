import type { AnswerTriple } from "@/lib/orkg-instance-builder";

import { NextRequest, NextResponse } from "next/server";

const SANDBOX_API = "https://sandbox.orkg.org/api";

interface SubmitRequestBody {
  /** Bearer token from the /api/orkg-sandbox/auth step */
  token: string;
  /** ORKG template ID (e.g. "R1234567") */
  templateId: string;
  /** Target class ID (e.g. "C12345") — applied as the resource class */
  targetClassId?: string;
  /** Human-readable label for the new resource */
  resourceLabel: string;
  /** Flat predicate→value triples to create as statements */
  answers: AnswerTriple[];
}

/**
 * POST /api/orkg-sandbox/submit
 *
 * Orchestrates the full ORKG sandbox instance creation:
 *   1. POST /api/resources  → create root resource
 *   2. For literal values: POST /api/literals
 *   3. For each triple: POST /api/statements
 *
 * Returns { resourceId, sandboxUrl, statementsCreated }.
 */
export async function POST(request: NextRequest) {
  let body: SubmitRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, templateId, targetClassId, resourceLabel, answers } = body;

  if (!token || !resourceLabel || !templateId) {
    return NextResponse.json(
      { error: "token, templateId, and resourceLabel are required" },
      { status: 400 },
    );
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ─── Step 1: Create the root resource ────────────────────────────────────
  const classes = targetClassId ? [targetClassId] : [];

  let resourceId: string;

  try {
    const createRes = await fetch(`${SANDBOX_API}/resources`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        label: resourceLabel,
        classes,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");

      return NextResponse.json(
        {
          error: "Failed to create resource",
          detail: errText || `Status ${createRes.status}`,
        },
        { status: createRes.status === 401 ? 401 : 502 },
      );
    }

    const text = await createRes.text();
    let created;
    try {
      created = text ? JSON.parse(text) : {};
    } catch (e) {
      return NextResponse.json(
        {
          error: "ORKG resource creation returned invalid JSON",
          detail: text,
        },
        { status: 502 },
      );
    }

    const locationHeader = createRes.headers.get("Location") || createRes.headers.get("location");
    
    resourceId = created.id || locationHeader?.split("/").pop() || created.location?.split("/").pop();
    
    if (!resourceId) {
      return NextResponse.json(
        {
          error: "ORKG did not return a resource id",
          detail: `Text: ${text} | Location: ${locationHeader}`,
        },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Network error creating resource", detail: String(err) },
      { status: 502 },
    );
  }

  // ─── Step 2 & 3: Create literals / link resources, then add statements ───
  let statementsCreated = 0;
  const errors: string[] = [];

  async function createStatements(subjectId: string, currentTriples: AnswerTriple[]) {
    for (const triple of currentTriples) {
      if (!triple.value) continue; // Skip empty
      let objectId: string | undefined;

      try {
        if (triple.isNestedResource) {
          // Create sub-resource
          const subRes = await fetch(`${SANDBOX_API}/resources`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              label: triple.value,
              classes: triple.targetClassId ? [triple.targetClassId] : [],
            }),
          });

          if (!subRes.ok) {
            errors.push(`Nested resource ${triple.predicateId}: HTTP ${subRes.status}`);
            continue;
          }

          const text = await subRes.text();
          let created: any = {};
          try {
            created = text ? JSON.parse(text) : {};
          } catch {}

          const locationHeader = subRes.headers.get("Location") || subRes.headers.get("location");
          objectId = created.id || locationHeader?.split("/").pop() || created.location?.split("/").pop();

          if (!objectId) {
            errors.push(`Nested resource ${triple.predicateId}: No ID returned.`);
            continue;
          }

          // Recursively create sub-statements on the new objectId
          if (triple.subStatements && triple.subStatements.length > 0) {
            await createStatements(objectId, triple.subStatements);
          }
        } else if (triple.isLiteral) {
          // Create literal
          const litRes = await fetch(`${SANDBOX_API}/literals`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              label: triple.value,
              datatype: triple.datatype ?? "xsd:string",
            }),
          });

          if (!litRes.ok) {
            errors.push(`Literal "${triple.value}" for ${triple.predicateId}: HTTP ${litRes.status}`);
            continue;
          }
          const litText = await litRes.text();
          let lit: any = {};
          try {
            lit = litText ? JSON.parse(litText) : {};
          } catch {
            errors.push(`Literal "${triple.value}": Invalid JSON response`);
            continue;
          }
          objectId = lit.id;
        } else {
          // The value is already an IRI / resource ID; use directly
          objectId = triple.value.replace(
            /^https?:\/\/(?:orkg|sandbox\.orkg)\.org\/(?:orkg\/)?resource\//,
            "",
          );
        }

        if (!objectId) {
          errors.push(`Empty object id for predicate ${triple.predicateId}`);
          continue;
        }

        // Create statement
        const stmtRes = await fetch(`${SANDBOX_API}/statements`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            subject_id: subjectId,
            predicate_id: triple.predicateId,
            object_id: objectId,
          }),
        });

        if (!stmtRes.ok) {
          errors.push(`Statement (${triple.predicateId} → ${objectId}): HTTP ${stmtRes.status}`);
        } else {
          statementsCreated++;
        }
      } catch (err) {
        errors.push(`Triple ${triple.predicateId}: ${String(err)}`);
      }
    }
  }

  await createStatements(resourceId, answers ?? []);

  return NextResponse.json({
    resourceId,
    sandboxUrl: `https://sandbox.orkg.org/resource/${resourceId}`,
    statementsCreated,
    errors,
  });
}
