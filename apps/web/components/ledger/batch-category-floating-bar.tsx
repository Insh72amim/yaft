"use client";

import { ChevronDown } from "lucide-react";
import { CategoryPickerPopover } from "@/components/category-picker-popover";
import type { LedgerCategoryItem } from "./transaction-filter-bar";

export interface BatchCategoryFloatingBarProps {
  selectedCount: number;
  batchUpdating: boolean;
  batchCatPickerOpen: boolean;
  onTogglePicker: () => void;
  onClosePicker: () => void;
  categories: LedgerCategoryItem[];
  onSelectCategory: (categoryId: string) => void;
  onDeselectAll: () => void;
}

export function BatchCategoryFloatingBar({
  selectedCount,
  batchUpdating,
  batchCatPickerOpen,
  onTogglePicker,
  onClosePicker,
  categories,
  onSelectCategory,
  onDeselectAll,
}: BatchCategoryFloatingBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "16px",
        boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}>
      <span
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "var(--ink)",
        }}>
        {selectedCount} transaction{selectedCount === 1 ? "" : "s"} selected
      </span>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
        <button
          type="button"
          className="secondary compact"
          disabled={batchUpdating}
          onClick={onTogglePicker}
          style={{
            height: "34px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "8px",
            padding: "0 12px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            background: "var(--background)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}>
          <span>
            {batchUpdating ? "Updating…" : "Set category for all selected…"}
          </span>
          <ChevronDown size={13} style={{ color: "var(--muted)" }} />
        </button>

        {batchCatPickerOpen && (
          <CategoryPickerPopover
            categories={categories}
            currentCategoryId={null}
            onSelect={(newCatId) => {
              onSelectCategory(newCatId);
              onClosePicker();
            }}
            onClose={onClosePicker}
          />
        )}

        <button
          type="button"
          className="ghost compact"
          onClick={onDeselectAll}
          style={{
            height: "34px",
            fontSize: "12px",
            color: "var(--muted)",
          }}>
          Deselect
        </button>
      </div>
    </div>
  );
}
