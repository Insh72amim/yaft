"use client";

import {
  ArrowUpRight,
  BadgeIndianRupee,
  CheckCircle2,
  PieChart as PieChartIcon,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { money } from "@/lib/api";

type SalaryAnalyticsProps = {
  statementCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeePf: number;
  employerPf: number;
  taxes: number;
  latestNetPay: number;
  selectedFy: string;
};

export function SalaryAnalyticsCard({
  statementCount,
  totalGross,
  totalDeductions,
  totalNet,
  employeePf,
  employerPf,
  taxes,
  latestNetPay,
  selectedFy,
}: SalaryAnalyticsProps) {
  if (statementCount === 0) return null;

  const avgMonthlyGross = Math.round(totalGross / statementCount);
  const avgMonthlyNet = Math.round(totalNet / statementCount);
  const projectedAnnualCtc = avgMonthlyGross * 12;

  const takeHomePct =
    totalGross > 0 ? Math.min(100, Math.round((totalNet / totalGross) * 100)) : 0;
  const taxPct =
    totalGross > 0 ? Math.min(100, Math.round((taxes / totalGross) * 100)) : 0;
  const pfPct =
    totalGross > 0
      ? Math.min(100, Math.round(((employeePf + employerPf) / totalGross) * 100))
      : 0;
  const otherDedPct = Math.max(0, 100 - takeHomePct - taxPct);

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
              background: "rgba(99, 102, 241, 0.15)",
              color: "#6366f1",
              display: "grid",
              placeItems: "center",
            }}
          >
            <PieChartIcon size={18} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
              Salary Structure &amp; Compensation Analytics
            </h3>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "12px",
                color: "var(--muted)",
              }}
            >
              Income efficiency, tax deductions, and provident fund savings breakdown{" "}
              {selectedFy !== "ALL" ? `for ${selectedFy}` : "(All Time)"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <CheckCircle2 size={13} /> {takeHomePct}% Take-Home Efficiency
          </span>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            padding: "14px",
            background: "var(--paper)",
            borderRadius: "12px",
            border: "1px solid var(--line)",
          }}
        >
          <small
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "block",
            }}
          >
            Projected Annual Package (CTC)
          </small>
          <strong
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#10b981",
              display: "block",
              marginTop: "4px",
            }}
          >
            {money(projectedAnnualCtc)}
          </strong>
          <small style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Based on {money(avgMonthlyGross)}/mo gross average
          </small>
        </div>

        <div
          style={{
            padding: "14px",
            background: "var(--paper)",
            borderRadius: "12px",
            border: "1px solid var(--line)",
          }}
        >
          <small
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "block",
            }}
          >
            Average Monthly Net Pay
          </small>
          <strong
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#0284c7",
              display: "block",
              marginTop: "4px",
            }}
          >
            {money(avgMonthlyNet)}
          </strong>
          <small style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Take-home after taxes &amp; PF
          </small>
        </div>

        <div
          style={{
            padding: "14px",
            background: "var(--paper)",
            borderRadius: "12px",
            border: "1px solid var(--line)",
          }}
        >
          <small
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "block",
            }}
          >
            Effective Tax Rate (TDS)
          </small>
          <strong
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#ea580c",
              display: "block",
              marginTop: "4px",
            }}
          >
            {taxPct}%
          </strong>
          <small style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            {money(taxes)} total tax paid
          </small>
        </div>

        <div
          style={{
            padding: "14px",
            background: "var(--paper)",
            borderRadius: "12px",
            border: "1px solid var(--line)",
          }}
        >
          <small
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "block",
            }}
          >
            Retirement Savings (PF)
          </small>
          <strong
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#6366f1",
              display: "block",
              marginTop: "4px",
            }}
          >
            {money(employeePf + employerPf)}
          </strong>
          <small style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Employee ({money(employeePf)}) + Employer ({money(employerPf)})
          </small>
        </div>
      </div>

      {/* Visual Component Distribution Stacked Progress Bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            fontSize: "12px",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>
            Gross Income Distribution Breakdown
          </span>
          <span style={{ color: "var(--muted)" }}>Total Gross: {money(totalGross)}</span>
        </div>

        <div
          style={{
            height: "14px",
            width: "100%",
            borderRadius: "7px",
            overflow: "hidden",
            display: "flex",
            background: "var(--line)",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: `${takeHomePct}%`,
              background: "#0284c7",
              transition: "width 0.4s ease",
            }}
            title={`Net Take-Home Pay: ${takeHomePct}% (${money(totalNet)})`}
          />
          <div
            style={{
              width: `${taxPct}%`,
              background: "#ea580c",
              transition: "width 0.4s ease",
            }}
            title={`Tax Deducted: ${taxPct}% (${money(taxes)})`}
          />
          <div
            style={{
              width: `${pfPct}%`,
              background: "#6366f1",
              transition: "width 0.4s ease",
            }}
            title={`PF Contributions: ${pfPct}% (${money(employeePf + employerPf)})`}
          />
          {otherDedPct > 0 && (
            <div
              style={{
                width: `${otherDedPct}%`,
                background: "#a855f7",
                transition: "width 0.4s ease",
              }}
              title={`Other Deductions: ${otherDedPct}%`}
            />
          )}
        </div>

        {/* Stack Bar Legend */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "3px",
                background: "#0284c7",
              }}
            />
            <span style={{ color: "var(--muted)" }}>
              Net Take-Home: <strong>{takeHomePct}%</strong> ({money(totalNet)})
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "3px",
                background: "#ea580c",
              }}
            />
            <span style={{ color: "var(--muted)" }}>
              Income Tax (TDS): <strong>{taxPct}%</strong> ({money(taxes)})
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "3px",
                background: "#6366f1",
              }}
            />
            <span style={{ color: "var(--muted)" }}>
              Provident Fund: <strong>{pfPct}%</strong> ({money(employeePf + employerPf)})
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
