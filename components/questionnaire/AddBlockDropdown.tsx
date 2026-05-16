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
          className="border-dashed border-2 border-default-400 font-medium text-default-600 hover:border-primary hover:bg-primary/5 hover:text-primary"
          endContent={
            <span
              className={`text-[10px] text-default-400 transition-transform duration-200 ${
                menuOpen ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          }
          size="md"
          variant="bordered"
        >
          + Add block
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Add block">
        <DropdownSection title="Insert">
          <DropdownItem key="text" onPress={() => addBlock("text", afterIndex)}>
            Text / instructions
          </DropdownItem>
          <DropdownItem
            key="section"
            onPress={() => addBlock("section", afterIndex)}
          >
            Section header
          </DropdownItem>
          <DropdownItem
            key="field"
            onPress={() => addBlock("customField", afterIndex)}
          >
            Custom field
          </DropdownItem>
          <DropdownItem key="html" onPress={() => addBlock("html", afterIndex)}>
            HTML block
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}
