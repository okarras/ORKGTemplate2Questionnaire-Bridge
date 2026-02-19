"use client";

import { useState, useEffect } from "react";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Link } from "@heroui/link";
import { FieldLabel } from "./FieldLabel";
import {
  getOrkgResourceLinkFromIri,
  getOrkgCreateResourceLink,
} from "@/lib/orkg-links";

interface OrkgResourceOption {
  id: string;
  label: string;
}

type ResourceValue = string | number | boolean | string[];

interface ResourceAutoselectProps {
  propertyId: string;
  label: string;
  placeholder?: string;
  value: ResourceValue;
  onChange: (value: ResourceValue) => void;
  /** When true, allows selecting multiple resources (one-to-many cardinality) */
  multiselect?: boolean;
  classId?: string;
  /** Link to create new ORKG resource (e.g. from template mapping) */
  createLink?: string;
}

export function ResourceAutoselect({
  propertyId,
  label,
  placeholder,
  value,
  onChange,
  multiselect = false,
  classId,
  createLink,
}: ResourceAutoselectProps) {
  const createResourceUrl =
    createLink ?? (classId ? getOrkgCreateResourceLink(classId) : null);
  const [resources, setResources] = useState<OrkgResourceOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hasPredicate = propertyId.match(/^P\d+$/);
    const hasClass = classId?.match(/^C\d+$/);
    if (!hasPredicate && !hasClass) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (hasPredicate) params.set("predicateId", propertyId);
    if (classId) params.set("classId", classId);
    params.set("limit", "500");

    setLoading(true);
    fetch(`/api/orkg/resources?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { resources?: OrkgResourceOption[] }) => {
        setResources(data.resources ?? []);
      })
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, [propertyId, classId]);

  const id = `field-${propertyId}`;

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="space-y-2">
          <FieldLabel label={label} propertyId={propertyId} classId={classId} />
          <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-default-50/50 px-4 py-3">
            <Spinner size="sm" color="default" />
            <span className="text-sm text-default-500">
              Loading ORKG options...
            </span>
          </div>
        </div>
        {createResourceUrl && (
          <Link
            isExternal
            href={createResourceUrl}
            size="sm"
            className="text-primary w-fit"
            aria-label="Create new resource in ORKG"
          >
            Create new in ORKG
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        id={id}
        variant="bordered"
        label={<FieldLabel label={label} propertyId={propertyId} classId={classId} />}
        placeholder={
          placeholder ??
          (multiselect ? "Select one or more from options..." : "Select from options...")
        }
        selectionMode={multiselect ? "multiple" : "single"}
        selectedKeys={
          multiselect
            ? new Set(Array.isArray(value) ? value : [])
            : typeof value === "string" && value
              ? new Set([value])
              : new Set()
        }
        onSelectionChange={(keys) => {
          if (multiselect) {
            onChange(Array.from(keys) as string[]);
          } else {
            const selected = Array.from(keys)[0];
            onChange(selected ? String(selected) : "");
          }
        }}
        labelPlacement="outside"
        disableAnimation={false}
        scrollShadowProps={{ visibility: "both" }}
        listboxProps={{
          emptyContent: "No ORKG resources found for this field",
          classNames: {
            list: "py-1",
          },
        }}
        classNames={{
          trigger:
            "border-default-200 bg-transparent min-h-11 shadow-none hover:bg-default-100 data-[hover=true]:bg-default-100 data-[focus=true]:border-default-400 data-[focus=true]:bg-transparent",
          value: "text-foreground",
          listboxWrapper: "max-h-[280px]",
        }}
        className="w-full"
        isDisabled={resources.length === 0}
        description={
          resources.length === 0
            ? undefined
            : `${resources.length} option${resources.length === 1 ? "" : "s"} from ORKG`
        }
        popoverProps={{
          classNames: {
            content: "p-0",
          },
        }}
      >
      {resources.map((r) => {
        const orkgUrl = getOrkgResourceLinkFromIri(r.id);
        const displayLabel = r.label || r.id.split("/").pop() || r.id;
        return (
          <SelectItem
            key={r.id}
            textValue={displayLabel}
            shouldHighlightOnFocus={false}
            classNames={{
              base: "data-[selected=true]:bg-default-100 data-[hover=true]:bg-default-50",
            }}
            endContent={
              orkgUrl ? (
                <Link
                  isExternal
                  href={orkgUrl}
                  size="sm"
                  className="min-w-0 p-1 text-default-400 hover:text-primary"
                  aria-label={`View ${displayLabel} on ORKG`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </Link>
              ) : undefined
            }
          >
            {displayLabel}
          </SelectItem>
        );
      })}
      </Select>
      {createResourceUrl && (
        <Link
          isExternal
          href={createResourceUrl}
          size="sm"
          className="text-primary w-fit"
          aria-label="Create new resource in ORKG"
        >
          Create new in ORKG
        </Link>
      )}
    </div>
  );
}
