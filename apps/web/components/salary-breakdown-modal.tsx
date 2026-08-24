"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeIndianRupee,
  Building2,
  Calendar,
  CreditCard,
  Eye,
  FileText,
  ShieldCheck,
  User,
  X,
  Download,
} from "lucide-react";
import { money, downloadFile } from "@/lib/api";

export type SalaryLineItem = {
  id?: string;
  type: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
  description: string;
  currentAmount: number;
  ytdAmount?: number | null;
};

export type DetailedSalaryStatement = {
  id: string;
  payPeriod: string;
  employer: string;
  employeeName?: string | null;
  department?: string | null;
  designation?: string | null;
  bankName?: string | null;
  bankAccountLast4?: string | null;
  uanLast4?: string | null;
  grossEarnings: number;
  grossDeductions: number;
  netPay: number;
  filename: string;
  organization?: {
    id: string;
    name: string;
    code?: string;
    color?: string;
  } | null;
  lineItems?: SalaryLineItem[];
};

export function SalaryBreakdownModal({
  statement,
  onClose,
  onViewPdf,
}: {
  statement: DetailedSalaryStatement;
  onClose: () => void;
  onViewPdf?: () => void;
}) {
  const earnings = (statement.lineItems || []).filter(
    (item) => item.type === "EARNING",
  );
  const deductions = (statement.lineItems || []).filter(
    (item) => item.type === "DEDUCTION",
  );
  const employerContribs = (statement.lineItems || []).filter(
    (item) => item.type === "EMPLOYER_CONTRIBUTION",
  );

  const formattedPeriod = new Date(statement.payPeriod).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  return (
    <div className="modal-wrap">
      <button
        className="backdrop"
        onClick={onClose}
        aria-label="Close details modal"
      />
      <section
        className="modal salary-breakdown-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="salary-breakdown-title"
        style={{ maxWidth: "780px", width: "100%", padding: "24px" }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <span className="eyebrow" style={{ margin: 0 }}>
                Payslip Breakdown
              </span>
              {statement.organization && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: statement.organization.color
                      ? `${statement.organization.color}22`
                      : "var(--paper)",
                    color: statement.organization.color || "var(--ink)",
                    border: `1px solid ${
                      statement.organization.color
                        ? `${statement.organization.color}44`
                        : "var(--line)"
                    }`,
                  }}
                >
                  {statement.organization.name}
                </span>
              )}
            </div>
            <h2 id="salary-breakdown-title" style={{ margin: 0, fontSize: "20px" }}>
              {statement.organization?.name || statement.employer} — {formattedPeriod}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {statement.filename !== "Manual Entry" && (
              <button
                type="button"
                className="secondary compact"
                onClick={async () => {
                  const ext = statement.filename.toLowerCase().split('.').pop() || 'pdf';
                  await downloadFile(
                    `/salary-statements/${statement.id}/download`,
                    `payslip-${new Date(statement.payPeriod).toISOString().slice(0, 10)}.${ext}`
                  );
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Download size={14} /> Download Slip
              </button>
            )}
            {statement.filename !== "Manual Entry" && onViewPdf && (
              <button
                type="button"
                className="secondary compact"
                onClick={onViewPdf}
              >
                <Eye size={14} /> View Original PDF
              </button>
            )}
            <button
              type="button"
              className="ghost icon-only"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Employee & Bank Info Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {statement.employeeName && (
            <div className="meta-card">
              <User size={14} className="meta-icon" />
              <div>
                <small>Employee Name</small>
                <strong>{statement.employeeName}</strong>
              </div>
            </div>
          )}
          {(statement.department || statement.designation) && (
            <div className="meta-card">
              <Building2 size={14} className="meta-icon" />
              <div>
                <small>Role / Dept</small>
                <strong>
                  {statement.designation || statement.department}
                </strong>
              </div>
            </div>
          )}
          {(statement.bankName || statement.bankAccountLast4) && (
            <div className="meta-card">
              <CreditCard size={14} className="meta-icon" />
              <div>
                <small>Disbursement Account</small>
                <strong>
                  {statement.bankName || "Bank"} ••••{" "}
                  {statement.bankAccountLast4}
                </strong>
              </div>
            </div>
          )}
          {statement.uanLast4 && (
            <div className="meta-card">
              <ShieldCheck size={14} className="meta-icon" />
              <div>
                <small>UAN (PF)</small>
                <strong>•••• {statement.uanLast4}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Highlight KPI Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            background: "var(--card-bg, rgba(255, 255, 255, 0.03))",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <small style={{ color: "var(--muted)", fontSize: "12px" }}>
              Gross Earnings
            </small>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#16a34a",
                marginTop: "2px",
              }}
            >
              {money(statement.grossEarnings)}
            </div>
          </div>
          <div>
            <small style={{ color: "var(--muted)", fontSize: "12px" }}>
              Total Deductions
            </small>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#ea580c",
                marginTop: "2px",
              }}
            >
              -{money(statement.grossDeductions)}
            </div>
          </div>
          <div>
            <small style={{ color: "var(--muted)", fontSize: "12px" }}>
              Net Take-Home Pay
            </small>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#0284c7",
                marginTop: "2px",
              }}
            >
              {money(statement.netPay)}
            </div>
          </div>
        </div>

        {/* Itemized Columns Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* Earnings Column */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "14px",
              background: "var(--bg)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                paddingBottom: "8px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ArrowUpRight size={16} /> Earnings
              </span>
              <strong style={{ fontSize: "13px" }}>
                {money(statement.grossEarnings)}
              </strong>
            </div>

            {earnings.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {earnings.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      padding: "4px 0",
                    }}
                  >
                    <span style={{ color: "var(--ink)" }}>
                      {item.description}
                    </span>
                    <strong style={{ fontWeight: 600 }}>
                      {money(item.currentAmount)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--muted)",
                  margin: "8px 0",
                }}
              >
                Standard lump-sum gross earnings
              </p>
            )}
          </div>

          {/* Deductions Column */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "14px",
              background: "var(--bg)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                paddingBottom: "8px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "#ea580c",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ArrowDownRight size={16} /> Deductions &amp; Taxes
              </span>
              <strong style={{ fontSize: "13px" }}>
                {money(statement.grossDeductions)}
              </strong>
            </div>

            {deductions.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {deductions.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      padding: "4px 0",
                    }}
                  >
                    <span style={{ color: "var(--ink)" }}>
                      {item.description}
                    </span>
                    <strong
                      style={{ fontWeight: 600, color: "var(--danger, #f43f5e)" }}
                    >
                      -{money(item.currentAmount)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--muted)",
                  margin: "8px 0",
                }}
              >
                No itemized deductions
              </p>
            )}
          </div>
        </div>

        {/* Employer Contributions Section if available */}
        {employerContribs.length > 0 && (
          <div
            style={{
              marginTop: "16px",
              border: "1px dashed var(--line)",
              borderRadius: "12px",
              padding: "12px 14px",
              background: "rgba(99, 102, 241, 0.04)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#6366f1",
                marginBottom: "8px",
              }}
            >
              Employer Contributions &amp; Benefits (Not deducted from salary)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "8px",
              }}
            >
              {employerContribs.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>
                    {item.description}
                  </span>
                  <strong>{money(item.currentAmount)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
