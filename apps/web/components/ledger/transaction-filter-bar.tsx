"use client";

import { RotateCcw, Search, X } from "lucide-react";

export type CategoryFilterGroup =
  | "ALL"
  | "EXPENSE"
  | "INCOME"
  | "INVESTMENT"
  | "TRANSFER";

export type LedgerCategoryItem = {
  id: string;
  name: string;
  color: string;
  type?: "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER";
  superCategoryId?: string | null;
  superCategoryName?: string | null;
  superCategoryColor?: string | null;
  superCategoryKind?: string | null;
};

export type LedgerAccountOption = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  cardLast4: string | null;
};

export type LedgerTagOption = {
  id: string;
  name: string;
  color: string;
};

export interface TransactionFilterBarProps {
  categories: LedgerCategoryItem[];
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  typeFilter: "ALL" | "EXPENSE" | "INCOME";
  onTypeFilterChange: (type: "ALL" | "EXPENSE" | "INCOME") => void;
  startDate: string;
  onStartDateChange: (startDate: string) => void;
  endDate: string;
  onEndDateChange: (endDate: string) => void;
  minAmount: string;
  onMinAmountChange: (minAmount: string) => void;
  maxAmount: string;
  onMaxAmountChange: (maxAmount: string) => void;
  activeFilterCount: number;
  onResetFilters: () => void;
  categoryGroup?: CategoryFilterGroup;
  onCategoryGroupChange?: (group: CategoryFilterGroup) => void;
  accounts?: LedgerAccountOption[];
  accountId?: string;
  onAccountChange?: (accountId: string) => void;
  allAccountsLabel?: string;
  tags?: LedgerTagOption[];
  tagId?: string;
  onTagChange?: (tagId: string) => void;
  containerMargin?: string;
}

