/**
 * ORKG Template API client
 * Fetches templates from ORKG REST API and converts to TemplateMapping format
 * @see https://tibhannover.gitlab.io/orkg/orkg-backend/api-doc/
 */

import type { SubtemplateProperty, TemplateMapping } from "@/types/template";

import { getOrkgCreateResourceLink } from "@/lib/orkg-links";

const ORKG_API_BASE = "https://orkg.org/api";
const TEMPLATE_ACCEPT = "application/vnd.orkg.template.v1+json";
const TEMPLATE_CONTENT_TYPE =
  "application/vnd.orkg.template.v1+json;charset=UTF-8";

/** API response: template as returned by ORKG */
export interface ApiTemplate {
  id: string;
  label: string;
  description?: string;
  target_class?: { id: string; label?: string };
  properties?: ApiTemplateProperty[];
  /** Some ORKG responses include neighbors (template flow) */
  neighbors?: (ApiTemplate & { id: string })[];
}

/** API response: template property */
export interface ApiTemplateProperty {
  id?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  min_count?: number;
  max_count?: number | null;
  path?: { id: string; label?: string };
  class?: { id: string; label?: string };
  datatype?: { id: string; label?: string };
}

/** Light template metadata for list/search */
export interface TemplateListItem {
  id: string;
  label: string;
  description?: string;
  target_class?: string;
}

/** Internal representation for mapping generation */
export interface GraphTemplate {
  id: string;
  label: string;
  target_class?: { id: string; label?: string };
  properties?: Array<{
    id?: string;
    label?: string;
    description?: string;
    path?: { id: string; label?: string };
    class?: { id: string; label?: string };
    min_count?: number;
    max_count?: number | null;
  }>;
}

const headers = {
  Accept: TEMPLATE_ACCEPT,
  "Content-Type": TEMPLATE_CONTENT_TYPE,
};

/**
 * Fetch a single template by ID from ORKG API
 */
export async function fetchTemplateById(
  id: string,
): Promise<ApiTemplate | null> {
  const res = await fetch(`${ORKG_API_BASE}/templates/${id}`, { headers });

  if (!res.ok) return null;

  return res.json();
}

/**
 * List/search templates from ORKG API
 * @param options page, size, q (search), target_class
 */
export async function listTemplates(options?: {
  page?: number;
  size?: number;
  q?: string;
  target_class?: string;
}): Promise<{ content: TemplateListItem[]; totalElements: number }> {
  const params = new URLSearchParams();

  params.set("page", String(options?.page ?? 0));
  params.set("size", String(options?.size ?? 20));
  if (options?.q) params.set("q", options.q);
  if (options?.target_class) params.set("target_class", options.target_class);

  const res = await fetch(`${ORKG_API_BASE}/templates?${params}`, { headers });

  if (!res.ok) {
    return { content: [], totalElements: 0 };
  }
  const data = await res.json();
  const content = data.content ?? data.elements ?? [];
  const total =
    data.totalElements ??
    data.total ??
    data.page?.total_elements ??
    content.length;

  return {
    content: content.map((t: ApiTemplate) => ({
      id: t.id,
      label: t.label ?? t.id,
      description: t.description,
      target_class: t.target_class?.id,
    })),
    totalElements: total,
  };
}

/**
 * Fetch template by target class (for subtemplate resolution)
 */
async function fetchTemplateByTargetClass(
  classId: string,
): Promise<ApiTemplate | null> {
  const { content } = await listTemplates({
    page: 0,
    size: 1,
    target_class: classId,
  });

  if (content.length === 0) return null;

  return fetchTemplateById(content[0].id);
}

/**
 * Adapt API template to GraphTemplate format
 */
export function adaptTemplate(api: ApiTemplate): GraphTemplate {
  return {
    id: api.id,
    label: api.label ?? api.id,
    target_class: api.target_class,
    properties: api.properties?.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      path: p.path,
      class: p.class,
      min_count: p.min_count,
      max_count: p.max_count,
    })),
  };
}

export interface TemplateFlowResult {
  main: ApiTemplate;
  allTemplates: GraphTemplate[];
}

/**
 * Load template and its neighbors (sub-templates) recursively.
 * Resolves neighbors via: (1) API neighbors field if present, (2) fetch by target_class for property.class
 */
