"use client";

import { useState } from "react";
import {
  Plus,
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Loader2,
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
  categoryName: string;
  categoryColor: string;
};

export type UnverifiedCategoryGroup = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  unverifiedCount: number;
  sampleDescriptions: string[];
  transactionIds: string[];
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
  if (activeTab === "CONFIRMATIONS") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <section className="panel" style={{ padding: "20px" }}>
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--green)" }}>Categorization Approvals Queue</span>
              <h2>Confirm Auto-Assigned Category Batches</h2>
            </div>
          </div>

          {unverifiedCategories.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "13px" }}>All transactions are verified! No pending auto-assignments in queue.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
              {unverifiedCategories.map((group) => (
                <div key={group.categoryId} style={{ background: "var(--background-alt)", border: "1px solid var(--line)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ padding: "4px 10px", borderRadius: "6px", background: `${group.categoryColor}20`, color: group.categoryColor, fontWeight: 700, fontSize: "12px" }}>
                        {group.categoryName}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>{group.unverifiedCount} rows pending</span>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--muted)", display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0" }}>
                      <strong>Sample descriptions:</strong>
                      {group.sampleDescriptions.slice(0, 3).map((desc, idx) => (
                        <span key={idx} style={{ opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          • {desc}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={confirmingCatId === group.categoryId}
                    onClick={() => handleConfirmGroup(group.transactionIds, group.categoryId)}
                    className="primary compact"
                    style={{ width: "100%", justifyContent: "center", display: "inline-flex", gap: "6px" }}>
                    {confirmingCatId === group.categoryId ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                    <span>Confirm All {group.unverifiedCount} Transactions</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>Auto-Categorization Rules</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>Automate statement transaction tagging based on merchant patterns, reference numbers, or description keywords.</p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="secondary compact"
            onClick={handleSeedRules}
            disabled={seedingRules}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <RotateCcw size={14} />
            <span>{seedingRules ? "Seeding..." : "Seed Default Rules"}</span>
          </button>

          <button
            type="button"
            className="primary compact"
            onClick={handleApplyRules}
            disabled={applyingRules}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={14} />
            <span>{applyingRules ? "Applying..." : "Run All Rules Retroactively"}</span>
          </button>
        </div>
      </div>

      {/* Rule Creator Form */}
      <section className="panel" style={{ padding: "20px" }}>
        <div className="panel-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Rule Engine</span>
            <h2>Create New Categorization Rule</h2>
          </div>
        </div>

        <form onSubmit={handleCreateRule} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Merchant / Pattern *</label>
            <input
              type="text"
              placeholder="e.g. ZOMATO, SWIGGY, INDIGO"
              value={rulePattern}
              onChange={(e) => setRulePattern(e.target.value)}
              required
              style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Match Field</label>
            <select
              value={ruleMatchField}
              onChange={(e: any) => setRuleMatchField(e.target.value)}
              style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
              <option value="DESCRIPTION">Description / Narration</option>
              <option value="MERCHANT">Merchant Name</option>
              <option value="REFERENCE">Reference / UTR Number</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Match Operator</label>
            <select
              value={ruleMatchType}
              onChange={(e: any) => setRuleMatchType(e.target.value)}
              style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
              <option value="CONTAINS">Contains Keyword</option>
              <option value="EXACT">Exact Match</option>
              <option value="STARTS_WITH">Starts With</option>
              <option value="REGEX">Regex Pattern</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Assign Category *</label>
            <select
              value={ruleCategoryId}
              onChange={(e) => setRuleCategoryId(e.target.value)}
              required
              style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.type || "EXPENSE"})</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={creatingRule || !rulePattern.trim()}
            className="primary compact"
            style={{ height: "38px", padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            {creatingRule ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
            <span>Add Rule</span>
          </button>
        </form>
      </section>

      {/* Rules Directory Table */}
      <section className="panel" style={{ padding: "20px" }}>
        <div className="panel-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Rule Directory</span>
            <h2>Active Categorization Rules ({rules.length})</h2>
          </div>
        </div>

        {rules.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>No categorization rules configured yet. Click "Seed Default Rules" to generate standard rules.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "10px" }}>Pattern / Keyword</th>
                  <th style={{ padding: "10px" }}>Match Field</th>
                  <th style={{ padding: "10px" }}>Operator</th>
                  <th style={{ padding: "10px" }}>Assigned Category</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "var(--ink)" }}>{rule.pattern}</td>
                    <td style={{ padding: "10px", color: "var(--muted)" }}>{rule.matchField}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ background: "var(--background-alt)", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, color: "var(--ink)" }}>
                        {rule.matchType}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: "6px", background: `${rule.categoryColor}20`, color: rule.categoryColor, fontWeight: 700, fontSize: "11px" }}>
                        {rule.categoryName}
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      <button
                        type="button"
                        className="icon-button danger"
                        title="Delete Rule"
                        onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
