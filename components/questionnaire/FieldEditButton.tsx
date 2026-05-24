"use client";

import { Button } from "@heroui/button";

interface FieldEditButtonProps {
  fieldLabel: string;
  customized?: boolean;
  onPress: () => void;
}

function PencilIcon() {
  return (
    <svg
      aria-hidden
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

/** Edit control aligned with the field input row in questionnaire edit mode. */
export function FieldEditButton({
  fieldLabel,
  customized = false,
  onPress,
}: FieldEditButtonProps) {
  return (
    <Button
      isIconOnly
      aria-label={`Edit field: ${fieldLabel}`}
      className={
        customized
          ? "h-10 w-10 min-w-10 shrink-0 border-primary/40 bg-primary/10 text-primary shadow-sm"
          : "h-10 w-10 min-w-10 shrink-0 border-default-300 bg-content1 text-default-600 shadow-sm hover:border-default-400 hover:bg-default-100"
      }
      radius="md"
      title={customized ? "Edit field (customized)" : "Edit field"}
      variant="bordered"
      onPress={onPress}
    >
      <PencilIcon />
    </Button>
  );
}
