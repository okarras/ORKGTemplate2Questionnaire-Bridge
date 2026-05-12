"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Checkbox } from "@heroui/checkbox";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";

export interface OrkgResourceOption {
  id: string;
  label: string;
  creator?: string;
}

interface ResourceFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  classId?: string;
  initialSelectedIds: string[];
  onSave: (selected: { value: string; label: string }[]) => void;
}

export function ResourceFilterDialog({
  isOpen,
  onClose,
  propertyId,
  classId,
  initialSelectedIds,
  onSave,
}: ResourceFilterDialogProps) {
  const [resources, setResources] = useState<OrkgResourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<string>("all");

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedIds));
      if (resources.length === 0) {
        fetchResources();
      }
    }
  }, [isOpen, initialSelectedIds]);

  const fetchResources = async () => {
    const hasPredicate = propertyId.match(/^P\d+$/);
    const hasClass = classId?.match(/^C\d+$/);

    if (!hasPredicate && !hasClass) {
      return;
    }

    const params = new URLSearchParams();

    if (hasPredicate) params.set("predicateId", propertyId);
    if (classId) params.set("classId", classId);
    params.set("limit", "1000");

    setLoading(true);
    try {
      const res = await fetch(`/api/orkg/resources?${params.toString()}`);
      const data = await res.json();

      if (data.resources) {
        setResources(data.resources);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const uniqueCreators = useMemo(() => {
    const creators = new Set<string>();

    resources.forEach((r) => {
      if (r.creator) creators.add(r.creator);
    });

    return Array.from(creators).sort();
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchSearch =
        r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.includes(searchQuery);
      const matchCreator =
        selectedCreator === "all" || r.creator === selectedCreator;

      return matchSearch && matchCreator;
    });
  }, [resources, searchQuery, selectedCreator]);

  const allFilteredSelected =
    filteredResources.length > 0 &&
    filteredResources.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);

    if (allFilteredSelected) {
      filteredResources.forEach((r) => next.delete(r.id));
    } else {
      filteredResources.forEach((r) => next.add(r.id));
    }
    setSelectedIds(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSave = () => {
    const selectedOptions = resources
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ value: r.id, label: r.label }));

    onSave(selectedOptions);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="3xl" onClose={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Filter and Select Allowed Resources
            </ModalHeader>
            <ModalBody>
              <div className="flex gap-4 mb-2">
                <Input
                  isClearable
                  className="flex-1"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <Select
                  className="w-64"
                  label="Filter by Author"
                  selectedKeys={new Set([selectedCreator])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];

                    if (selected) setSelectedCreator(String(selected));
                  }}
                  items={[{ key: "all", label: "All Authors" }, ...uniqueCreators.map(c => ({ key: c, label: c }))]}
                >
                  {(item) => (
                    <SelectItem key={item.key}>
                      {item.label}
                    </SelectItem>
                  )}
                </Select>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-10">
                  <Spinner />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm text-default-500">
                      Showing {filteredResources.length} resources
                    </span>
                    <Button
                      color="primary"
                      size="sm"
                      variant="flat"
                      onPress={toggleSelectAll}
                    >
                      {allFilteredSelected
                        ? "Deselect All Filtered"
                        : "Select All Filtered"}
                    </Button>
                  </div>

                  <ScrollShadow className="h-[400px] border border-default-200 rounded-lg p-2">
                    {filteredResources.length === 0 ? (
                      <div className="text-center py-10 text-default-400">
                        No resources match your filters.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {filteredResources.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-3 p-2 hover:bg-default-100 rounded-md cursor-pointer transition-colors"
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleSelect(r.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleSelect(r.id);
                              }
                            }}
                          >
                            <Checkbox
                              isSelected={selectedIds.has(r.id)}
                              tabIndex={-1}
                              onValueChange={() => toggleSelect(r.id)}
                            />
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-sm font-medium truncate">
                                {r.label}
                              </span>
                              <span className="text-xs text-default-400">
                                {r.creator
                                  ? `Created by: ${r.creator}`
                                  : "System"}{" "}
                                • {r.id.split("/").pop()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollShadow>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <span className="text-sm text-default-500 mr-auto self-center">
                {selectedIds.size} resources selected total
              </span>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave}>
                Save Selection
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
