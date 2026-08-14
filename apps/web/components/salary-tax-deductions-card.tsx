"use client";

import {
  BadgeIndianRupee,
  Calculator,
  ChevronRight,
  Download,
  Info,
  Layers,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { money } from "@/lib/api";

type FyComparisonItem = {
  fy: string;
  statementCount: number;
  totalGross: number;
  totalNet: number;
  taxes: number;
  totalPf: number;
  employeePf: number;
};

type SalaryTaxDeductionsProps = {
  selectedFy: string;
  currentFyEmployeePf: number;
  currentFyTaxes: number;
  fyComparisons: FyComparisonItem[];
  onExportCsv?: () => void;
};

export function SalaryTaxDeductionsCard({
  selectedFy,
  currentFyEmployeePf,
  currentFyTaxes,
  fyComparisons,
  onExportCsv,
}: SalaryTaxDeductionsProps) {
  // Indian IT Act Section 80C Max Limit is 1,50,000 INR per Financial Year
  const SECTION_80C_LIMIT = 150000;
  const pf80cClaimed = Math.min(SECTION_80C_LIMIT, currentFyEmployeePf);
  const pf80cPct = Math.min(100, Math.round((pf80cClaimed / SECTION_80C_LIMIT) * 100));
  const remaining80cHeadroom = Math.max(0, SECTION_80C_LIMIT - currentFyEmployeePf);

  // Standard deduction under New Tax Regime FY 2024-25 onwards is Rs 75,000
  const STANDARD_DEDUCTION = 75000;

  return (
    <section
      className="panel"
      style={{
        padding: "20px",
        marginBottom: "24px",
        background: "var(--card)",
        borderRadius: "16px",
        border: "1px solid var(--line)",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "grid",
              placeItems: "center",
            }}
          >
            <PiggyBank size={18} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
              Tax Savings &amp; Multi-Year Financial Analysis
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
              Section 80C Provident Fund utilization, tax deductions, and year-over-year income trends
            </p>
          </div>
        </div>

        {onExportCsv && (
          <button
            type="button"
            className="secondary compact"
            onClick={onExportCsv}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={14} /> Export CSV Summary
          </button>
        )}
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* Section 80C Progress Card */}
        <div
          style={{
            padding: "16px",
            background: "var(--paper)",
            borderRadius: "14px",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={14} style={{ color: "#10b981" }} /> Section 80C Tax Deduction (EPF)
              </span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "8px" }}>
                {pf80cPct}% Utilized
              </span>
            </div>

            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
              {money(currentFyEmployeePf)} <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 400 }}>/ {money(SECTION_80C_LIMIT)} Max</span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                height: "8px",
                width: "100%",
                borderRadius: "4px",
                background: "var(--line)",
                overflow: "hidden",
                margin: "10px 0",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pf80cPct}%`,
                  background: "linear-gradient(90deg, #10b981, #059669)",
                  borderRadius: "4px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
              {remaining80cHeadroom > 0 ? (
                <>
                  You have <strong style={{ color: "#10b981" }}>{money(remaining80cHeadroom)}</strong> remaining 80C headroom (ELSS, PPF, Life Insurance).
                </>
              ) : (
                <span style={{ color: "#10b981" }}>Full ₹1.5L Section 80C deduction limit reached via EPF!</span>
              )}
            </p>
          </div>

          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed var(--line)", display: "flex", alignItems: "center", justifyBetween: "space-between", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Calculator size={13} /> Standard Deduction: <strong>{money(STANDARD_DEDUCTION)}</strong> claimed
            </span>
          </div>
        </div>

        {/* Multi-Year Comparison Mini Table */}
        <div
          style={{
            padding: "16px",
            background: "var(--paper)",
            borderRadius: "14px",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Layers size={14} style={{ color: "#6366f1" }} /> Financial Year Comparison
            </span>
            <small style={{ fontSize: "11px", color: "var(--muted)" }}>{fyComparisons.length} FYs recorded</small>
          </div>

          {fyComparisons.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {fyComparisons.slice(0, 3).map((fyItem, idx) => {
                const prevFy = fyComparisons[idx + 1];
                let yoyGrowth: number | null = null;
                if (prevFy && prevFy.totalNet > 0) {
                  yoyGrowth = Number((((fyItem.totalNet - prevFy.totalNet) / prevFy.totalNet) * 100).toFixed(1));
                }

                return (
                  <div
                    key={fyItem.fy}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "var(--card)",
                      border: "1px solid var(--line)",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{fyItem.fy}</span>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>({fyItem.statementCount} slips)</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {yoyGrowth !== null && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: yoyGrowth >= 0 ? "#10b981" : "#f43f5e",
                          }}
                        >
                          {yoyGrowth >= 0 ? `+${yoyGrowth}%` : `${yoyGrowth}%`}
                        </span>
                      )}
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: "#0284c7", display: "block" }}>{money(fyItem.totalNet)}</strong>
                        <small style={{ fontSize: "10px", color: "var(--muted)" }}>Gross: {money(fyItem.totalGross)}</small>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>No comparative financial year data available yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
