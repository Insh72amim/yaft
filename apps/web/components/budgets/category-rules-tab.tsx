"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Loader2,
  X,
  Search,
  Check,
  Tag as TagIcon,
  ShieldCheck,
  Code2,
} from "lucide-react";
import { money } from "@/lib/api";
import { CategoryOption } from "./envelopes-tab";

export type CategoryRuleItem = {
  id: string;
  pattern: string;
  matchField: "DESCRIPTION" | "MERCHANT" | "REFERENCE";
  matchType: "CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX";
  priority: number;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  category?: { id: string; name: string; color: string; superCategory?: { name: string; color: string; kind: string } | null };
};

export type UnverifiedCategoryGroup = {
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  category?: { id: string; name: string; color: string; superCategory?: { name: string; color: string; kind: string } | null };
  unverifiedCount?: number;
  totalCount?: number;
  sampleDescriptions?: string[];
  transactionIds?: string[];
  transactions?: Array<{
    id: string;
    transactionDate: string;
    descriptionRaw: string;
    merchant?: string | null;
    amount: number;
    userVerified: boolean;
  }>;
};

interface CategoryRulesTabProps {
  categories: CategoryOption[];
  rules: CategoryRuleItem[];
  unverifiedCategories: UnverifiedCategoryGroup[];
  rulePattern: string;
  setRulePattern: (pattern: string) => void;
  ruleMatchField: "DESCRIPTION" | "MERCHANT" | "REFERENCE";
  setRuleMatchField: (field: "DESCRIPTION" | "MERCHANT" | "REFERENCE") => void;
  ruleMatchType: "CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX";
  setRuleMatchType: (type: "CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX") => void;
  rulePriority: number;
  setRulePriority: (prio: number) => void;
  ruleCategoryId: string;
  setRuleCategoryId: (id: string) => void;
  creatingRule: boolean;
  seedingRules: boolean;
  applyingRules: boolean;
  confirmingCatId: string | null;
  handleCreateRule: (e: React.FormEvent) => Promise<void>;
  handleDeleteRule: (ruleId: string) => Promise<void>;
  handleApplyRules: () => Promise<void>;
  handleSeedRules: () => Promise<void>;
  handleConfirmGroup: (transactionIds: string[], categoryId: string) => Promise<void>;
  activeTab: "RULES" | "CONFIRMATIONS";
}