export function TransactionFilterBar({
  categories,
  categoryId,
  onCategoryChange,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  activeFilterCount,
  onResetFilters,
  categoryGroup = "ALL",
  onCategoryGroupChange,
  accounts,
  accountId = "all",
  onAccountChange,
  allAccountsLabel = "All Accounts",
  tags,
  tagId = "all",
  onTagChange,
  containerMargin = "0 0 20px 0",
}: TransactionFilterBarProps) {
  const applyDateRange = (start: string, end: string) => {
    onStartDateChange(start);
    onEndDateChange(end);
  };

  const applyAmountRange = (min: string, max: string) => {
    onMinAmountChange(min);
    onMaxAmountChange(max);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        margin: containerMargin,
        padding: "16px",
        background: "var(--background-alt)",
        borderRadius: "14px",
        border: "1px solid var(--line)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
      }}>
      {onCategoryGroupChange && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
            Group:
          </span>
          {(
            [
              { id: "ALL", label: "All Groups" },
              { id: "EXPENSE", label: "Expense" },
              { id: "INCOME", label: "Income" },
              { id: "INVESTMENT", label: "Investment" },
              { id: "TRANSFER", label: "Transfer" },
            ] as const
          ).map((grp) => (
            <button
              key={grp.id}
              type="button"
              className={`secondary compact ${categoryGroup === grp.id ? "active" : ""}`}
              onClick={() => onCategoryGroupChange(grp.id)}
              style={{
                fontSize: "11px",
                padding: "3px 9px",
                borderRadius: "6px",
                fontWeight: 600,
              }}>
              {grp.label}
            </button>
          ))}
        </div>
      )}

      {/* Top Row: Account Select & Category Select & Tag Select & Search & Type Toggle & Reset */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
        {accounts && onAccountChange && (
          <div style={{ flex: "1 1 150px", minWidth: "140px" }}>
            <select
              value={accountId}
              onChange={(e) => onAccountChange(e.target.value)}
              style={{
                width: "100%",
                height: "38px",
                fontSize: "13px",
                padding: "0 10px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--background)",
                color: "var(--ink)",
                fontWeight: 600,
              }}>
              <option value="all">{allAccountsLabel}</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}{" "}
                  {acc.cardLast4
                    ? `(••••${acc.cardLast4})`
                    : acc.institution
                      ? `· ${acc.institution}`
                      : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Grouped Category Filter Dropdown */}
        <div style={{ flex: "1 1 180px", minWidth: "160px" }}>
          <select
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{
              width: "100%",
              height: "38px",
              fontSize: "13px",
              padding: "0 10px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "var(--background)",
              color: "var(--ink)",
              fontWeight: 600,
            }}>
            <option value="all">
              {categoryGroup === "ALL"
                ? "All Categories"
                : `All ${categoryGroup.charAt(0) + categoryGroup.slice(1).toLowerCase()} Categories`}
            </option>
            <option value="uncategorised">Uncategorised</option>
            {(() => {
              const filtered = categories.filter((cat) => {
                if (categoryGroup === "ALL") return true;
                const kind =
                  cat.superCategoryKind || (cat.type ? cat.type : "EXPENSE");
                return kind === categoryGroup;
              });
              const groups: Record<string, LedgerCategoryItem[]> = {};
              filtered.forEach((c) => {
                const grp =
                  c.superCategoryName ||
                  (c.type
                    ? `${c.type.charAt(0) + c.type.slice(1).toLowerCase()}`
                    : "General");
                if (!groups[grp]) groups[grp] = [];
                groups[grp].push(c);
              });
              return Object.entries(groups).map(([grp, items]) => (
                <optgroup key={grp} label={grp}>
                  {items.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        </div>

        {/* Tag / Event Filter Dropdown */}
        {tags && onTagChange && (
          <div style={{ flex: "1 1 150px", minWidth: "140px" }}>
            <select
              value={tagId}
              onChange={(e) => onTagChange(e.target.value)}
              style={{
                width: "100%",
                height: "38px",
                fontSize: "13px",
                padding: "0 10px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--background)",
                color: "var(--ink)",
                fontWeight: 600,
              }}>
              <option value="all">All Tags &amp; Events</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Bar */}
        <div
          style={{
            position: "relative",
            flex: "1 1 200px",
            minWidth: "180px",
          }}>
          <Search
            size={16}
            color="var(--muted)"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search description or merchant..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              height: "38px",
              fontSize: "13px",
              paddingLeft: "36px",
              paddingRight: search ? "32px" : "12px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "var(--background)",
              color: "var(--ink)",
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
              }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Type Filter Segmented Controls */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "var(--background)",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
          }}>
          <button
            type="button"
            className={`secondary compact ${typeFilter === "ALL" ? "active" : ""}`}
            onClick={() => onTypeFilterChange("ALL")}
            style={{
              height: "32px",
              padding: "0 12px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              borderRadius: "6px",
            }}>
            All
          </button>
          <button
            type="button"
            className={`secondary compact ${typeFilter === "EXPENSE" ? "active" : ""}`}
            onClick={() => onTypeFilterChange("EXPENSE")}
            style={{
              height: "32px",
              padding: "0 12px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              borderRadius: "6px",
              color: typeFilter === "EXPENSE" ? "#ef4444" : undefined,
            }}>
            Debits
          </button>
          <button
            type="button"
            className={`secondary compact ${typeFilter === "INCOME" ? "active" : ""}`}
            onClick={() => onTypeFilterChange("INCOME")}
            style={{
              height: "32px",
              padding: "0 12px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              borderRadius: "6px",
              color: typeFilter === "INCOME" ? "#10b981" : undefined,
            }}>
            Credits
          </button>
        </div>

        {/* Reset Filters Chip */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            className="ghost compact"
            onClick={onResetFilters}
            style={{
              height: "38px",
              fontSize: "12px",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0 12px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}>
            <RotateCcw size={14} /> Reset ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Bottom Grid: Date Range Card & Amount Range Card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "12px",
        }}>
        {/* Date Range Card */}
        <div
          style={{
            background: "var(--background)",
            borderRadius: "10px",
            padding: "12px 14px",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
              Date Range
            </span>
            {(startDate || endDate) && (
              <small
                style={{
                  fontSize: "11px",
                  color: "#8b5cf6",
                  fontWeight: 600,
                }}>
                Filter active
              </small>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "var(--muted)",
                  marginBottom: "3px",
                }}>
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                style={{
                  width: "100%",
                  height: "34px",
                  fontSize: "12px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background-alt)",
                  color: "var(--ink)",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "var(--muted)",
                  marginBottom: "3px",
                }}>
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                style={{
                  width: "100%",
                  height: "34px",
                  fontSize: "12px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background-alt)",
                  color: "var(--ink)",
                }}
              />
            </div>
          </div>

          {/* Date Presets */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              marginTop: "2px",
            }}>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => {
                const now = new Date();
                const first = new Date(now.getFullYear(), now.getMonth(), 1)
                  .toISOString()
                  .slice(0, 10);
                const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                  .toISOString()
                  .slice(0, 10);
                applyDateRange(first, last);
              }}>
              This Month
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => {
                const now = new Date();
                const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                  .toISOString()
                  .slice(0, 10);
                const last = new Date(now.getFullYear(), now.getMonth(), 0)
                  .toISOString()
                  .slice(0, 10);
                applyDateRange(first, last);
              }}>
              Last Month
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => {
                const end = new Date().toISOString().slice(0, 10);
                const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 10);
                applyDateRange(start, end);
              }}>
              Last 30 Days
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => {
                const end = new Date().toISOString().slice(0, 10);
                const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 10);
                applyDateRange(start, end);
              }}>
              Last 90 Days
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => {
                const now = new Date();
                const today = now.toISOString().slice(0, 10);
                const sixMonthsAgo = new Date(now);
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                applyDateRange(sixMonthsAgo.toISOString().slice(0, 10), today);
              }}>
              Last 6 Months
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => {
                const now = new Date();
                const curYear = now.getFullYear();
                const isAfterMarch = now.getMonth() >= 3;
                const fyStart = isAfterMarch
                  ? `${curYear}-04-01`
                  : `${curYear - 1}-04-01`;
                const fyEnd = isAfterMarch
                  ? `${curYear + 1}-03-31`
                  : `${curYear}-03-31`;
                applyDateRange(fyStart, fyEnd);
              }}>
              This FY
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => {
                const now = new Date();
                const curYear = now.getFullYear();
                const isAfterMarch = now.getMonth() >= 3;
                const prevFyStart = isAfterMarch
                  ? `${curYear - 1}-04-01`
                  : `${curYear - 2}-04-01`;
                const prevFyEnd = isAfterMarch
                  ? `${curYear}-03-31`
                  : `${curYear - 1}-03-31`;
                applyDateRange(prevFyStart, prevFyEnd);
              }}>
              Previous FY
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => applyDateRange("", "")}>
              All Time
            </button>
          </div>
        </div>

        {/* Amount Range Card */}
        <div
          style={{
            background: "var(--background)",
            borderRadius: "10px",
            padding: "12px 14px",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
              Amount Range (₹)
            </span>
            {(minAmount || maxAmount) && (
              <small
                style={{
                  fontSize: "11px",
                  color: "#8b5cf6",
                  fontWeight: 600,
                }}>
                Filter active
              </small>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "var(--muted)",
                  marginBottom: "3px",
                }}>
                Min ₹
              </label>
              <input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={(e) => onMinAmountChange(e.target.value)}
                style={{
                  width: "100%",
                  height: "34px",
                  fontSize: "12px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background-alt)",
                  color: "var(--ink)",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "var(--muted)",
                  marginBottom: "3px",
                }}>
                Max ₹
              </label>
              <input
                type="number"
                placeholder="No max"
                value={maxAmount}
                onChange={(e) => onMaxAmountChange(e.target.value)}
                style={{
                  width: "100%",
                  height: "34px",
                  fontSize: "12px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background-alt)",
                  color: "var(--ink)",
                }}
              />
            </div>
          </div>
          {/* Amount Presets */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              marginTop: "2px",
            }}>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => applyAmountRange("0", "1000")}>
              &lt; ₹1k
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => applyAmountRange("1000", "10000")}>
              ₹1k – ₹10k
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => applyAmountRange("10000", "50000")}>
              ₹10k – ₹50k
            </button>
            <button
              type="button"
              className="ghost compact"
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
              }}
              onClick={() => applyAmountRange("50000", "")}>
              &gt; ₹50k
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
