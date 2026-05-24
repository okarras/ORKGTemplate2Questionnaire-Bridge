"use client";

import type { InputType } from "@/types/template";
import type { CustomFieldBlockData } from "@/types/template";
import type { ScaleConfig, SelectOption } from "./QuestionnaireForm";

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

import { FieldDefaultValueEditor } from "./field-default-dialog-ui";

const INPUT_TYPE_OPTIONS: { value: InputType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text (textarea)" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (select)" },
  { value: "scale", label: "Scale / rating" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
];

interface CustomFieldEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  block: CustomFieldBlockData;
  onSave: (block: CustomFieldBlockData) => void;
}

export function CustomFieldEditDialog({
  isOpen,
  onClose,
  block,
  onSave,
}: CustomFieldEditDialogProps) {
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInputType, setEditInputType] = useState<InputType>("text");
  const [editSelectOptions, setEditSelectOptions] = useState<SelectOption[]>([]);
  const [editScaleConfig, setEditScaleConfig] = useState<ScaleConfig>({
    min: 1,
    max: 5,
  });
  const [editEmptyDefault, setEditEmptyDefault] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setEditLabel(block.label ?? "");
    setEditDescription(block.description ?? "");
    setEditInputType(block.inputType);
    setEditSelectOptions(
      block.selectOptions ?? [
        { value: "opt1", label: "Option 1" },
        { value: "other", label: "Other" },
      ],
    );
    setEditScaleConfig(block.scaleConfig ?? { min: 1, max: 5 });
    setEditEmptyDefault(block.emptyDefault ?? "");
  }, [isOpen, block]);

  const handleSave = useCallback(() => {
    onSave({
      ...block,
      label: editLabel.trim() || block.label,
      description: editDescription.trim() || undefined,
      inputType: editInputType,
      selectOptions:
        editInputType === "select" && editSelectOptions.length > 0
          ? editSelectOptions
          : undefined,
      scaleConfig: editInputType === "scale" ? editScaleConfig : undefined,
      emptyDefault: editEmptyDefault.trim() || undefined,
    });
    onClose();
  }, [
    block,
    editDescription,
    editInputType,
    editLabel,
    editEmptyDefault,
    editScaleConfig,
    editSelectOptions,
    onClose,
    onSave,
  ]);

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="2xl" onClose={onClose}>
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span>Edit custom field</span>
              <span className="text-sm font-normal text-default-500">
                {block.label}
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
                label="Description (optional)"
                minRows={2}
                placeholder="Help text"
                value={editDescription}
                variant="bordered"
                onValueChange={setEditDescription}
              />
              <Select
                label="Field type"
                selectedKeys={new Set([editInputType])}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const k = (keys as Set<string>).values().next().value;

                  if (k) setEditInputType(k as InputType);
                }}
              >
                {INPUT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
              {editInputType === "select" && (
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
              <div className="border-t border-default-100 pt-4">
                <FieldDefaultValueEditor
                  inputType={editInputType}
                  scaleConfig={editScaleConfig}
                  selectOptions={editSelectOptions}
                  value={editEmptyDefault}
                  onChange={setEditEmptyDefault}
                />
              </div>
              {editInputType === "scale" && (
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
                </div>
              )}
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
  );
}