export function CategoryRulesTab({
  categories,
  rules,
  unverifiedCategories,
  rulePattern,
  setRulePattern,
  ruleMatchField,
  setRuleMatchField,
  ruleMatchType,
  setRuleMatchType,
  rulePriority,
  setRulePriority,
  ruleCategoryId,
  setRuleCategoryId,
  creatingRule,
  seedingRules,
  applyingRules,
  confirmingCatId,
  handleCreateRule,
  handleDeleteRule,
  handleApplyRules,
  handleSeedRules,
  handleConfirmGroup,
  activeTab,
}: CategoryRulesTabProps) {
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");

  const onSubmitCreateRule = async (e: React.FormEvent) => {
    await handleCreateRule(e);
    setRuleModalOpen(false);
  };

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const catName = rule.category?.name || rule.categoryName || "";
      const matchesSearch =
        rule.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
        catName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.matchField.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        selectedTypeFilter === "ALL" || rule.matchType === selectedTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [rules, searchQuery, selectedTypeFilter]);

  if (activeTab === "CONFIRMATIONS") {
    const totalPendingCount = unverifiedCategories.reduce(
      (sum, g) => sum + (g.unverifiedCount ?? g.transactions?.length ?? 0),
      0
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Categorization Approvals Queue
              </span>
            </div>
            <h3 style={{ margin: "4px 0 0 0", fontSize: "1.35rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              Confirm Auto-Assigned Category Batches
            </h3>
            <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
              Review and approve auto-categorized transactions across imported statements with 1-click batch confirmations.
            </p>
          </div>

          {unverifiedCategories.length > 0 && (
            <span style={{ background: "var(--background-alt)", border: "1px solid var(--line)", padding: "6px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
              {totalPendingCount} Pending Reviews
            </span>
          )}
        </div>

        {unverifiedCategories.length === 0 ? (
          <div style={{ background: "var(--card)", padding: "48px 24px", borderRadius: "16px", border: "1px solid var(--line)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)" }}>
                All Transactions Verified!
              </h4>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--muted)", maxWidth: "420px" }}>
                No pending auto-assignments in queue. All imported statement transactions have confirmed categories.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            {unverifiedCategories.map((group, gIdx) => {
              const catId = group.categoryId || group.category?.id || `group-${gIdx}`;
              const catName = group.categoryName || group.category?.name || "Uncategorized";
              const catColor = group.categoryColor || group.category?.color || "#3b82f6";
              const unverifiedCount = group.unverifiedCount ?? group.transactions?.length ?? 0;
              const sampleDescriptions = (group.sampleDescriptions && group.sampleDescriptions.length > 0)
                ? group.sampleDescriptions
                : group.transactions?.map((t) => t.merchant || t.descriptionRaw).filter(Boolean) || [];
              const txIds = group.transactionIds && group.transactionIds.length > 0
                ? group.transactionIds
                : group.transactions?.map((t) => t.id) || [];

              return (
                <div
                  key={catId}
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderLeft: `4px solid ${catColor}`,
                    borderRadius: "14px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "16px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                  }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: catColor, boxShadow: `0 0 0 3px ${catColor}25` }} />
                        <strong style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)" }}>
                          {catName}
                        </strong>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", background: "var(--background-alt)", color: "var(--muted)" }}>
                        {unverifiedCount} rows pending
                      </span>
                    </div>

                    {sampleDescriptions.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Sample Descriptions:
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {sampleDescriptions.slice(0, 3).map((desc, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: "12px",
                                color: "var(--ink)",
                                background: "var(--background-alt)",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--line)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}>
                              {desc}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={confirmingCatId === catId || txIds.length === 0}
                    onClick={() => handleConfirmGroup(txIds, catId)}
                    className="primary"
                    style={{ width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: 700 }}>
                    {confirmingCatId === catId ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    <span>Confirm All {unverifiedCount} Transactions</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Action Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Categorization Engine
            </span>
          </div>
          <h3 style={{ margin: "4px 0 0 0", fontSize: "1.35rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            Auto-Categorization Rules
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Automate transaction tagging based on merchant patterns, reference numbers, or description regex.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary"
            onClick={handleSeedRules}
            disabled={seedingRules}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "9px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 600 }}>
            <RotateCcw size={14} />
            <span>{seedingRules ? "Seeding..." : "Seed Default Rules"}</span>
          </button>

          <button
            type="button"
            className="secondary"
            onClick={handleApplyRules}
            disabled={applyingRules}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "9px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 600 }}>
            <Sparkles size={14} color="#f59e0b" />
            <span>{applyingRules ? "Applying..." : "Run Retroactively"}</span>
          </button>

          <button
            type="button"
            className="primary"
            onClick={() => setRuleModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "9px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, boxShadow: "0 2px 8px rgba(184, 91, 53, 0.25)" }}>
            <Plus size={16} />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Rules Directory Section */}
      <section className="panel" style={{ padding: "22px", borderRadius: "16px", border: "1px solid var(--line)", background: "var(--card)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        {/* Search & Filter Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
          <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search by pattern, category, or field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", height: "40px", paddingLeft: "36px", paddingRight: "12px", fontSize: "13px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
            />
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["ALL", "REGEX", "CONTAINS", "EXACT", "STARTS_WITH"].map((type) => (
              <button
                key={type}
                type="button"
                className={`secondary compact ${selectedTypeFilter === type ? "active" : ""}`}
                onClick={() => setSelectedTypeFilter(type)}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: selectedTypeFilter === type ? "var(--ink)" : "var(--background-alt)",
                  color: selectedTypeFilter === type ? "var(--background)" : "var(--muted)",
                  border: "1px solid var(--line)",
                  cursor: "pointer",
                }}>
                {type === "ALL" ? `All (${rules.length})` : type}
              </button>
            ))}
          </div>
        </div>

        {rules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Code2 size={24} />
            </div>
            <strong style={{ fontSize: "15px", color: "var(--ink)" }}>No Categorization Rules Configured</strong>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", maxWidth: "420px" }}>
              Click &quot;Seed Default Rules&quot; to populate standard rules for Indian and international bank statements, or create your custom pattern rules.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button type="button" className="secondary compact" onClick={handleSeedRules} disabled={seedingRules}>
                <RotateCcw size={14} />
                <span>Seed Defaults</span>
              </button>
              <button type="button" className="primary compact" onClick={() => setRuleModalOpen(true)}>
                <Plus size={14} />
                <span>Add First Rule</span>
              </button>
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center", padding: "30px" }}>
            No rules matching &quot;{searchQuery}&quot;.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--line)", textAlign: "left", color: "var(--muted)", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "12px 14px" }}>Pattern / Keyword</th>
                  <th style={{ padding: "12px 14px" }}>Match Field</th>
                  <th style={{ padding: "12px 14px" }}>Operator</th>
                  <th style={{ padding: "12px 14px" }}>Assigned Category</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => {
                  const catName = rule.category?.name || rule.categoryName || "Unknown Category";
                  const catColor = rule.category?.color || rule.categoryColor || "#3b82f6";

                  return (
                    <tr key={rule.id} style={{ borderBottom: "1px solid var(--line)", transition: "background 0.1s ease" }}>
                      <td style={{ padding: "12px 14px", maxWidth: "340px" }}>
                        <code
                          style={{
                            display: "inline-block",
                            background: "var(--background-alt)",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            fontSize: "12px",
                            color: "var(--ink)",
                            fontWeight: 600,
                            fontFamily: "monospace",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "320px",
                          }}
                          title={rule.pattern}>
                          {rule.pattern}
                        </code>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", background: "var(--background-alt)", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                          {rule.matchField === "DESCRIPTION" ? "Description" : rule.matchField === "MERCHANT" ? "Merchant" : "Reference"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: rule.matchType === "REGEX" ? "rgba(139, 92, 246, 0.12)" : "var(--background-alt)",
                          color: rule.matchType === "REGEX" ? "#8b5cf6" : "var(--ink)",
                          border: rule.matchType === "REGEX" ? "1px solid rgba(139, 92, 246, 0.25)" : "1px solid var(--line)",
                        }}>
                          {rule.matchType}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          background: `${catColor}15`,
                          color: catColor,
                          fontWeight: 700,
                          fontSize: "12px",
                          border: `1px solid ${catColor}30`,
                        }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: catColor }} />
                          {rule.category?.superCategory?.name && (
                            <span style={{ opacity: 0.72, fontSize: "11px", fontWeight: 700 }}>
                              {rule.category.superCategory.name} &rsaquo;
                            </span>
                          )}
                          {catName}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="icon-button danger"
                          title="Delete Rule"
                          onClick={() => handleDeleteRule(rule.id)}
                          style={{ borderRadius: "8px" }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CREATE RULE MODAL */}
      {ruleModalOpen && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setRuleModalOpen(false)} aria-label="Close modal" />
          <section className="modal" style={{ width: "min(500px, 95vw)", padding: "26px", borderRadius: "16px", background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Code2 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)" }}>
                    Add Categorization Rule
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Define criteria to auto-assign categories
                  </p>
                </div>
              </div>
              <button type="button" className="icon-button" onClick={() => setRuleModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={onSubmitCreateRule} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                  Merchant / Pattern *
                </label>
                <input
                  type="text"
                  placeholder="e.g. ZOMATO, SWIGGY, INDIGO or regex pattern"
                  value={rulePattern}
                  onChange={(e) => setRulePattern(e.target.value)}
                  required
                  style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontFamily: ruleMatchType === "REGEX" ? "monospace" : "inherit" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Match Field</label>
                  <select
                    value={ruleMatchField}
                    onChange={(e: any) => setRuleMatchField(e.target.value)}
                    style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 10px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                    <option value="DESCRIPTION">Description / Narration</option>
                    <option value="MERCHANT">Merchant Name</option>
                    <option value="REFERENCE">Reference / UTR Number</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Match Operator</label>
                  <select
                    value={ruleMatchType}
                    onChange={(e: any) => setRuleMatchType(e.target.value)}
                    style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 10px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                    <option value="CONTAINS">Contains Keyword</option>
                    <option value="EXACT">Exact Match</option>
                    <option value="STARTS_WITH">Starts With</option>
                    <option value="REGEX">Regex Pattern</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                  Assign Target Category *
                </label>
                <select
                  value={ruleCategoryId}
                  onChange={(e) => setRuleCategoryId(e.target.value)}
                  required
                  style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  <option value="">Select Target Category...</option>
                  {(() => {
                    const groups: { [key: string]: typeof categories } = {};
                    const unassigned: typeof categories = [];
                    categories.forEach((c) => {
                      const groupName = c.superCategory?.name || (c.type ? `${c.type.charAt(0) + c.type.slice(1).toLowerCase()}` : "");
                      if (groupName) {
                        if (!groups[groupName]) groups[groupName] = [];
                        groups[groupName].push(c);
                      } else {
                        unassigned.push(c);
                      }
                    });
                    return (
                      <>
                        {Object.entries(groups).map(([grp, items]) => (
                          <optgroup key={grp} label={grp}>
                            {items.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        {unassigned.length > 0 && (
                          <optgroup label="General">
                            {unassigned.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="secondary" onClick={() => setRuleModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRule || !rulePattern.trim() || !ruleCategoryId}
                  className="primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  {creatingRule ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                  <span>Add Rule</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

