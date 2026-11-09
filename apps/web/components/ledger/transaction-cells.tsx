"use client";

import { Eye, EyeOff } from "lucide-react";
import { CategoryPickerPopover } from "@/components/category-picker-popover";
import type { LedgerCategoryItem } from "./transaction-filter-bar";

export interface TransactionTimeWithEmailCellProps {
  transactionDate: string;
  hasEmailProof: boolean;
  onViewEmailProof: () => void;
}

export function TransactionTimeWithEmailCell({
  transactionDate,
  hasEmailProof,
  onViewEmailProof,
}: TransactionTimeWithEmailCellProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <time className="transaction-time-cell">
        <span className="date-text">
          {new Date(transactionDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          })}
        </span>
        <span className="time-text">
          {new Date(transactionDate).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Kolkata",
          })}
        </span>
      </time>

      {hasEmailProof ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewEmailProof();
          }}
          title="View source email proof (Gmail alert)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            background: "rgba(59, 130, 246, 0.1)",
            color: "#3b82f6",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}>
          <Eye size={12} />
        </button>
      ) : (
        <span
          title="No email proof available"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "transparent",
            color: "var(--muted)",
            opacity: 0.2,
            cursor: "not-allowed",
            flexShrink: 0,
          }}>
          <EyeOff size={12} />
        </span>
      )}
    </div>
  );
}

export interface TransactionCategoryCellProps {
  categoryId?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  superCategory?: string | null;
  isTransfer: boolean;
  isPopoverOpen: boolean;
  categories: LedgerCategoryItem[];
  onTogglePopover: () => void;
  onClosePopover: () => void;
  onSelectCategory: (newCategoryId: string) => void;
}

export function TransactionCategoryCell({
  categoryId,
  categoryName,
  categoryColor,
  superCategory,
  isTransfer,
  isPopoverOpen,
  categories,
  onTogglePopover,
  onClosePopover,
  onSelectCategory,
}: TransactionCategoryCellProps) {
  return (
    <div
      className="transaction-category-cell"
      style={{ position: "relative", zIndex: isPopoverOpen ? 100 : 1 }}>
      <button
        type="button"
        className="transaction-cat-btn"
        onClick={onTogglePopover}
        title="Click to change category">
        <div className="transaction-cat-primary">
          <span
            className="transaction-cat-dot"
            style={{
              background:
                categoryColor || (categoryId ? "#3b82f6" : "#94a3b8"),
            }}
          />
          <span
            className={`transaction-cat-name ${
              !categoryId ? "uncategorised" : ""
            }`}>
            {categoryName || "Uncategorised"}
          </span>
          {isTransfer && (
            <span
              title="Reconciled Transfer Pair"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 4px",
                borderRadius: "4px",
                background: "rgba(59, 130, 246, 0.1)",
                color: "#3b82f6",
                fontSize: "9px",
                fontWeight: 800,
                marginLeft: "2px",
              }}>
              ⇄
            </span>
          )}
        </div>
        {superCategory && (
          <span className="transaction-super-label">{superCategory}</span>
        )}
      </button>

      {isPopoverOpen && (
        <CategoryPickerPopover
          categories={categories}
          currentCategoryId={categoryId ?? null}
          onSelect={(newCatId) => {
            onSelectCategory(newCatId);
            onClosePopover();
          }}
          onClose={onClosePopover}
        />
      )}
    </div>
  );
}
