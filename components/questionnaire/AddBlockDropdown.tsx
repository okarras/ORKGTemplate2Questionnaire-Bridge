"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@heroui/dropdown";

export type AddBlockKind = "text" | "section" | "customField" | "html";

function AddIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function AddBlockDropdown({
  afterIndex,
  addBlock,
}: {
  afterIndex: number;
  addBlock: (
    type: AddBlockKind,
    afterIndex: number,
    parentSectionId?: string,
  ) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownTrigger>
        <Button
          className="border-dashed border-2 border-default-300 font-medium text-default-500 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
          size="sm"
          startContent={<AddIcon />}
          variant="bordered"
        >
          Add block
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Add block"
        classNames={{
          list: "gap-0.5",
        }}
      >
        <DropdownSection title="Insert">
          <DropdownItem
            key="text"
            description="Instructions or explanatory text"
            startContent={
              <span className="text-base" role="img" aria-label="text">
                📝
              </span>
            }
            onPress={() => addBlock("text", afterIndex)}
          >
            Text block
          </DropdownItem>
          <DropdownItem
            key="section"
            description="Group fields under a heading"
            startContent={
              <span className="text-base" role="img" aria-label="section">
                📂
              </span>
            }
            onPress={() => addBlock("section", afterIndex)}
          >
            Section header
          </DropdownItem>
          <DropdownItem
            key="field"
            description="Add a custom input field"
            startContent={
              <span className="text-base" role="img" aria-label="field">
                ⚙️
              </span>
            }
            onPress={() => addBlock("customField", afterIndex)}
          >
            Custom field
          </DropdownItem>
          <DropdownItem
            key="html"
            description="Rich content with HTML markup"
            startContent={
              <span className="text-base" role="img" aria-label="html">
                🔲
              </span>
            }
            onPress={() => addBlock("html", afterIndex)}
          >
            HTML block
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}
