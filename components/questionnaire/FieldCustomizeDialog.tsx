"use client";

import type {
  SubtemplateProperty,
  EnrichedSubtemplateProperty,
  InputType,
} from "@/types/template";
import type { FieldOverrides, ScaleConfig, SelectOption } from "./QuestionnaireForm";

import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import { FieldDefaultValueEditor } from "./field-default-dialog-ui";
import { ResourceFilterDialog } from "./ResourceFilterDialog";

const INPUT_TYPE_OPTIONS: { value: InputType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (select)" },
  { value: "resource", label: "Resource (ORKG autocomplete)" },
  { value: "scale", label: "Scale / rating" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
];

interface FieldCustomizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  property: SubtemplateProperty | EnrichedSubtemplateProperty;
  propertyId: string;
  propertyPath: string;
  resolvedInputType: InputType;
  overrides?: FieldOverrides[string];
  hasSubproperties: boolean;
  onSave: (payload: Partial<FieldOverrides[string]>) => void;
  onFieldTypeChange: (inputType: InputType) => void;
}

export function FieldCustomizeDialog({
  isOpen,
  onClose,
  property,
  propertyId,
  propertyPath: _propertyPath,
  resolvedInputType,
  overrides,
  hasSubproperties,
  onSave,
  onFieldTypeChange,
}: FieldCustomizeDialogProps) {
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSelectOptions, setEditSelectOptions] = useState<SelectOption[]>([]);
  const [editScaleConfig, setEditScaleConfig] = useState<ScaleConfig>({
    min: 1,
    max: 5,
    minLabel: "Low",
    maxLabel: "High",
  });
  const [editShowInHeader, setEditShowInHeader] = useState(false);
  const [editTreatAsResource, setEditTreatAsResource] = useState(false);
  const [editEmptyDefault, setEditEmptyDefault] = useState("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const draftInputType = overrides?.inputType ?? resolvedInputType;
  const enriched = property as EnrichedSubtemplateProperty;

  useEffect(() => {
    if (!isOpen) return;

    setEditLabel(overrides?.label ?? property.label);
    setEditDescription(overrides?.description ?? property.description ?? "");
    const currentType = overrides?.inputType ?? resolvedInputType;

    setEditSelectOptions(
      overrides?.selectOptions ??
        (currentType === "resource"
          ? []
          : [
              { value: "option1", label: "Option 1" },
              { value: "other", label: "Other/Comments" },
            ]),
    );
    setEditScaleConfig(
      overrides?.scaleConfig ?? {
        min: 1,
        max: 5,
        minLabel: "Low",
        maxLabel: "High",
      },
    );
    setEditShowInHeader(overrides?.showInHeader ?? false);
    setEditTreatAsResource(overrides?.treatAsResource ?? false);
    setEditEmptyDefault(overrides?.emptyDefault ?? "");
  }, [isOpen, overrides, property, resolvedInputType]);

  const handleSave = useCallback(() => {
    const payload: Partial<FieldOverrides[string]> = {
      label: editLabel.trim() || undefined,
      description: editDescription.trim() || undefined,
      showInHeader: editShowInHeader,
      treatAsResource: editTreatAsResource,
      emptyDefault: editEmptyDefault.trim() || undefined,
    };

    if (draftInputType === "select" || draftInputType === "resource") {
      const validOptions = editSelectOptions.filter(
        (o) => o.value.trim() || o.label.trim(),
      );

      payload.selectOptions = validOptions.length > 0 ? validOptions : [];
    }
    if (draftInputType === "scale") {
      payload.scaleConfig = editScaleConfig;
    }

    onSave(payload);
    onClose();
  }, [
    draftInputType,
    editDescription,
    editLabel,
    editScaleConfig,
    editSelectOptions,
    editEmptyDefault,
    editShowInHeader,
    editTreatAsResource,
    onClose,
    onSave,
  ]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={onClose}
      >
        <ModalContent>
          {(onModalClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>Customize field</span>
                <span className="text-sm font-normal text-default-500">
                  {property.label}
                </span>
              </ModalHeader>
              <ModalBody className="gap-4">
                <Input
                  label="Label"
                  placeholder="Field label"
                  value={editLabel}
                  variant="bordered"
                  onValueChange={setEditLabel}
                />
                <Textarea
                  label="Description"
                  minRows={2}
                  placeholder="Field description (optional)"
                  value={editDescription}
                  variant="bordered"
                  onValueChange={setEditDescription}
                />
                <Select
                  label="Field type"
                  placeholder="Select type"
                  selectedKeys={new Set([draftInputType])}
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    const keySet = keys instanceof Set ? keys : new Set<string>();
                    const first = keySet.values().next().value;

                    if (first != null) {
                      onFieldTypeChange(String(first) as InputType);
                    }
                  }}
                >
                  {INPUT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value}>{opt.label}</SelectItem>
                  ))}
                </Select>
                {draftInputType === "select" && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-default-600">
                      Select options
                    </span>
                    {editSelectOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="Value"
                          size="sm"
                          value={opt.value}
                          variant="bordered"
                          onValueChange={(v) =>
                            setEditSelectOptions((prev) => {
                              const next = [...prev];

                              next[i] = { ...next[i], value: v };

                              return next;
                            })
                          }
                        />
                        <Input
                          placeholder="Label"
                          size="sm"
                          value={opt.label}
                          variant="bordered"
                          onValueChange={(v) =>
                            setEditSelectOptions((prev) => {
                              const next = [...prev];

                              next[i] = { ...next[i], label: v };

                              return next;
                            })
                          }
                        />
                        <Button
                          color="danger"
                          size="sm"
                          variant="flat"
                          onPress={() =>
                            setEditSelectOptions((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                        >
                          −
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() =>
                        setEditSelectOptions((prev) => [
                          ...prev,
                          {
                            value: `opt${prev.length + 1}`,
                            label: `Option ${prev.length + 1}`,
                          },
                        ])
                      }
                    >
                      + Add option
                    </Button>
                  </div>
                )}
                {draftInputType === "resource" && (
                  <div className="space-y-2 border-t border-default-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-default-600">
                        Restrict allowed resources
                      </span>
                      <Button
                        color="primary"
                        size="sm"
                        variant="flat"
                        onPress={() => setIsFilterDialogOpen(true)}
                      >
                        Advanced filter…
                      </Button>
                    </div>
                    <p className="text-xs text-default-500">
                      Leave empty to allow any ORKG resource. Use Advanced
                      filter to restrict choices.
                    </p>
                    {editSelectOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-2 rounded-lg border border-default-200 bg-default-50 p-2">
                        {editSelectOptions.map((opt) => (
                          <span
                            key={opt.value}
                            className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
                          >
                            {opt.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-default-200 p-3 text-center text-xs text-default-400">
                        All resources allowed
                      </p>
                    )}
                  </div>
                )}
                {draftInputType === "scale" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Min"
                      type="number"
                      value={String(editScaleConfig.min)}
                      variant="bordered"
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          min: Number(v) || 1,
                        }))
                      }
                    />
                    <Input
                      label="Max"
                      type="number"
                      value={String(editScaleConfig.max)}
                      variant="bordered"
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          max: Number(v) || 5,
                        }))
                      }
                    />
                    <Input
                      label="Start label"
                      placeholder="Optional"
                      value={editScaleConfig.minLabel ?? ""}
                      variant="bordered"
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          minLabel: v || undefined,
                        }))
                      }
                    />
                    <Input
                      label="End label"
                      placeholder="Optional"
                      value={editScaleConfig.maxLabel ?? ""}
                      variant="bordered"
                      onValueChange={(v) =>
                        setEditScaleConfig((prev) => ({
                          ...prev,
                          maxLabel: v || undefined,
                        }))
                      }
                    />
                  </div>
                )}
                <div className="border-t border-default-100 pt-4">
                  <FieldDefaultValueEditor
                    cardinality={property.cardinality}
                    classId={enriched.class_id}
                    inputType={draftInputType}
                    propertyId={propertyId}
                    scaleConfig={editScaleConfig}
                    selectOptions={editSelectOptions}
                    value={editEmptyDefault}
                    onChange={setEditEmptyDefault}
                  />
                </div>
                <div className="flex flex-col gap-3 border-t border-default-100 pt-4">
                  <Switch
                    isSelected={editShowInHeader}
                    onValueChange={setEditShowInHeader}
                  >
                    <span className="text-sm">Show in main header</span>
                  </Switch>
                  {hasSubproperties && (
                    <Switch
                      isSelected={editTreatAsResource}
                      onValueChange={setEditTreatAsResource}
                    >
                      <span className="text-sm">
                        Treat as simple resource selector (do not expand
                        subproperties)
                      </span>
                    </Switch>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onModalClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleSave}>
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <ResourceFilterDialog
        classId={enriched.class_id}
        initialSelectedIds={editSelectOptions.map((o) => o.value)}
        isOpen={isFilterDialogOpen}
        propertyId={propertyId}
        onClose={() => setIsFilterDialogOpen(false)}
        onSave={(selectedOptions) => setEditSelectOptions(selectedOptions)}
      />
    </>
  );
}
