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

/** Extract `C123` tail from a bare id or ORKG class IRI. */
export function orkgClassIdTail(raw: string): string | null {
  const t = raw?.trim();

  if (!t) return null;
  const fromPath = t.match(/\/(?:orkg\/)?class\/(C\d+)$/i);
  const m = fromPath ?? t.match(/(C\d+)$/i);

  if (!m) return null;
  const id = m[1]!.toUpperCase();

  return /^C\d+$/.test(id) ? id : null;
}

export function getOrkgClassLink(classId: string): string | null {
  const tail = orkgClassIdTail(classId);

  if (!tail) return null;

  return `https://orkg.org/class/${tail}`;
}

/** Link to create a new ORKG resource of a given class */
export function getOrkgCreateResourceLink(classId: string): string | null {
  const tail =
    orkgClassIdTail(classId) ??
    (classId?.trim() && /^C\d+$/i.test(classId.trim())
      ? classId.trim().toUpperCase().replace(/^c/, "C")
      : null);

  if (!tail) return null;

  return `https://orkg.org/resources/create?classes=${tail}`;
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

/** Link to a resource on the ORKG sandbox */
export function getSandboxResourceLink(resourceId: string): string {
  return `https://sandbox.orkg.org/resource/${resourceId}`;
}
