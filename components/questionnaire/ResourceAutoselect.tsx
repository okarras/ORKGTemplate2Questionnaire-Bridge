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
          <FieldLabel classId={classId} label={label} propertyId={propertyId} />
          <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-default-50/50 px-4 py-3">
            <Spinner color="default" size="sm" />
            <span className="text-sm text-default-500">
              Loading ORKG options...
            </span>
          </div>
        </div>
        {createResourceUrl && (
          <Link
            isExternal
            aria-label="Create new resource in ORKG"
            className="text-primary w-fit"
            href={createResourceUrl}
            size="sm"
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
        className="w-full"
        classNames={{
          trigger:
            "border-default-200 bg-transparent min-h-11 shadow-none hover:bg-default-100 data-[hover=true]:bg-default-100 data-[focus=true]:border-default-400 data-[focus=true]:bg-transparent",
          value: "text-foreground",
          listboxWrapper: "max-h-[280px]",
        }}
        description={
          resources.length === 0
            ? undefined
            : `${resources.length} option${resources.length === 1 ? "" : "s"} from ORKG`
        }
        disableAnimation={false}
        id={id}
        isDisabled={resources.length === 0}
        label={
          <FieldLabel classId={classId} label={label} propertyId={propertyId} />
        }
        labelPlacement="outside"
        listboxProps={{
          emptyContent: "No ORKG resources found for this field",
          classNames: {
            list: "py-1",
          },
        }}
        placeholder={
          placeholder ??
          (multiselect
            ? "Select one or more from options..."
            : "Select from options...")
        }
        popoverProps={{
          classNames: {
            content: "p-0",
          },
        }}
        scrollShadowProps={{ visibility: "both" }}
        selectedKeys={
          multiselect
            ? new Set(Array.isArray(value) ? value : [])
            : typeof value === "string" && value
              ? new Set([value])
              : new Set()
        }
        selectionMode={multiselect ? "multiple" : "single"}
        variant="bordered"
        onSelectionChange={(keys) => {
          if (multiselect) {
            onChange(Array.from(keys) as string[]);
          } else {
            const selected = Array.from(keys)[0];

            onChange(selected ? String(selected) : "");
          }
        }}
      >
        {resources.map((r) => {
          const orkgUrl = getOrkgResourceLinkFromIri(r.id);
          const displayLabel = r.label || r.id.split("/").pop() || r.id;

          return (
            <SelectItem
              key={r.id}
              classNames={{
                base: "data-[selected=true]:bg-default-100 data-[hover=true]:bg-default-50",
              }}
              endContent={
                orkgUrl ? (
                  <Link
                    isExternal
                    aria-label={`View ${displayLabel} on ORKG`}
                    className="min-w-0 p-1 text-default-400 hover:text-primary"
                    href={orkgUrl}
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
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
                ) : undefined
              }
              shouldHighlightOnFocus={false}
              textValue={displayLabel}
            >
              {displayLabel}
            </SelectItem>
          );
        })}
      </Select>
      {createResourceUrl && (
        <Link
          isExternal
          aria-label="Create new resource in ORKG"
          className="text-primary w-fit"
          href={createResourceUrl}
          size="sm"
        >
          Create new in ORKG
        </Link>
      )}
    </div>
  );
}
