import type {
  TemplateMapping,
  EnrichedTemplateMapping,
  EnrichedSubtemplateProperty,
  SubtemplateProperty,
} from "@/types/template";
import type { OrkgPropertyValueMeta } from "@/lib/sparql/orkg-queries";

import { fetchValueTypeFromOrkg } from "@/lib/sparql/fetch-value-type";

function collectTemplateDatatypesByPropertyId(
  mapping: Record<string, SubtemplateProperty>,
): Map<string, { id: string; label?: string }> {
  const out = new Map<string, { id: string; label?: string }>();

  function walk(props: Record<string, SubtemplateProperty>) {
    for (const [id, prop] of Object.entries(props)) {
      if (prop.orkg_template_datatype && !out.has(id)) {
        out.set(id, prop.orkg_template_datatype);
      }
      if (prop.subtemplate_properties) {
        walk(prop.subtemplate_properties);
      }
    }
  }

  walk(mapping);
  return out;
}

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
 * Recursively enriches template mapping with value types from ORKG:
 * template `datatype` (when present), SPARQL aggregates, and statements `object._class`.
 */
export async function enrichTemplateMapping(
  mapping: TemplateMapping,
): Promise<EnrichedTemplateMapping> {
  const ids = collectPredicateIds(mapping);
  const valueTypeCache = new Map<string, OrkgPropertyValueMeta>();
  const templateDtById = collectTemplateDatatypesByPropertyId(mapping);

  const BATCH_SIZE = 5;
  const idArray = Array.from(ids);

  for (let i = 0; i < idArray.length; i += BATCH_SIZE) {
    const batch = idArray.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (id) => {
        const meta = await fetchValueTypeFromOrkg(id, {
          templateDatatype: templateDtById.get(id),
        });

        valueTypeCache.set(id, meta);
      }),
    );
  }

  function enrichProperty(
    prop: SubtemplateProperty,
    propertyId: string,
  ): EnrichedSubtemplateProperty {
    const meta = valueTypeCache.get(propertyId) ?? {
      valueType: "Literal" as const,
    };
    const enriched: EnrichedSubtemplateProperty = {
      ...prop,
      valueType: meta.valueType,
      ...(meta.literalDatatype !== undefined
        ? { literalDatatype: meta.literalDatatype }
        : {}),
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
