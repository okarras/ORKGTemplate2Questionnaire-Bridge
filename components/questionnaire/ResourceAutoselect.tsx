"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Spinner } from "@heroui/spinner";
import { Link } from "@heroui/link";
import { Chip } from "@heroui/chip";

import { FieldLabel } from "./FieldLabel";

import {
  getOrkgResourceLinkFromIri,
  getOrkgCreateResourceLink,
} from "@/lib/orkg-links";
import {
  dedupeOrkgResourceIris,
  normalizeOrkgResourceIri,
  orkgEntityKindLineFromIri,
  orkgResourceIriTail,
  resourceIrisEquivalent,
} from "@/lib/orkg-resource-ids";
import { ResourceLabelCache } from "@/lib/resource-label-cache";

interface OrkgResourceOption {
  id: string;
  label: string;
  creator?: string;
}

type ResourceValue = string | number | boolean | string[];

function formatOrkgOptionDescription(r: OrkgResourceOption): string {
  const entity = orkgEntityKindLineFromIri(r.id);
  const c = r.creator?.trim();

  if (c && c !== "Unknown") return `${c} · ${entity}`;
  if (c === "System") return `System · ${entity}`;
  if (c === "Unknown") return `Unknown creator · ${entity}`;

  return entity;
}

interface ResourceAutoselectProps {
  propertyId: string;
  label: string;
  placeholder?: string;
  value: ResourceValue;
  onChange: (value: ResourceValue) => void;
  /** When true, allows selecting multiple resources (one-to-many cardinality) */
  multiselect?: boolean;
  classId?: string;
  /** Options to filter the allowed resources */
  selectOptions?: { value: string; label: string }[];
  /** Hide the visible FieldLabel row (label shown on parent accordion trigger) */
  hideLabel?: boolean;
  /**
   * Fired when the ORKG class list and/or search hits change so the host can pass
   * allowed labels/ids into AI prompts (e.g. ScidQuest) even without field overrides.
   */
  onResourceOptionsSnapshot?: (
    options: { value: string; label: string }[],
    scopeKey: string,
  ) => void;
  /** Scope for snapshot callbacks (e.g. full template property path). Defaults to `propertyId`. */
  optionsScopeKey?: string;
}

