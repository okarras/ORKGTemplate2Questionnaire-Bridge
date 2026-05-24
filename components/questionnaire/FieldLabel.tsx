import { Tooltip } from "@heroui/tooltip";
import { Link } from "@heroui/link";

import { getOrkgPropertyLink, getOrkgClassLink } from "@/lib/orkg-links";

interface FieldLabelProps {
  label: string;
  propertyId: string;
  classId?: string;
  /** When true, show a red required dot next to the label */
  required?: boolean;
}

export function FieldLabel({
  label,
  propertyId,
  classId,
  required = false,
}: FieldLabelProps) {
  const propertyLink = getOrkgPropertyLink(propertyId);
  const classLink = classId ? getOrkgClassLink(classId) : null;
  const href = propertyLink ?? classLink ?? null;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-default-800">
      <span>{label}</span>
      {required && (
        <span
          aria-label="Required"
          className="inline-block h-1.5 w-1.5 rounded-full bg-danger"
        />
      )}
      {href && (
        <Tooltip content={`View "${label}" on ORKG`} delay={400}>
          <Link
            isExternal
            aria-label={`View ${label} on ORKG`}
            className="text-primary/60 hover:text-primary transition-colors min-w-0 p-0.5"
            href={href}
            size="sm"
          >
            <svg
              aria-hidden
              fill="none"
              height="13"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="13"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" x2="21" y1="14" y2="3" />
            </svg>
          </Link>
        </Tooltip>
      )}
    </span>
  );
}
