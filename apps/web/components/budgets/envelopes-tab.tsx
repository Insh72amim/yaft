"use client";

import { useState } from "react";
import {
  Calendar,
  Plus,
  Loader2,
  Edit2,
  Trash2,
} from "lucide-react";
import { money } from "@/lib/api";

export type CategoryOption = { id: string; name: string; type?: "EXPENSE" | "INCOME" | "INVESTMENT"; color: string };

export type CategoryBudgetItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  monthlyLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: "OK" | "WARNING" | "EXCEEDED";
};

interface EnvelopesTabProps {
  categories: CategoryOption[];
  budgets: CategoryBudgetItem[];
  summary: { totalBudgeted: number; totalSpent: number; totalRemaining: number; overallPercentage: number };
  selectedCatId: string;
  setSelectedCatId: (id: string) => void;
  limitInput: string;
  setLimitInput: (limit: string) => void;
  savingBudget: boolean;
  deletingBudgetId: string | null;
  handleSaveBudget: (e: React.FormEvent) => Promise<void>;
  handleDeleteBudget: (budgetId: string) => Promise<void>;
  setEditingCategory: (cat: CategoryOption | null) => void;
  setEditCatName: (name: string) => void;
  setEditCatType: (type: "EXPENSE" | "INCOME" | "INVESTMENT") => void;
  setEditCatColor: (color: string) => void;
  setEditCatBudgetLimit: (limit: string) => void;
}

export function EnvelopesTab({
  categories,
  budgets,
  summary,
  selectedCatId,
  setSelectedCatId,
  limitInput,
  setLimitInput,
  savingBudget,
  deletingBudgetId,
  handleSaveBudget,
  handleDeleteBudget,
  setEditingCategory,
  setEditCatName,
  setEditCatType,
  setEditCatColor,
  setEditCatBudgetLimit,
}: EnvelopesTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* KPI Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Total Monthly Budget</span>
          <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalBudgeted * 100)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
            <Calendar size={11} color="var(--green)" /> Current Month (Aug 2026)
          </small>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase" }}>Month-To-Date Spent</span>
          <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalSpent * 100)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
            <Calendar size={11} color="var(--green)" /> Aug 01 — Aug 15, 2026
          </small>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444", textTransform: "uppercase" }}>Total Remaining Budget</span>
          <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444", marginTop: "4px" }}>{money(summary.totalRemaining * 100)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
            <Calendar size={11} color="var(--green)" /> Remaining for Aug 2026
          </small>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Overall Envelope Usage</span>
          <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{summary.overallPercentage}%</strong>
          <div style={{ height: "6px", width: "100%", background: "var(--background-alt)", borderRadius: "3px", overflow: "hidden", marginTop: "6px" }}>
            <div style={{ height: "100%", width: `${Math.min(100, summary.overallPercentage)}%`, background: summary.overallPercentage > 100 ? "#ef4444" : summary.overallPercentage >= 80 ? "#f59e0b" : "var(--green)" }} />
          </div>
        </div>
      </div>

      {/* Set/Update Monthly Envelope Target Form */}
      <section className="panel" style={{ padding: "20px" }}>
        <div className="panel-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Envelope Allocation</span>
            <h2>Assign Target Monthly Spending Limit</h2>
          </div>
        </div>

        <form onSubmit={handleSaveBudget} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>Category</label>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}
            >
              {categories
                .filter((c) => (c.type || "EXPENSE") === "EXPENSE")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>Monthly Target (₹)</label>
            <input
              type="number"
              placeholder="e.g. 15000"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              step="100"
              style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
            />
          </div>

          <button
            type="submit"
            disabled={savingBudget}
            className="secondary compact"
            style={{ height: "40px", padding: "0 20px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700, borderRadius: "8px" }}
          >
            {savingBudget ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            <span>Save Target Envelope</span>
          </button>
        </form>
      </section>

      {/* Expense Categories & Budget Envelopes Grid */}
      <section className="panel" style={{ padding: "20px" }}>
        <div className="panel-title" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Real-Time Envelopes &amp; Directory</span>
            <h2>Expense Categories &amp; Budget Envelopes ({categories.filter((c) => (c.type || "EXPENSE") === "EXPENSE").length})</h2>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="month-pill" style={{ fontSize: "11px" }}>
              {budgets.length} Active Envelopes
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "16px" }}>
          {categories
            .filter((c) => (c.type || "EXPENSE") === "EXPENSE")
            .map((cat) => {
              const budget = budgets.find((b) => b.categoryId === cat.id);
              const spent = budget ? budget.spentAmount : 0;
              const limit = budget ? budget.monthlyLimit : 0;
              const pct = budget ? budget.percentage : 0;
              const status = budget ? budget.status : "OK";

              return (
                <div
                  key={cat.id}
                  style={{
                    background: "var(--background-alt)",
                    border: budget ? (status === "EXCEEDED" ? "1px solid #ef4444" : status === "WARNING" ? "1px solid #f59e0b" : "1px solid var(--line)") : "1px dashed var(--line)",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: cat.color, display: "inline-block" }} />
                      <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{cat.name}</strong>
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button
                        type="button"
                        className="icon-button"
                        title="Edit Category & Monthly Envelope Limit"
                        onClick={() => {
                          setEditingCategory(cat);
                          setEditCatName(cat.name);
                          setEditCatType((cat.type as any) || "EXPENSE");
                          setEditCatColor(cat.color || "#3b82f6");
                          setEditCatBudgetLimit(budget ? String(budget.monthlyLimit) : "");
                        }}
                        style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--ink)" }}>
                        <Edit2 size={12} />
                        <span>{budget ? "Edit" : "Set Target"}</span>
                      </button>

                      {budget && (
                        <button
                          type="button"
                          className="icon-button danger"
                          title="Remove Envelope Target"
                          onClick={() => handleDeleteBudget(budget.id)}
                          disabled={deletingBudgetId === budget.id}
                          style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#ef4444" }}>
                          {deletingBudgetId === budget.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {budget ? (
                    <>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                          <span style={{ color: "var(--muted)" }}>MTD Outflow</span>
                          <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                            {money(spent * 100)} / {money(limit * 100)}
                          </span>
                        </div>

                        <div style={{ width: "100%", height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, pct)}%`,
                              background: status === "EXCEEDED" ? "#ef4444" : status === "WARNING" ? "#f59e0b" : "var(--green)",
                              borderRadius: "3px",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                        <span style={{ color: status === "EXCEEDED" ? "#ef4444" : status === "WARNING" ? "#f59e0b" : "var(--muted)", fontWeight: 600 }}>
                          {status === "EXCEEDED" ? "Over limit" : status === "WARNING" ? "Near limit (>80%)" : `${money((limit - spent) * 100)} left`}
                        </span>
                        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{pct}%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>No monthly envelope spending limit set for this category.</p>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCatId(cat.id);
                            setLimitInput("10000");
                          }}
                          className="secondary compact"
                          style={{ fontSize: "11px", padding: "4px 12px", borderRadius: "6px" }}
                        >
                          + Set Envelope Target
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
