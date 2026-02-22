import type {
  TemplateMapping,
  EnrichedTemplateMapping,
  EnrichedSubtemplateProperty,
  SubtemplateProperty,
  OrkgValueType,
} from "@/types/template";

import { fetchValueTypeFromOrkg } from "../../lib/sparql/fetch-value-type";

/**
 * Extracts unique predicate IDs from template mapping (including nested).
 */
function collectPredicateIds(
  mapping: Record<string, SubtemplateProperty>,
): Set<string> {
  const ids = new Set<string>();

  function walk(obj: Record<string, SubtemplateProperty>) {
    for (const [id, prop] of Object.entries(obj)) {
      ids.add(id);
      if (prop.subtemplate_properties) {
        walk(prop.subtemplate_properties);
      }
    }
  }
  walk(mapping);

  return ids;
}

/**
 * Recursively enriches template mapping with valueType from SPARQL.
 * - IRI → resource (autoselect)
 * - Literal → text/textarea
 * - Blank node / Unknown → default to text
 */
export async function enrichTemplateMapping(
  mapping: TemplateMapping,
): Promise<EnrichedTemplateMapping> {
  const ids = collectPredicateIds(mapping);
  const valueTypeCache = new Map<string, OrkgValueType>();

  const BATCH_SIZE = 5;
  const idArray = Array.from(ids);

  for (let i = 0; i < idArray.length; i += BATCH_SIZE) {
    const batch = idArray.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (id) => {
        const vt = await fetchValueTypeFromOrkg(id);

        valueTypeCache.set(id, vt);
      }),
    );
  }

  function enrichProperty(
    prop: SubtemplateProperty,
    propertyId: string,
  ): EnrichedSubtemplateProperty {
    const valueType = valueTypeCache.get(propertyId) ?? "Literal";
    // console.log(`Enriching property ${propertyId} with value type ${valueType}`);
    const enriched: EnrichedSubtemplateProperty = {
      ...prop,
      valueType,
    };

    if (prop.subtemplate_properties) {
      enriched.subtemplate_properties = Object.fromEntries(
        Object.entries(prop.subtemplate_properties).map(([subId, subProp]) => [
          subId,
          enrichProperty(subProp, subId),
        ]),
      );
    }

    return enriched;
  }

  return Object.fromEntries(
    Object.entries(mapping).map(([id, prop]) => [id, enrichProperty(prop, id)]),
  ) as EnrichedTemplateMapping;
}
