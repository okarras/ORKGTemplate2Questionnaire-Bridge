"use client";

import { useState, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { DynamicFieldInput } from "./DynamicFieldInput";
import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";
import type {
  SubtemplateProperty,
  EnrichedSubtemplateProperty,
} from "@/types/template";

interface TemplatePropertyRendererProps {
  propertyId: string;
  property: SubtemplateProperty | EnrichedSubtemplateProperty;
  depth?: number;
  value?: string | number | boolean;
  onValueChange?: (value: string | number | boolean) => void;
}

export function TemplatePropertyRenderer({
  propertyId,
  property,
  depth = 0,
  value: controlledValue,
  onValueChange: controlledOnChange,
}: TemplatePropertyRendererProps) {
  const [internalValue, setInternalValue] = useState<string | number | boolean>(
    ""
  );
  const isControlled = controlledOnChange !== undefined;
  const value = isControlled ? controlledValue ?? "" : internalValue;
  const onChange = useCallback(
    (v: string | number | boolean) => {
      if (isControlled) {
        controlledOnChange?.(v);
      } else {
        setInternalValue(v);
      }
    },
    [isControlled, controlledOnChange]
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
          propertyId={propertyId}
          label={property.label}
          inputType={inputType}
          placeholder={property.description}
          value={value}
          onChange={onChange}
          classId={property.class_id}
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
            propertyId={propertyId}
            label={property.label}
            inputType={inputType}
            placeholder={property.description}
            value={value}
            onChange={onChange}
            classId={property.class_id}
          />
        </div>
      </CardHeader>
      <CardBody className="px-4 pb-4 pt-0">
        <div className="ml-4 mt-2 border-l-2 border-primary/30 pl-4">
          <p className="mb-3 text-sm text-default-500">
            {property.description}
          </p>
          <Accordion variant="bordered" className="gap-0">
            {Object.entries(property.subtemplate_properties!).map(
              ([subPropId, subProp]) => (
                <AccordionItem
                  key={subPropId}
                  aria-label={subProp.label}
                  title={subProp.label}
                  subtitle={subProp.cardinality}
                  classNames={{
                    title: "text-primary font-medium",
                    trigger: "data-[hover=true]:bg-primary/5",
                  }}
                >
                  <div className="pb-2">
                    <TemplatePropertyRenderer
                      propertyId={subPropId}
                      property={subProp}
                      depth={depth + 1}
                    />
                  </div>
                </AccordionItem>
              )
            )}
          </Accordion>
        </div>
      </CardBody>
    </Card>
  );
}
