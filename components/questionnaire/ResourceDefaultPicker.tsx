"use client";

import type { SelectOption } from "./questionnaire-form-types";

import { useEffect, useMemo, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";

import {
  normalizeOrkgResourceIri,
  orkgResourceIriTail,
  resourceIrisEquivalent,
} from "@/lib/orkg-resource-ids";
import { ResourceLabelCache } from "@/lib/resource-label-cache";

import {
  formatStoredMultiDefault,
  parseStoredMultiDefault,
} from "./field-default-value-utils";

interface OrkgResourceRow {
  id: string;
  label: string;
}

function isOneToMany(cardinality?: string) {
  return cardinality?.toLowerCase() === "one to many";
}

function toSelectOption(r: OrkgResourceRow): SelectOption {
  const canon = normalizeOrkgResourceIri(r.id);

  return { value: canon, label: r.label || orkgResourceIriTail(canon) };
}

function mergeResourceOptions(
  fetched: SelectOption[],
  storedIds: string[],
): SelectOption[] {
  const seen = new Set<string>();
  const out: SelectOption[] = [];

  const add = (opt: SelectOption) => {
    const k = normalizeOrkgResourceIri(opt.value);

    if (seen.has(k)) return;
    seen.add(k);
    out.push({ value: k, label: opt.label });
  };

  for (const id of storedIds) {
    const canon = normalizeOrkgResourceIri(id);
    const label =
      ResourceLabelCache.get(id) ??
      ResourceLabelCache.get(canon) ??
      orkgResourceIriTail(canon);

    add({ value: canon, label });
  }

  for (const opt of fetched) {
    add(opt);
  }

  return out.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

/**
 * Pick fill-mode default(s) for ORKG resource fields without requiring
 * Advanced filter (loads class/predicate resources from the API).
 */
export function ResourceDefaultPicker({
  propertyId,
  classId,
  cardinality,
  value,
  onChange,
  restrictedOptions = [],
}: {
  propertyId: string;
  classId?: string;
  cardinality?: string;
  value: string;
  onChange: (value: string) => void;
  /** When set, only these resources are offered (from Advanced filter). */
  restrictedOptions?: SelectOption[];
}) {
  const many = isOneToMany(cardinality);
  const stored = parseStoredMultiDefault(value);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<SelectOption[]>([]);
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");

  const useRestricted = restrictedOptions.length > 0;

  useEffect(() => {
    if (useRestricted) {
      setFetched(
        restrictedOptions.map((o) => ({
          value: normalizeOrkgResourceIri(o.value),
          label: o.label,
        })),
      );

      return;
    }

    const hasPredicate = propertyId.match(/^P\d+$/);
    const hasClass = classId?.match(/^C\d+$/);

    if (!hasPredicate && !hasClass) {
      setFetchError(
        "No ORKG class or property id — cannot load resources for this field.",
      );

      return;
    }

    const params = new URLSearchParams();

    if (hasPredicate) params.set("predicateId", propertyId);
    if (classId) params.set("classId", classId);
    params.set("limit", many ? "500" : "200");

    const ac = new AbortController();

    setLoading(true);
    setFetchError(null);
    fetch(`/api/orkg/resources?${params.toString()}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data: { resources?: OrkgResourceRow[]; error?: string }) => {
        if (data.error) {
          setFetchError(data.error);

          return;
        }
        const list = (data.resources ?? []).map(toSelectOption);

        list.forEach((o) => {
          ResourceLabelCache.set(o.value, o.label);
          ResourceLabelCache.set(orkgResourceIriTail(o.value), o.label);
        });
        setFetched(list);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setFetchError("Could not load ORKG resources.");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [propertyId, classId, many, useRestricted, restrictedOptions]);

  const options = useMemo(
    () =>
      mergeResourceOptions(
        useRestricted ? restrictedOptions : fetched,
        parseStoredMultiDefault(value),
      ),
    [useRestricted, restrictedOptions, fetched, value],
  );

  const filterQuery = many ? search : inputValue;

  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();

    if (!q) return options;

    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        orkgResourceIriTail(o.value).toLowerCase().includes(q),
    );
  }, [options, filterQuery]);

  useEffect(() => {
    if (many || !stored[0]) return;
    const hit = options.find((o) => resourceIrisEquivalent(o.value, stored[0]!));

    if (hit) setInputValue(hit.label);
  }, [many, stored, options]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-default-500">
        <Spinner size="sm" />
        Loading ORKG resources…
      </div>
    );
  }

  if (fetchError && options.length === 0) {
    return <p className="text-sm text-danger">{fetchError}</p>;
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-default-500">
        No ORKG resources found for this field. Try{" "}
        <span className="font-medium">Advanced filter…</span> or pick a value
        on the form first, then open customize again.
      </p>
    );
  }

  if (many) {
    const toggle = (optionValue: string, checked: boolean) => {
      const id = normalizeOrkgResourceIri(optionValue);
      let next = [...stored];

      if (checked) {
        if (!next.some((s) => resourceIrisEquivalent(s, id))) next.push(id);
      } else {
        next = next.filter((s) => !resourceIrisEquivalent(s, id));
      }

      onChange(formatStoredMultiDefault(next));
    };

    return (
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium text-default-700">
            Default value (when empty)
          </p>
          <p className="mt-0.5 text-xs text-default-500">
            {useRestricted
              ? "Choose from your restricted resource list."
              : "Search and select defaults from ORKG (no Advanced filter required)."}
          </p>
        </div>
        <Input
          aria-label="Search resources"
          placeholder="Search resources…"
          size="sm"
          value={search}
          variant="bordered"
          onValueChange={setSearch}
        />
        <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-default-200 bg-default-50/40 p-3">
          {filtered.map((opt) => (
            <Checkbox
              key={opt.value}
              isSelected={stored.some((s) =>
                resourceIrisEquivalent(s, opt.value),
              )}
              onValueChange={(checked) => toggle(opt.value, checked)}
            >
              <span className="text-sm">{opt.label}</span>
            </Checkbox>
          ))}
        </div>
        {stored.length > 0 ? (
          <p className="text-xs text-default-500">
            {stored.length} default{stored.length !== 1 ? "s" : ""} selected
          </p>
        ) : null}
      </div>
    );
  }

  const selectedKey = stored[0]
    ? (() => {
        const hit = options.find((o) => resourceIrisEquivalent(o.value, stored[0]!));

        return hit ? hit.value : normalizeOrkgResourceIri(stored[0]!);
      })()
    : null;

  return (
    <div className="flex flex-col gap-1">
      <Autocomplete
        aria-label="Default ORKG resource when field is empty"
        description={
          useRestricted
            ? "Choose from your restricted resource list."
            : "Search ORKG resources — no Advanced filter required."
        }
        inputValue={inputValue}
        label="Default value (when empty)"
        placeholder="Search and select a resource…"
        selectedKey={selectedKey ?? undefined}
        variant="bordered"
        onInputChange={setInputValue}
        onSelectionChange={(key) => {
          if (!key) {
            onChange("");
            setInputValue("");

            return;
          }
          const id = String(key);
          const hit = options.find((o) => resourceIrisEquivalent(o.value, id));

          onChange(normalizeOrkgResourceIri(hit?.value ?? id));
          setInputValue(hit?.label ?? inputValue);
        }}
      >
        {filtered.map((opt) => (
          <AutocompleteItem key={opt.value} textValue={opt.label}>
            {opt.label}
          </AutocompleteItem>
        ))}
      </Autocomplete>
    </div>
  );
}