export async function loadTemplateFlowByID(
  templateId: string,
  _visited = new Set<string>(),
): Promise<TemplateFlowResult> {
  const main = await fetchTemplateById(templateId);

  if (!main) throw new Error(`Template not found: ${templateId}`);

  const visited = new Set(_visited);

  visited.add(main.id);

  const allTemplates: GraphTemplate[] = [];

  allTemplates.push(adaptTemplate(main));

  async function resolveNeighbors(node: ApiTemplate) {
    if (node.neighbors && Array.isArray(node.neighbors)) {
      for (const n of node.neighbors) {
        if (!n?.id || typeof n.id !== "string" || !n.id.startsWith("R"))
          continue;
        if (visited.has(n.id)) continue;
        visited.add(n.id);
        const fetched = await fetchTemplateById(n.id);

        if (fetched) {
          allTemplates.push(adaptTemplate(fetched));
          await resolveNeighbors(fetched);
        }
      }
    }

    for (const prop of node.properties ?? []) {
      const classId = prop.class?.id;

      if (!classId) continue;

      const alreadyHave = allTemplates.some(
        (t) => t.target_class?.id === classId,
      );

      if (alreadyHave) continue;

      try {
        const sub = await fetchTemplateByTargetClass(classId);

        if (sub && !visited.has(sub.id)) {
          visited.add(sub.id);
          allTemplates.push(adaptTemplate(sub));
          await resolveNeighbors(sub);
        }
      } catch {
        // Skip this subtemplate if resolution fails (e.g. network, no template)
      }
    }
  }

  await resolveNeighbors(main);

  return { main, allTemplates };
}

export type PropertyMapping = SubtemplateProperty;

export type PredicatesMapping = TemplateMapping;

/**
 * Generate TemplateMapping (predicates keyed by path id) from templates.
 * Main template's properties become top-level keys; subtemplate properties nest.
 */
export function generateTemplateMapping(
  templates: GraphTemplate[],
  mainTemplateId?: string,
): PredicatesMapping {
  const predicatesMapping: PredicatesMapping = {};
  const templateMap = new Map<string, GraphTemplate>();

  templates.forEach((t) => {
    if (t.target_class?.id) templateMap.set(t.target_class.id, t);
  });

  const mainTemplate = mainTemplateId
    ? templates.find((t) => t.id === mainTemplateId)
    : undefined;
  const rootTemplate: GraphTemplate | undefined = mainTemplate ?? templates[0];

  function processProperty(
    property: NonNullable<GraphTemplate["properties"]>[number],
    _template: GraphTemplate,
    visitedClassIds: Set<string> = new Set(),
  ): PropertyMapping | null {
    const pathId = property.path?.id ?? property.id;

    if (!pathId) return null;

    let cardinality: "one to one" | "one to many" = "one to one";

    if (property.max_count == null || property.max_count > 1) {
      cardinality = "one to many";
    }

    const propMapping: PropertyMapping = {
      label: property.class?.label ?? property.path?.label ?? pathId,
      cardinality,
      description:
        property.description ||
        property.label ||
        property.path?.label ||
        pathId,
      predicate_label: property.path?.label,
      class_label: property.class?.label,
    };

    if (property.class?.id) {
      const classId = property.class.id;
      const targetTemplate = templateMap.get(classId);

      if (targetTemplate) {
        propMapping.subtemplate_id = targetTemplate.id;
        propMapping.subtemplate_label = targetTemplate.label;
        propMapping.class_id = classId;
        const createLink = getOrkgCreateResourceLink(classId);

        if (createLink) propMapping.create_link = createLink;

        if (
          targetTemplate.properties?.length &&
          !visitedClassIds.has(classId)
        ) {
          visitedClassIds.add(classId);
          propMapping.subtemplate_properties = {};
          for (const subProp of targetTemplate.properties) {
            const subPathId = subProp.path?.id ?? subProp.id;

            if (!subPathId) continue;
            const subMapping = processProperty(
              subProp,
              targetTemplate,
              visitedClassIds,
            );

            if (subMapping) {
              propMapping.subtemplate_properties![subPathId] = subMapping;
            }
          }
          visitedClassIds.delete(classId);
        }
      }
    }

    return propMapping;
  }

  // Only root template's properties become top-level keys
  if (
    rootTemplate &&
    Array.isArray(rootTemplate.properties) &&
    rootTemplate.properties.length > 0
  ) {
    for (const prop of rootTemplate.properties) {
      const mapping = processProperty(prop, rootTemplate);
      const key = prop.path?.id ?? prop.id;

      if (mapping && key) {
        predicatesMapping[key] = mapping;
      }
    }
  }

  return predicatesMapping;
}