export function ResourceAutoselect({
  propertyId,
  label,
  placeholder,
  value,
  onChange,
  multiselect = false,
  classId,
  selectOptions,
  hideLabel = false,
  onResourceOptionsSnapshot,
  optionsScopeKey,
}: ResourceAutoselectProps) {
  const [resources, setResources] = useState<OrkgResourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [searchHits, setSearchHits] = useState<OrkgResourceOption[]>([]);
  const [resolvedLabels, setResolvedLabels] = useState<Record<string, string>>(
    {},
  );
  const resolveAttemptedRef = useRef<Set<string>>(new Set());
  const searchAbortRef = useRef<AbortController | null>(null);
  const optionsSnapshotKeyRef = useRef<string>("");

  const selectedKeys = useMemo(
    () =>
      dedupeOrkgResourceIris(
        Array.isArray(value) ? value.map(String) : value ? [String(value)] : [],
      ),
    [value],
  );

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
    params.set("limit", multiselect ? "4000" : "500");

    const ac = new AbortController();

    setLoading(true);
    fetch(`/api/orkg/resources?${params.toString()}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data: { resources?: OrkgResourceOption[] }) => {
        const resList = data.resources ?? [];

        resList.forEach((r) => {
          const canon = normalizeOrkgResourceIri(r.id);

          ResourceLabelCache.set(r.id, r.label);
          ResourceLabelCache.set(canon, r.label);
          ResourceLabelCache.set(r.label, canon);
          const shortId = r.id.split("/").pop();

          if (shortId) {
            ResourceLabelCache.set(shortId, r.label);
            ResourceLabelCache.set(r.label, shortId);
          }
        });

        const isDefaultOptions =
          selectOptions &&
          selectOptions.length === 4 &&
          selectOptions[0].value === "option1";

        if (selectOptions && selectOptions.length > 0 && !isDefaultOptions) {
          const allowedIds = new Set(
            selectOptions.flatMap((o) => [
              normalizeOrkgResourceIri(o.value),
              o.value,
            ]),
          );

          setResources(
            resList.filter((r) => {
              const c = normalizeOrkgResourceIri(r.id);

              return (
                allowedIds.has(c) ||
                allowedIds.has(r.id) ||
                allowedIds.has(r.id.split("/").pop() || "")
              );
            }),
          );
        } else {
          setResources(resList);
        }
      })
      .catch((err: unknown) => {
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
        ) {
          return;
        }
        setResources([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => {
      ac.abort();
    };
  }, [propertyId, classId, multiselect, selectOptions]);

  useEffect(() => {
    optionsSnapshotKeyRef.current = "";
  }, [optionsScopeKey, propertyId, classId]);

  useEffect(() => {
    if (!onResourceOptionsSnapshot) return;

    const toOpt = (r: OrkgResourceOption) => ({
      value: r.id,
      label: r.label,
    });
    const primary = resources.map(toOpt);
    const extra = searchHits
      .map(toOpt)
      .filter((h) => !primary.some((p) => p.value === h.value));
    const merged = [...primary, ...extra];
    const key = merged.map((o) => o.value).join("\u0001");

    if (key === optionsSnapshotKeyRef.current) return;

    optionsSnapshotKeyRef.current = key;
    onResourceOptionsSnapshot(merged, optionsScopeKey ?? propertyId);
  }, [
    resources,
    searchHits,
    onResourceOptionsSnapshot,
    optionsScopeKey,
    propertyId,
  ]);

  /** Debounced ORKG label search while typing (multiselect only; single-select shows selected label in input). */
  useEffect(() => {
    if (!multiselect) {
      searchAbortRef.current?.abort();
      setSearchHits([]);

      return;
    }

    const q = inputValue.trim();

    if (q.length < 2) {
      searchAbortRef.current?.abort();
      setSearchHits([]);

      return;
    }

    const timer = window.setTimeout(() => {
      searchAbortRef.current?.abort();
      const ac = new AbortController();

      searchAbortRef.current = ac;

      const params = new URLSearchParams();

      params.set("q", q);
      params.set("limit", "40");
      if (classId) params.set("classId", classId);

      fetch(`/api/orkg/resources?${params.toString()}`, { signal: ac.signal })
        .then((res) => res.json())
        .then((data: { resources?: OrkgResourceOption[] }) => {
          let list = data.resources ?? [];

          const isDefaultOptions =
            selectOptions &&
            selectOptions.length === 4 &&
            selectOptions[0].value === "option1";

          if (selectOptions && selectOptions.length > 0 && !isDefaultOptions) {
            const allowedIds = new Set(
              selectOptions.flatMap((o) => [
                normalizeOrkgResourceIri(o.value),
                o.value,
              ]),
            );

            list = list.filter((r) => {
              const c = normalizeOrkgResourceIri(r.id);

              return (
                allowedIds.has(c) ||
                allowedIds.has(r.id) ||
                allowedIds.has(r.id.split("/").pop() || "")
              );
            });
          }

          list.forEach((r) => {
            const canon = normalizeOrkgResourceIri(r.id);

            ResourceLabelCache.set(r.id, r.label);
            ResourceLabelCache.set(canon, r.label);
            const shortId = r.id.split("/").pop();

            if (shortId) {
              ResourceLabelCache.set(shortId, r.label);
              ResourceLabelCache.set(r.label, shortId);
            }
          });

          setSearchHits(
            list.map((r) => ({
              ...r,
              id: normalizeOrkgResourceIri(r.id),
            })),
          );
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setSearchHits([]);
        });
    }, 320);

    return () => {
      window.clearTimeout(timer);
      searchAbortRef.current?.abort();
    };
  }, [inputValue, classId, selectOptions, multiselect]);

  useEffect(() => {
    resolveAttemptedRef.current.clear();
  }, [propertyId, classId]);

  useEffect(() => {
    if (loading || selectedKeys.length === 0) return;

    const missingTails = selectedKeys
      .filter((k) => {
        const canon = normalizeOrkgResourceIri(k);

        return (
          !resources.some((r) => resourceIrisEquivalent(r.id, k)) &&
          !resolvedLabels[canon] &&
          !resolveAttemptedRef.current.has(orkgResourceIriTail(canon))
        );
      })
      .map((k) => orkgResourceIriTail(k));

    if (missingTails.length === 0) return;

    for (const t of missingTails) {
      resolveAttemptedRef.current.add(t);
    }

    const params = new URLSearchParams();

    params.set("ids", Array.from(new Set(missingTails)).join(","));

    fetch(`/api/orkg/resources/resolve?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { labels?: Record<string, string> }) => {
        const labels = data.labels ?? {};
        const next: Record<string, string> = {};

        for (const [k, v] of Object.entries(labels)) {
          if (!v) continue;
          const canon = normalizeOrkgResourceIri(k);

          next[canon] = v;
          ResourceLabelCache.set(canon, v);
          ResourceLabelCache.set(orkgResourceIriTail(canon), v);
        }
        if (Object.keys(next).length > 0) {
          setResolvedLabels((prev) => ({ ...prev, ...next }));
        }
      })
      .catch(() => {});
  }, [loading, selectedKeys, resources, resolvedLabels]);

  /** Keep search box label in sync when value/resources load (e.g. after remount). */
  useEffect(() => {
    if (loading || multiselect) return;

    const raw = Array.isArray(value) ? value[0] : value;

    if (!raw) {
      setInputValue("");

      return;
    }

    const id = String(raw);
    const canon = normalizeOrkgResourceIri(id);
    const match = resources.find((r) => resourceIrisEquivalent(r.id, id));
    const labelText =
      match?.label ??
      resolvedLabels[canon] ??
      ResourceLabelCache.get(id) ??
      ResourceLabelCache.get(canon) ??
      orkgResourceIriTail(canon);

    setInputValue(labelText);
  }, [loading, multiselect, value, resources, resolvedLabels]);

  const mergedResources = useMemo(() => {
    const byId = new Map<string, OrkgResourceOption>();

    for (const r of resources) {
      const canon = normalizeOrkgResourceIri(r.id);

      byId.set(canon, { ...r, id: canon });
    }

    for (const r of searchHits) {
      const canon = normalizeOrkgResourceIri(r.id);

      if (!byId.has(canon)) {
        byId.set(canon, { ...r, id: canon });
      }
    }

    for (const key of selectedKeys) {
      const canon = normalizeOrkgResourceIri(key);

      if (!byId.has(canon)) {
        const lab =
          resolvedLabels[canon] ??
          ResourceLabelCache.get(key) ??
          ResourceLabelCache.get(canon) ??
          orkgResourceIriTail(canon);

        byId.set(canon, { id: canon, label: lab });
      }
    }

    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [resources, searchHits, selectedKeys, resolvedLabels]);

  const id = `field-${propertyId}`;

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5">
        {!hideLabel ? (
          <div className="space-y-2">
            <FieldLabel
              classId={classId}
              label={label}
              propertyId={propertyId}
            />
            <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-default-50/50 px-4 py-3">
              <Spinner color="default" size="sm" />
              <span className="text-sm text-default-500">
                Loading ORKG options...
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-default-50/50 px-4 py-3">
            <Spinner color="default" size="sm" />
            <span className="text-sm text-default-500">
              Loading ORKG options...
            </span>
          </div>
        )}
        <Link
          isExternal
          aria-label="Create new resource in ORKG"
          className="text-primary w-fit"
          href={
            classId
              ? getOrkgCreateResourceLink(classId) ||
                "https://orkg.org/add-resource"
              : "https://orkg.org/add-resource"
          }
          size="sm"
        >
          Create new in ORKG
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel ? (
        <FieldLabel classId={classId} label={label} propertyId={propertyId} />
      ) : (
        <span className="sr-only">{label}</span>
      )}

      {multiselect && selectedKeys.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-2">
          {selectedKeys.map((key) => {
            const canon = normalizeOrkgResourceIri(key);
            const displayLabel =
              mergedResources.find((r) => resourceIrisEquivalent(r.id, key))
                ?.label ??
              resolvedLabels[canon] ??
              ResourceLabelCache.get(key) ??
              ResourceLabelCache.get(canon) ??
              orkgResourceIriTail(canon);

            const shortId = orkgResourceIriTail(canon);

            return (
              <Chip
                key={canon}
                color="primary"
                variant="flat"
                onClose={() => {
                  onChange(
                    selectedKeys.filter((k) => !resourceIrisEquivalent(k, key)),
                  );
                }}
              >
                <span>{displayLabel}</span>
                <span className="ml-1 font-mono text-[0.7rem] text-default-600">
                  {shortId}
                </span>
              </Chip>
            );
          })}
        </div>
      )}

      <Autocomplete
        aria-label={label}
        className="w-full"
        id={id}
        inputValue={inputValue}
        isDisabled={false}
        placeholder={
          placeholder ??
          (multiselect
            ? "Type to search ORKG, then pick resources…"
            : "Search and select...")
        }
        selectedKey={
          multiselect
            ? null
            : (() => {
                const current = selectedKeys[0];

                if (!current) return undefined;

                if (
                  mergedResources.some((r) =>
                    resourceIrisEquivalent(r.id, current),
                  )
                )
                  return normalizeOrkgResourceIri(current);
                const match = mergedResources.find(
                  (r) =>
                    resourceIrisEquivalent(r.id, current) ||
                    r.label === current,
                );

                return match ? match.id : normalizeOrkgResourceIri(current);
              })()
        }
        variant="bordered"
        onInputChange={(val) => {
          setInputValue(val);
        }}
        onSelectionChange={(key) => {
          if (!key) {
            if (!multiselect) onChange("");

            return;
          }

          const selected = String(key);
          const canonical =
            mergedResources.find((r) => resourceIrisEquivalent(r.id, selected))
              ?.id ?? normalizeOrkgResourceIri(selected);

          if (multiselect) {
            if (
              !selectedKeys.some((k) => resourceIrisEquivalent(k, canonical))
            ) {
              onChange(dedupeOrkgResourceIris([...selectedKeys, canonical]));
            }
            setInputValue("");
          } else {
            onChange(canonical);
            setInputValue(
              mergedResources.find((r) => r.id === canonical)?.label ||
                resolvedLabels[canonical] ||
                orkgResourceIriTail(canonical),
            );
          }
        }}
      >
        {mergedResources.map((r) => {
          const orkgUrl = getOrkgResourceLinkFromIri(r.id);
          const displayLabel = r.label || r.id.split("/").pop() || r.id;
          const description = formatOrkgOptionDescription(r);

          return (
            <AutocompleteItem
              key={r.id}
              description={description}
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
              textValue={`${displayLabel} ${description}`}
            >
              {displayLabel}
            </AutocompleteItem>
          );
        })}
      </Autocomplete>
      <Link
        isExternal
        aria-label="Create new resource in ORKG"
        className="text-primary w-fit"
        href={
          classId
            ? getOrkgCreateResourceLink(classId) ||
              "https://orkg.org/add-resource"
            : "https://orkg.org/add-resource"
        }
        size="sm"
      >
        Create new in ORKG
      </Link>
    </div>
  );
}
