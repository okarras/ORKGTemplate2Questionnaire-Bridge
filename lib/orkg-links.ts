/**
 * ORKG metadata URLs for linking to properties, classes, and resources.
 * @see https://orkg.org/properties/P181041
 */

export function getOrkgPropertyLink(predicateId: string): string | null {
  if (predicateId?.match(/^P\d+$/)) {
    return `https://orkg.org/properties/${predicateId}`;
  }
  return null;
}

export function getOrkgClassLink(classId: string): string | null {
  if (classId?.match(/^C\d+$/)) {
    return `https://orkg.org/class/${classId}`;
  }
  return null;
}

export function getOrkgResourceLink(resourceId: string): string | null {
  if (resourceId?.match(/^R\d+$/)) {
    return `https://orkg.org/resource/${resourceId}`;
  }
  return null;
}

/** Extract ORKG resource page URL from full IRI (e.g. http://orkg.org/orkg/resource/R123) */
export function getOrkgResourceLinkFromIri(iri: string): string | null {
  if (!iri) return null;
  const match = iri.match(/\/(R\d+)$/);
  return match ? `https://orkg.org/resource/${match[1]}` : null;
}
