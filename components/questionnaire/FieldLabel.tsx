import { Link } from "@heroui/link";

import { getOrkgPropertyLink, getOrkgClassLink } from "@/lib/orkg-links";

interface FieldLabelProps {
  label: string;
  propertyId: string;
  classId?: string;
}

export function FieldLabel({ label, propertyId, classId }: FieldLabelProps) {
  const propertyLink = getOrkgPropertyLink(propertyId);
  const classLink = classId ? getOrkgClassLink(classId) : null;
  const href = propertyLink ?? classLink ?? null;

  if (!href) return <>{label}</>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <Link
        isExternal
        aria-label={`View ${label} on ORKG`}
        className="text-primary min-w-0 p-0.5"
        href={href}
        size="sm"
      >
        <svg
          aria-hidden
          fill="none"
          height="14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="14"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" x2="21" y1="14" y2="3" />
        </svg>
      </Link>
    </span>
  );
}
