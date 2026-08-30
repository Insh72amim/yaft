"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Check } from "lucide-react";

export interface CategoryItem {
  id: string;
  name: string;
  color?: string | null;
  superCategoryId?: string | null;
  superCategoryName?: string | null;
  superCategoryKind?: string | null;
  type?: string;
}

interface CategoryPickerPopoverProps {
  categories: CategoryItem[];
  currentCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
  align?: "left" | "right";
}

export function CategoryPickerPopover({
  categories,
  currentCategoryId,
  onSelect,
  onClose,
  align = "left",
}: CategoryPickerPopoverProps) {
  const [search, setSearch] = useState("");
  const [openUpwards, setOpenUpwards] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter and group categories
  const filteredCategories = categories.filter((c) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.superCategoryName && c.superCategoryName.toLowerCase().includes(query))
    );
  });

  const groups: { [key: string]: CategoryItem[] } = {};
  filteredCategories.forEach((c) => {
    const grp =
      c.superCategoryName ||
      (c.type ? `${c.type.charAt(0) + c.type.slice(1).toLowerCase()}` : "General");
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(c);
  });

  // Flat list of visible selectable items in display order
  const flatItems: CategoryItem[] = [];
  Object.values(groups).forEach((items) => {
    flatItems.push(...items);
  });

  useEffect(() => {
    inputRef.current?.focus();

    // Check if popover extends below viewport bottom and flip upwards only when space below is constrained and space above is sufficient
    if (popoverRef.current) {
      const parent = popoverRef.current.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const spaceBelow = window.innerHeight - parentRect.bottom;
        const spaceAbove = parentRect.top;
        if (spaceBelow < 280 && spaceAbove > spaceBelow && spaceAbove >= 200) {
          setOpenUpwards(true);
        } else {
          setOpenUpwards(false);
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Reset highlight index on search change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems.length === 1) {
        // Auto-select when search has only 1 option
        onSelect(flatItems[0].id);
        onClose();
      } else if (flatItems.length > 1 && flatItems[highlightedIndex]) {
        onSelect(flatItems[highlightedIndex].id);
        onClose();
      } else if (!search.trim() && !currentCategoryId) {
        onSelect("");
        onClose();
      }
    }
  };

  return (
    <div
      ref={popoverRef}
      className="category-picker-popover"
      style={{
        position: "absolute",
        ...(openUpwards
          ? { bottom: "calc(100% + 4px)", top: "auto" }
          : { top: "calc(100% + 4px)", bottom: "auto" }),
        ...(align === "right" ? { right: 0 } : { left: 0 }),
        zIndex: 1000,
        width: "250px",
        maxHeight: "360px",
        backgroundColor: "var(--card, #ffffff)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // Prevents scroll items from passing above or outside the popover
      }}>
      {/* Pinned Search Header - fully isolated from scrollable list */}
      <div
        style={{
          padding: "8px",
          backgroundColor: "var(--card, #ffffff)",
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--background-alt)",
            borderRadius: "8px",
            padding: "5px 8px",
            border: "1px solid var(--line)",
          }}>
          <Search size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleInputKeyDown}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "12px",
              outline: "none",
              width: "100%",
              color: "var(--ink)",
              padding: 0,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                inputRef.current?.focus();
              }}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 0,
                color: "var(--muted)",
                display: "flex",
              }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Category Options - strictly below the search header */}
      <div
        style={{
          overflowY: "auto",
          padding: "6px 8px 8px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          maxHeight: "280px",
          flex: 1,
        }}>
        {/* Quick Uncategorised Option */}
        {!search.trim() && (
          <button
            type="button"
            onClick={() => {
              onSelect("");
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              borderRadius: "6px",
              background: !currentCategoryId ? "var(--theme-soft-start)" : "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#94a3b8",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: !currentCategoryId ? "var(--green)" : "var(--muted)",
                  fontStyle: "italic",
                }}>
                Uncategorised
              </span>
            </div>
            {!currentCategoryId && <Check size={13} color="var(--green)" />}
          </button>
        )}

        {/* Grouped Category Options */}
        {Object.keys(groups).length === 0 ? (
          <div
            style={{
              padding: "16px 8px",
              textAlign: "center",
              fontSize: "12px",
              color: "var(--muted)",
            }}>
            No matching categories
          </div>
        ) : (
          Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <div
                style={{
                  fontSize: "9.5px",
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  padding: "6px 8px 2px",
                }}>
                {groupName}
              </div>
              {items.map((cat) => {
                const isSelected = currentCategoryId === cat.id;
                const itemIndex = flatItems.findIndex((fi) => fi.id === cat.id);
                const isHighlighted = search.trim() ? itemIndex === highlightedIndex : false;
                const isOnlyOption = search.trim().length > 0 && flatItems.length === 1;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelect(cat.id);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background: isSelected
                        ? "var(--theme-soft-start)"
                        : isHighlighted || isOnlyOption
                        ? "var(--background-alt)"
                        : "transparent",
                      border: isOnlyOption
                        ? "1px solid var(--green)"
                        : isHighlighted
                        ? "1px solid var(--line)"
                        : "1px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "background 0.1s ease, border-color 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      setHighlightedIndex(itemIndex);
                      if (!isSelected) e.currentTarget.style.background = "var(--background-alt)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isHighlighted && !isOnlyOption) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                      <span
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: cat.color || "#3b82f6",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: isSelected || isOnlyOption ? 700 : 600,
                          color: isSelected || isOnlyOption ? "var(--green)" : "var(--ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                        {cat.name}
                      </span>
                    </div>
                    {isSelected && <Check size={13} color="var(--green)" />}
                    {!isSelected && isOnlyOption && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--green)",
                          fontWeight: 600,
                          background: "var(--theme-soft-start)",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}>
                        ↵ Enter
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
