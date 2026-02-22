"use client";

import type {
  SubtemplateProperty,
  EnrichedSubtemplateProperty,
} from "@/types/template";

import { useState, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Accordion, AccordionItem } from "@heroui/accordion";

import { DynamicFieldInput } from "./DynamicFieldInput";
import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";
import type { FormValue } from "./QuestionnaireForm";

type PropertyValue = string | number | boolean | string[];

function toPropertyValue(v: FormValue | undefined): PropertyValue {
  if (v === undefined || v === null) return "";
  if (typeof v === "object" && !Array.isArray(v) && "_" in v) return (v as { _?: PropertyValue })._ ?? "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v;
  return "";
}

interface TemplatePropertyRendererProps {
  propertyId: string;
  property: SubtemplateProperty | EnrichedSubtemplateProperty;
  depth?: number;
  value?: FormValue;
  onValueChange?: (value: FormValue) => void;
}

export function TemplatePropertyRenderer({
  propertyId,
  property,
  depth = 0,
  value: controlledValue,
  onValueChange: controlledOnChange,
}: TemplatePropertyRendererProps) {
  const [internalValue, setInternalValue] = useState<PropertyValue>("");
  const isControlled = controlledOnChange !== undefined;

  const value = isControlled
    ? toPropertyValue(controlledValue)
    : internalValue;

  const onChange = useCallback(
    (v: PropertyValue) => {
      if (isControlled) {
        const hasSub =
          property.subtemplate_properties &&
          Object.keys(property.subtemplate_properties).length > 0;
        const current = controlledValue;
        if (hasSub && typeof current === "object" && current !== null && !Array.isArray(current)) {
          controlledOnChange?.({ ...current, _: v });
        } else {
          controlledOnChange?.(v);
        }
      } else {
        setInternalValue(v);
      }
    },
    [isControlled, controlledOnChange, controlledValue, property.subtemplate_properties],
  );

  const enrichedProp = property as EnrichedSubtemplateProperty;
  const inputType =
    enrichedProp.valueType !== undefined
      ? getInputTypeFromValueType(enrichedProp.valueType)
      : getInputTypeForProperty(propertyId);
  const hasSubproperties =
    property.subtemplate_properties &&
    Object.keys(property.subtemplate_properties).length > 0;

  // Leaf property: render input only
  if (!hasSubproperties) {
    return (
      <div className="w-full">
        <DynamicFieldInput
          cardinality={property.cardinality}
          classId={property.class_id}
          createLink={property.create_link}
          inputType={inputType}
          label={property.label}
          placeholder={property.description}
          propertyId={propertyId}
          value={value}
          onChange={onChange}
        />
      </div>
    );
  }

  // Property with nested subtemplate_properties
  return (
    <Card className="w-full border-primary/20 shadow-sm" shadow="sm">
      <CardHeader className="flex flex-col items-start gap-1 border-b border-default-200/50 px-4 pt-4">
        <div className="w-full">
          <DynamicFieldInput
            cardinality={property.cardinality}
            classId={property.class_id}
            createLink={property.create_link}
            inputType={inputType}
            label={property.label}
            placeholder={property.description}
            propertyId={propertyId}
            value={value}
            onChange={onChange}
          />
        </div>
      </CardHeader>
      <CardBody className="px-4 pb-4 pt-0">
        <div className="ml-4 mt-2 border-l-2 border-primary/30 pl-4">
          <p className="mb-3 text-sm text-default-500">
            {property.description}
          </p>
          <Accordion className="gap-0" variant="bordered">
            {Object.entries(property.subtemplate_properties!).map(
              ([subPropId, subProp]) => (
                <AccordionItem
                  key={subPropId}
                  aria-label={subProp.label}
                  classNames={{
                    title: "text-primary font-medium",
                    trigger: "data-[hover=true]:bg-primary/5",
                  }}
                  subtitle={subProp.cardinality}
                  title={subProp.label}
                >
                  <div className="pb-2">
                    <TemplatePropertyRenderer
                      depth={depth + 1}
                      property={subProp}
                      propertyId={subPropId}
                      value={
                        typeof controlledValue === "object" &&
                        controlledValue !== null &&
                        !Array.isArray(controlledValue)
                          ? (controlledValue as Record<string, FormValue>)[subPropId]
                          : undefined
                      }
                      onValueChange={(v) => {
                        if (!controlledOnChange) return;
                        const hasSub =
                          property.subtemplate_properties &&
                          Object.keys(property.subtemplate_properties).length > 0;
                        const current = controlledValue;
                        if (hasSub && typeof current === "object" && current !== null && !Array.isArray(current)) {
                          controlledOnChange({
                            ...current,
                            [subPropId]: v,
                          });
                        } else {
                          controlledOnChange({ [subPropId]: v });
                        }
                      }}
                    />
                  </div>
                </AccordionItem>
              ),
            )}
          </Accordion>
        </div>
      </CardBody>
    </Card>
  );
}
