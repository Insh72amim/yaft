"use client";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BadgeIndianRupee,
  Building2,
  FileText,
  ShieldCheck,
  Trash2,
  Upload,
  WalletCards,
  Eye,
  TrendingUp,
  Calendar,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import {
  api,
  downloadFile,
  errorMessage,
  isUnauthorized,
  money,
} from "@/lib/api";
import { PdfViewerModal } from "@/components/pdf-viewer-modal";
import { OrganizationModal } from "@/components/organization-modal";
import { PayslipConfigBuilderModal } from "@/components/payslip-config-builder-modal";
import { SalaryBreakdownModal, DetailedSalaryStatement } from "@/components/salary-breakdown-modal";
import { SalaryAnalyticsCard } from "@/components/salary-analytics-card";
import { SalaryTaxDeductionsCard } from "@/components/salary-tax-deductions-card";

type SalaryStatement = DetailedSalaryStatement;
type SalaryTimelinePoint = {
  month: string;
  grossEarnings: number;
  netPay: number;
  tax: number;
  cumulativeGross: number;
  cumulativeTax: number;
};
type SalaryOverview = {
  summary: {
    statementCount: number;
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    employeePf: number;
    employerPf: number;
    taxes: number;
    latestNetPay: number;
  };
  timeline: SalaryTimelinePoint[];
  statements: SalaryStatement[];
};

export default function SalaryPage() {
  const router = useRouter();
  const [data, setData] = useState<SalaryOverview>();
  const [activeTab, setActiveTab] = useState<"statements" | "analytics" | "timeline" | "organizations">(
    "statements",
  );
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [viewingStatement, setViewingStatement] =
    useState<SalaryStatement | null>(null);
  const [breakdownStatement, setBreakdownStatement] =
    useState<SalaryStatement | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  // Organizations state & Filter state
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("ALL");
  const [selectedFy, setSelectedFy] = useState<string>("ALL");
  const [editingOrg, setEditingOrg] = useState<any | null>(null);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [builderOrg, setBuilderOrg] = useState<any | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<any | null>(null);
  const [purgeStatements, setPurgeStatements] = useState(false);
  const [orgBusy, setOrgBusy] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      const list = await api<any[]>("/organizations");
      setOrganizations(list);
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [overviewData] = await Promise.all([
        api<SalaryOverview>("/salary-statements"),
        loadOrgs(),
      ]);
      setData(overviewData);
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace("/login");
      else
        setError(errorMessage(reason, "Could not load your salary history."));
    }
  }, [loadOrgs, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload(statement: SalaryStatement) {
    try {
      const ext = statement.filename.toLowerCase().split('.').pop() || 'pdf';
      await downloadFile(
        `/salary-statements/${statement.id}/download`,
        `payslip-${new Date(statement.payPeriod).toISOString().slice(0, 10)}.${ext}`,
      );
    } catch (reason) {
      setError(errorMessage(reason, "Could not download the payslip."));
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    setDeleteError("");
    try {
      await api(`/salary-statements/${deletingId}`, { method: "DELETE" });
      setDeletingId(null);
      await load();
    } catch (reason) {
      setDeleteError(errorMessage(reason, "Could not delete the statement."));
    }
  }

  if (!data)
    return (
      <Shell>
        <div className="loading">
          <span />
          <p>{error || "Preparing your salary history…"}</p>
        </div>
      </Shell>
    );

  const getFinancialYear = (dateStr: string) => {
    const d = new Date(dateStr);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    if (month >= 4) {
      const nextY = (year + 1).toString().slice(2);
      return `FY${year.toString().slice(2)}-${nextY}`;
    } else {
      const prevY = (year - 1).toString().slice(2);
      return `FY${prevY}-${year.toString().slice(2)}`;
    }
  };

  const availableFys = Array.from(
    new Set((data.statements || []).map((s: any) => getFinancialYear(s.payPeriod)))
  ).sort().reverse();

  // Compute filtered statements, summary & timeline points based on selectedOrgId and selectedFy
  const targetOrg = organizations.find((o) => o.id === selectedOrgId);
  const filteredStatements = (data.statements || []).filter((statement: any) => {
    const stmtEmployer = (statement.employer || "").toLowerCase();
    const orgName = (targetOrg?.name || "").toLowerCase();

    const matchesOrg =
      selectedOrgId === "ALL" ||
      statement.organizationId === selectedOrgId ||
      statement.organization?.id === selectedOrgId ||
      Boolean(
        targetOrg &&
          (stmtEmployer.includes(orgName) || (orgName.length > 0 && orgName.includes(stmtEmployer)))
      );

    const matchesFy =
      selectedFy === "ALL" || getFinancialYear(statement.payPeriod) === selectedFy;

    return matchesOrg && matchesFy;
  });

  const filteredLineItems = filteredStatements.flatMap((s: any) => s.lineItems || []);
  const filteredEmployeePf = filteredLineItems
    .filter((item: any) => item.type === "DEDUCTION" && /\bpf\b|provident fund/i.test(item.description) && !/accumulat|balance|closing|opening|ytd|total/i.test(item.description) && (Number(item.currentAmount) || 0) < 5000000)
    .reduce((sum: number, item: any) => sum + (Number(item.currentAmount) || 0), 0);
  const filteredEmployerPf = filteredLineItems
    .filter((item: any) => item.type === "EMPLOYER_CONTRIBUTION" && /\bpf\b|provident fund/i.test(item.description) && !/accumulat|balance|closing|opening|ytd|total/i.test(item.description) && (Number(item.currentAmount) || 0) < 5000000)
    .reduce((sum: number, item: any) => sum + (Number(item.currentAmount) || 0), 0);
  const filteredTaxes = filteredLineItems
    .filter((item: any) => item.type === "DEDUCTION" && /tax/i.test(item.description) && !/accumulat|balance|closing|opening|ytd|total/i.test(item.description) && (Number(item.currentAmount) || 0) < 50000000)
    .reduce((sum: number, item: any) => sum + (Number(item.currentAmount) || 0), 0);

  const filteredSummary = {
    statementCount: filteredStatements.length,
    latestNetPay: filteredStatements[0]?.netPay || 0,
    totalNet: filteredStatements.reduce((acc, s) => acc + s.netPay, 0),
    totalGross: filteredStatements.reduce((acc, s) => acc + s.grossEarnings, 0),
    totalDeductions: filteredStatements.reduce((acc, s) => acc + s.grossDeductions, 0),
    employeePf: filteredEmployeePf,
    employerPf: filteredEmployerPf,
    taxes: filteredTaxes,
  };

  const filteredTimelineMonths = new Set(
    filteredStatements.map((s) => new Date(s.payPeriod).toISOString().slice(0, 7))
  );

  const filteredTimeline = (data.timeline || []).filter((point) =>
    selectedOrgId === "ALL" && selectedFy === "ALL" ? true : filteredTimelineMonths.has(point.month)
  );

  // Group statements by Financial Year for Multi-Year comparison
  const fyGroups: Record<string, any[]> = {};
  (data.statements || []).forEach((s: any) => {
    const fy = getFinancialYear(s.payPeriod);
    if (!fyGroups[fy]) fyGroups[fy] = [];
    fyGroups[fy].push(s);
  });

  const fyComparisons = Object.keys(fyGroups)
    .sort()
    .reverse()
    .map((fy) => {
      const slips = fyGroups[fy];
      const totalGross = slips.reduce((sum, s) => sum + s.netPay + s.grossDeductions, 0);
      const totalNet = slips.reduce((sum, s) => sum + s.netPay, 0);
      const taxes = slips.reduce(
        (sum, s) =>
          sum +
          (s.lineItems || [])
            .filter((li: any) => li.itemType === "DEDUCTION" && (li.name.toLowerCase().includes("tax") || li.name.toLowerCase().includes("tds")))
            .reduce((lSum: number, li: any) => lSum + li.amount, 0),
        0
      );
      const employeePf = slips.reduce(
        (sum, s) =>
          sum +
          (s.lineItems || [])
            .filter((li: any) => li.itemType === "DEDUCTION" && (li.name.toLowerCase().includes("pf") || li.name.toLowerCase().includes("provident")))
            .reduce((lSum: number, li: any) => lSum + li.amount, 0),
        0
      );

      return {
        fy,
        statementCount: slips.length,
        totalGross,
        totalNet,
        taxes,
        totalPf: employeePf,
        employeePf,
      };
    });

  const handleExportCsv = () => {
    if (!filteredStatements.length) return;
    const headers = ["Pay Period", "Employer", "Gross Earnings", "Gross Deductions", "Net Pay", "Filename"];
    const rows = filteredStatements.map((s: any) => [
      new Date(s.payPeriod).toISOString().slice(0, 7),
      `"${s.employer.replace(/"/g, '""')}"`,
      s.grossEarnings,
      s.grossDeductions,
      s.netPay,
      `"${s.filename.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Salary_Summary_${selectedFy}_${selectedOrgId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Shell>
      <header className="page-header">
        <div>
          <Link className="back-link" href="/dashboard">
            <ArrowLeft size={15} />
            Overview
          </Link>
          <span className="eyebrow">Income records</span>
          <h1>Salary statements</h1>
          <p>
            Your verified, cumulative view of earnings, deductions, tax, and
            provident fund.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowManualModal(true)}
          >
            Add manually
          </button>
          <Link
            className="primary"
            href="/import?kind=SALARY_PAYSLIP&source=STANDARD_PAYSLIP"
          >
            <Upload />
            Import payslip
          </Link>
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Top Filter and Tabs Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div className="salary-tabs" role="tablist" aria-label="Salary views" style={{ margin: 0 }}>
          <button
            role="tab"
            aria-selected={activeTab === "statements"}
            className={activeTab === "statements" ? "active" : ""}
            onClick={() => setActiveTab("statements")}>
            <FileText size={16} />
            Verified salary records
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "analytics"}
            className={activeTab === "analytics" ? "active" : ""}
            onClick={() => setActiveTab("analytics")}>
            <TrendingUp size={16} />
            Analytics &amp; Tax Deductions
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "timeline"}
            className={activeTab === "timeline" ? "active" : ""}
            onClick={() => setActiveTab("timeline")}>
            <ArrowUpRight size={16} />
            Earnings &amp; tax timeline
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "organizations"}
            className={activeTab === "organizations" ? "active" : ""}
            onClick={() => setActiveTab("organizations")}>
            <Building2 size={16} />
            Organizations &amp; Parser Configs ({organizations.length})
          </button>
        </div>

        {activeTab !== "organizations" && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {availableFys.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Financial Year:</span>
                <select
                  value={selectedFy}
                  onChange={(e) => setSelectedFy(e.target.value)}
                  className="text-input"
                  style={{ minWidth: "130px", padding: "6px 12px", borderRadius: "10px", fontSize: "13px" }}>
                  <option value="ALL">All Years ({availableFys.length})</option>
                  {availableFys.map((fy) => (
                    <option key={fy} value={fy}>
                      {fy}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {organizations.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Employer:</span>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="text-input"
                  style={{ minWidth: "160px", maxWidth: "220px", padding: "6px 12px", borderRadius: "10px", fontSize: "13px" }}>
                  <option value="ALL">All Employers ({organizations.length})</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} {org.isCurrent ? "★ (Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link
                href="/import?kind=SALARY_PAYSLIP&source=STANDARD_PAYSLIP"
                className="secondary compact"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Upload size={14} /> Upload Payslip
              </Link>
              <button
                type="button"
                className="primary compact"
                onClick={() => setShowManualModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <BadgeIndianRupee size={14} /> + Manual Entry
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab === "statements" ? (
        <>
          <section className="panel salary-history salary-history-wide" style={{ padding: "24px" }}>
            <div className="panel-title" style={{ marginBottom: "20px" }}>
              <div>
                <span className="eyebrow">Verified payroll records</span>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "2px 0 0 0" }}>Salary history</h2>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                  {filteredStatements.length} verified statement{filteredStatements.length === 1 ? "" : "s"}
                </span>
                <Link
                  className="secondary compact"
                  href="/import?kind=SALARY_PAYSLIP&source=STANDARD_PAYSLIP"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Upload size={13} />
                  Import payslip
                </Link>
              </div>
            </div>

            {filteredStatements.length ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>Pay Period</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>Employer</th>
                      <th style={{ padding: "8px 14px", textAlign: "right" }}>Gross Salary</th>
                      <th style={{ padding: "8px 14px", textAlign: "right" }}>Deductions</th>
                      <th style={{ padding: "8px 14px", textAlign: "right" }}>Net Take-Home</th>
                      <th style={{ padding: "8px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatements.map((statement: any) => {
                      const stmtLineItems = statement.lineItems || [];
                      const stmtTaxes = stmtLineItems
                        .filter((li: any) => li.type === "DEDUCTION" && /tax/i.test(li.description))
                        .reduce((sum: number, li: any) => sum + (Number(li.currentAmount) || 0), 0);
                      const stmtPf = stmtLineItems
                        .filter((li: any) => li.type === "DEDUCTION" && /\bpf\b|provident/i.test(li.description))
                        .reduce((sum: number, li: any) => sum + (Number(li.currentAmount) || 0), 0);

                      const orgColor = statement.organization?.color;
                      const initial = (statement.employer || "GS").slice(0, 2).toUpperCase();

                      return (
                        <tr
                          key={statement.id}
                          style={{
                            background: "var(--background-alt)",
                            borderRadius: "12px",
                            transition: "background 0.15s ease",
                          }}>
                          {/* Pay Period */}
                          <td style={{ padding: "12px 14px", borderTopLeftRadius: "12px", borderBottomLeftRadius: "12px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: "var(--card)",
                                border: "1px solid var(--line)",
                                fontWeight: 700,
                                fontSize: "11.5px",
                                color: "var(--ink)",
                                whiteSpace: "nowrap",
                              }}>
                              <Calendar size={13} style={{ color: "var(--muted)" }} />
                              {new Date(statement.payPeriod).toLocaleDateString("en-IN", {
                                month: "short",
                                year: "numeric",
                                timeZone: "UTC",
                              }).toUpperCase()}
                            </span>
                          </td>

                          {/* Employer */}
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span
                                style={{
                                  width: "30px",
                                  height: "30px",
                                  minWidth: "30px",
                                  borderRadius: "8px",
                                  background: orgColor ? `${orgColor}22` : "rgba(99, 102, 241, 0.12)",
                                  color: orgColor || "#6366f1",
                                  display: "grid",
                                  placeItems: "center",
                                  fontWeight: 800,
                                  fontSize: "11px",
                                  border: `1px solid ${orgColor ? `${orgColor}44` : "rgba(99, 102, 241, 0.25)"}`,
                                }}>
                                {initial}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <strong
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "var(--ink)",
                                    display: "block",
                                    lineHeight: 1.3,
                                  }}>
                                  {statement.employer}
                                </strong>
                                {statement.designation &&
                                  statement.designation.trim().toLowerCase() !== statement.employer.trim().toLowerCase() &&
                                  !statement.employer.toLowerCase().includes(statement.designation.toLowerCase()) && (
                                    <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                                      {statement.designation}
                                    </small>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Gross Salary */}
                          <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <strong style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                              {money(statement.grossEarnings)}
                            </strong>
                          </td>

                          {/* Deductions & Tax */}
                          <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#ef4444" }}>
                              -{money(statement.grossDeductions)}
                            </span>
                            {(stmtTaxes > 0 || stmtPf > 0) && (
                              <small style={{ display: "block", color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>
                                {stmtTaxes > 0 ? `Tax: ${money(stmtTaxes, true)}` : ""}
                                {stmtTaxes > 0 && stmtPf > 0 ? " · " : ""}
                                {stmtPf > 0 ? `PF: ${money(stmtPf, true)}` : ""}
                              </small>
                            )}
                          </td>

                          {/* Net Take-Home */}
                          <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: "rgba(16, 185, 129, 0.12)",
                                color: "#10b981",
                                fontWeight: 800,
                                fontSize: "13px",
                              }}>
                              <Check size={12} strokeWidth={3} />
                              {money(statement.netPay)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td
                            style={{
                              padding: "12px 14px",
                              textAlign: "right",
                              borderTopRightRadius: "12px",
                              borderBottomRightRadius: "12px",
                              whiteSpace: "nowrap",
                            }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                className="secondary compact"
                                onClick={() => setBreakdownStatement(statement)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "11.5px",
                                  padding: "4px 9px",
                                }}>
                                <Eye size={13} />
                                Breakdown
                              </button>
                              {statement.filename !== "Manual Entry" ? (
                                <button
                                  type="button"
                                  className="secondary compact"
                                  onClick={() => setViewingStatement(statement)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "11.5px",
                                    padding: "4px 9px",
                                  }}>
                                  <FileText size={13} />
                                  PDF
                                </button>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "10.5px",
                                    color: "var(--muted)",
                                    background: "var(--card)",
                                    border: "1px solid var(--line)",
                                    padding: "3px 7px",
                                    borderRadius: "6px",
                                    fontWeight: 600,
                                  }}>
                                  Manual
                                </span>
                              )}
                              <button
                                type="button"
                                className="danger compact icon-only"
                                onClick={() => setDeletingId(statement.id)}
                                aria-label={`Delete statement for ${statement.employer}`}
                                style={{ padding: "5px 7px" }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center" }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: "16px", color: "var(--muted)" }} />
                <h3 style={{ margin: "0 0 8px 0" }}>No payslips found</h3>
                <p style={{ margin: "0 0 20px 0", color: "var(--muted)", maxWidth: "420px" }}>
                  {selectedFy !== "ALL" || selectedOrgId !== "ALL"
                    ? "No salary statements match your selected filter criteria."
                    : "Upload your first PDF payslip or add salary details manually to start tracking your earnings."}
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <Link
                    className="primary"
                    href="/import?kind=SALARY_PAYSLIP&source=STANDARD_PAYSLIP"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Upload size={16} /> Upload Payslip PDF
                  </Link>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowManualModal(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <BadgeIndianRupee size={16} /> + Add Manual Entry
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : activeTab === "analytics" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="salary-summary" style={{ margin: 0 }}>
            <article>
              <span className="summary-icon income">
                <WalletCards />
              </span>
              <small>Latest net pay</small>
              <strong>{money(filteredSummary.latestNetPay)}</strong>
              <em>
                {filteredSummary.statementCount} verified statement
                {filteredSummary.statementCount === 1 ? "" : "s"}
              </em>
            </article>
            <article>
              <span className="summary-icon saved">
                <BadgeIndianRupee />
              </span>
              <small>Cumulative net pay</small>
              <strong>{money(filteredSummary.totalNet)}</strong>
              <em>After all deductions</em>
            </article>
            <article>
              <span className="summary-icon saved">
                <ArrowUpRight />
              </span>
              <small>Cumulative gross</small>
              <strong>{money(filteredSummary.totalGross)}</strong>
              <em>Across imported months</em>
            </article>
            <article>
              <span className="summary-icon expense">
                <ArrowDownRight />
              </span>
              <small>Tax deducted</small>
              <strong>{money(filteredSummary.taxes)}</strong>
              <em>Income + professional tax</em>
            </article>
            <article>
              <span className="summary-icon epfo">
                <Building2 />
              </span>
              <small>Total PF additions</small>
              <strong>
                {money(filteredSummary.employeePf + filteredSummary.employerPf)}
              </strong>
              <em>Employee + employer share</em>
            </article>
          </section>

          <SalaryAnalyticsCard
            statementCount={filteredSummary.statementCount}
            totalGross={filteredSummary.totalGross}
            totalDeductions={filteredSummary.totalDeductions}
            totalNet={filteredSummary.totalNet}
            employeePf={filteredSummary.employeePf}
            employerPf={filteredSummary.employerPf}
            taxes={filteredSummary.taxes}
            latestNetPay={filteredSummary.latestNetPay}
            selectedFy={selectedFy}
          />

          <SalaryTaxDeductionsCard
            selectedFy={selectedFy}
            currentFyEmployeePf={filteredSummary.employeePf}
            currentFyTaxes={filteredSummary.taxes}
            fyComparisons={fyComparisons}
            onExportCsv={handleExportCsv}
          />
        </div>
      ) : activeTab === "organizations" ? (
        <section className="panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ margin: 0 }}>Employer Organizations &amp; Payslip JSON Schemas</h3>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "13px" }}>
                Create organizations, upload sample payslips, and configure stored JSON parsing rules for auto-extracting future slips.
              </p>
            </div>
            <button
              type="button"
              className="primary compact"
              onClick={() => {
                setEditingOrg(null);
                setShowOrgModal(true);
              }}>
              <Building2 size={15} /> Create Organization
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
            {organizations.map((org) => (
              <div
                key={org.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "16px",
                  padding: "18px",
                  background: "var(--card)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
                }}>
                <div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "42px",
                        height: "42px",
                        minWidth: "42px",
                        borderRadius: "12px",
                        background: org.color || "#4f46e5",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        fontSize: "15px",
                        boxShadow: `0 4px 12px ${org.color ? `${org.color}40` : "rgba(79,70,229,0.3)"}`,
                      }}>
                      {org.name.slice(0, 2).toUpperCase()}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                        <strong
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            lineHeight: 1.35,
                            color: "var(--ink)",
                            wordBreak: "break-word",
                            flex: 1,
                            minWidth: "160px",
                          }}>
                          {org.name}
                        </strong>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          {org.isCurrent && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "6px",
                                background: "rgba(99,102,241,0.2)",
                                color: "#6366f1",
                                border: "1px solid rgba(99,102,241,0.4)",
                                whiteSpace: "nowrap",
                              }}>
                              Current Employer
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "10px",
                              background: "var(--paper)",
                              color: "var(--muted)",
                              border: "1px solid var(--line)",
                              whiteSpace: "nowrap",
                            }}>
                            {org.statementCount} slip{org.statementCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>

                      {org.taxId && (
                        <small style={{ color: "var(--muted)", fontSize: "12px", display: "block", marginTop: "3px" }}>
                          Tax ID / PAN: {org.taxId}
                        </small>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed var(--line)", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {org.sampleFilename ? (
                      <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "5px", fontWeight: 500 }}>
                        <ShieldCheck size={14} /> Sample: {org.sampleFilename}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "5px" }}>
                        <FileText size={14} /> No sample slip uploaded
                      </span>
                    )}

                    <span style={{ color: org.payslipConfig ? "#6366f1" : "var(--muted)", fontSize: "11px", fontWeight: 600 }}>
                      {org.payslipConfig ? "⚡ Custom Rules Set" : "Standard Schema"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                  <button
                    type="button"
                    className="secondary compact"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setEditingOrg(org);
                      setShowOrgModal(true);
                    }}>
                    Edit Profile
                  </button>

                  <button
                    type="button"
                    className="secondary compact"
                    style={{
                      flex: 1.2,
                      background: "rgba(99, 102, 241, 0.12)",
                      color: "#6366f1",
                      borderColor: "rgba(99, 102, 241, 0.3)",
                      fontWeight: 600,
                    }}
                    onClick={() => setBuilderOrg(org)}>
                    Parser Config
                  </button>

                  <button
                    type="button"
                    className="danger compact icon-only"
                    onClick={() => setDeletingOrg(org)}
                    aria-label="Delete organization">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {organizations.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px" }}>
                <Building2 size={40} style={{ color: "var(--muted)", marginBottom: "12px" }} />
                <h4>No Organizations Created</h4>
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>
                  Create an employer organization profile to configure auto-parsing JSON schemas for your payslips.
                </p>
                <button
                  type="button"
                  className="primary compact"
                  style={{ marginTop: "12px" }}
                  onClick={() => {
                    setEditingOrg(null);
                    setShowOrgModal(true);
                  }}>
                  Create Organization
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <SalaryTimeline points={filteredTimeline} />
      )}
      {deletingId && (
        <div className="modal-wrap">
          <button
            className="backdrop"
            onClick={() => setDeletingId(null)}
            aria-label="Close deletion confirmation"
          />
          <section
            className="modal account-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-salary-title">
            <div className="delete-warning">
              <ShieldCheck />
              <span>
                <strong>Permanent deletion</strong>
                <small>This action cannot be undone.</small>
              </span>
            </div>
            <div>
              <span className="eyebrow">First confirmation</span>
              <h2 id="delete-salary-title">Delete this salary statement?</h2>
              <p>
                The PDF and all parsed payroll rows will be permanently removed
                from your local store.
              </p>
            </div>
            {deleteError && (
              <p className="error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="modal-actions">
              <button className="ghost" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button
                className="danger"
                disabled={!deletingId}
                onClick={() => void confirmDelete()}>
                Permanently delete
              </button>
            </div>
          </section>
        </div>
      )}
      {viewingStatement && (
        <PdfViewerModal
          statementId={viewingStatement.id}
          title={viewingStatement.employer}
          payPeriod={viewingStatement.payPeriod}
          onClose={() => setViewingStatement(null)}
        />
      )}
      {breakdownStatement && (
        <SalaryBreakdownModal
          statement={breakdownStatement}
          onClose={() => setBreakdownStatement(null)}
          onViewPdf={() => {
            setViewingStatement(breakdownStatement);
            setBreakdownStatement(null);
          }}
        />
      )}
      {showManualModal && (
        <ManualSalaryModal
          onClose={() => setShowManualModal(false)}
          onSuccess={async () => {
            setShowManualModal(false);
            await load();
          }}
        />
      )}
      {showOrgModal && (
        <OrganizationModal
          org={editingOrg}
          onClose={() => {
            setShowOrgModal(false);
            setEditingOrg(null);
          }}
          onSuccess={() => {
            void loadOrgs();
          }}
        />
      )}

      {builderOrg && (
        <PayslipConfigBuilderModal
          org={builderOrg}
          onClose={() => setBuilderOrg(null)}
          onSuccess={() => {
            void loadOrgs();
          }}
        />
      )}

      {deletingOrg && (
        <div className="modal-wrap">
          <button className="backdrop" onClick={() => setDeletingOrg(null)} aria-label="Close modal" />
          <section className="modal" role="dialog" aria-modal="true" style={{ maxWidth: "460px" }}>
            <header className="modal-header">
              <h2>Delete Organization</h2>
            </header>
            <p style={{ fontSize: "14px", margin: "12px 0", color: "var(--muted)" }}>
              Are you sure you want to delete <strong>{deletingOrg.name}</strong>? Choose how to handle associated statements:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="purgeOpt"
                  checked={!purgeStatements}
                  onChange={() => setPurgeStatements(false)}
                />
                Keep historical payslips (unlinks organization profile)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="purgeOpt"
                  checked={purgeStatements}
                  onChange={() => setPurgeStatements(true)}
                />
                Purge organization and all {deletingOrg.statementCount} associated payslip statements
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setDeletingOrg(null)} disabled={orgBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                style={{ background: "#f43f5e", borderColor: "#f43f5e" }}
                disabled={orgBusy}
                onClick={async () => {
                  setOrgBusy(true);
                  try {
                    await api(`/organizations/${deletingOrg.id}?purgeStatements=${purgeStatements}`, {
                      method: "DELETE",
                    });
                    setDeletingOrg(null);
                    await load();
                  } catch (err) {
                    setError(errorMessage(err, "Could not delete organization."));
                  } finally {
                    setOrgBusy(false);
                  }
                }}>
                {orgBusy ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function SalaryTimeline({ points }: { points: SalaryTimelinePoint[] }) {
  if (!points.length)
    return (
      <section className="panel salary-timeline-empty">
        <ArrowUpRight />
        <strong>No timeline yet</strong>
        <p>
          Approve your first salary statement to plot monthly and cumulative
          earnings and tax.
        </p>
      </section>
    );

  // Calculate cumulative net earnings on the fly
  let runningNet = 0;
  const enrichedPoints = points.map((point) => {
    runningNet += point.netPay;
    return {
      ...point,
      cumulativeNet: runningNet,
    };
  });

  const latest = enrichedPoints[enrichedPoints.length - 1];

  return (
    <>
      <section className="salary-timeline-hero">
        <div>
          <span className="eyebrow">Verified salary journey</span>
          <h2>
            {points.length} month{points.length === 1 ? "" : "s"} on your
            timeline
          </h2>
          <p>
            Gross, net, and tax are grouped by payslip month. Multiple employers
            in one month are combined.
          </p>
        </div>
        <div>
          <span>
            <small>Total gross earned</small>
            <strong>{money(latest.cumulativeGross)}</strong>
          </span>
          <span>
            <small>Total net pay</small>
            <strong>{money(latest.cumulativeNet)}</strong>
          </span>
          <span>
            <small>Total tax deducted</small>
            <strong>{money(latest.cumulativeTax)}</strong>
          </span>
        </div>
      </section>

      <section className="salary-timeline-grid">
        <TimelineChart
          title="Monthly Pay Breakdown"
          description="Gross, Net, and Tax recorded in each verified month"
          points={enrichedPoints}
          datasets={[
            {
              label: "Gross Earnings",
              color: "#16a34a",
              values: enrichedPoints.map((p) => p.grossEarnings),
            },
            {
              label: "Net Pay",
              color: "#0284c7",
              values: enrichedPoints.map((p) => p.netPay),
            },
            {
              label: "Tax Paid",
              color: "#ea580c",
              values: enrichedPoints.map((p) => p.tax),
            },
          ]}
        />
        <TimelineChart
          title="Cumulative Growth"
          description="Running total of earnings and taxes over time"
          points={enrichedPoints}
          datasets={[
            {
              label: "Cumulative Gross",
              color: "#15803d",
              values: enrichedPoints.map((p) => p.cumulativeGross),
            },
            {
              label: "Cumulative Net",
              color: "#0369a1",
              values: enrichedPoints.map((p) => p.cumulativeNet),
            },
            {
              label: "Cumulative Tax",
              color: "#c2410c",
              values: enrichedPoints.map((p) => p.cumulativeTax),
            },
          ]}
        />
      </section>

      <ChronologicalTimeline points={enrichedPoints} />

      <p className="salary-timeline-note">
        <ShieldCheck />
        Only approved payslips are included. Tax is calculated from deduction
        rows identified as tax on each payslip.
      </p>
    </>
  );
}

type DatasetSeries = {
  label: string;
  color: string;
  values: number[];
};

function TimelineChart({
  title,
  description,
  points,
  datasets,
}: {
  title: string;
  description: string;
  points: { month: string }[];
  datasets: DatasetSeries[];
}) {
  const [activeLabelMap, setActiveLabelMap] = useState<Record<string, boolean>>(
    () => {
      return datasets.reduce((map, ds) => ({ ...map, [ds.label]: true }), {});
    },
  );

  const toggleDataset = (label: string) => {
    setActiveLabelMap((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const activeDatasets = datasets.filter(
    (ds) => activeLabelMap[ds.label] !== false,
  );
  const maximum = Math.max(...activeDatasets.flatMap((ds) => ds.values), 1);

  const width = 720;
  const height = 220;
  const left = 48;
  const right = 18;
  const top = 20;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const getCoordinates = (values: number[]) => {
    return values.map((val, index) => ({
      value: val,
      month: points[index].month,
      x:
        points.length === 1
          ? left + plotWidth / 2
          : left + (index / (points.length - 1)) * plotWidth,
      y: top + (1 - val / maximum) * plotHeight,
    }));
  };

  const shortMonthLabel = (month: string) => {
    return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  };

  return (
    <article className="panel salary-chart">
      <header>
        <div>
          <span className="eyebrow">Timeline</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="salary-chart-legend">
          {datasets.map((ds) => {
            const isActive = activeLabelMap[ds.label] !== false;
            return (
              <button
                type="button"
                key={ds.label}
                className={`legend-item ${isActive ? "" : "inactive"}`}
                onClick={() => toggleDataset(ds.label)}>
                <span style={{ backgroundColor: ds.color }} />
                {ds.label}
              </button>
            );
          })}
        </div>
      </header>
      <div className="salary-chart-canvas">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} chart`}
          preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = top + step * plotHeight;
            return (
              <line
                key={step}
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                className="salary-chart-gridline"
              />
            );
          })}
          <line
            x1={left}
            x2={width - right}
            y1={top + plotHeight}
            y2={top + plotHeight}
            className="salary-chart-axis"
            strokeLinecap="round"
          />
          {activeDatasets.map((ds) => {
            const coords = getCoordinates(ds.values);
            const path = coords
              .map(
                (point, index) =>
                  `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
              )
              .join(" ");
            const fillId = `fill-${title.replace(/\W/g, "")}-${ds.label.replace(/\W/g, "")}`;
            return (
              <g key={ds.label}>
                <defs>
                  <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor={ds.color} stopOpacity=".15" />
                    <stop offset="1" stopColor={ds.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {coords.length > 1 && (
                  <path
                    d={`${path} L ${coords[coords.length - 1].x.toFixed(1)} ${(top + plotHeight).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(top + plotHeight).toFixed(1)} Z`}
                    fill={`url(#${fillId})`}
                  />
                )}
                <path
                  d={path}
                  fill="none"
                  stroke={ds.color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
          {points.map((pt, index) => {
            const x =
              points.length === 1
                ? left + plotWidth / 2
                : left + (index / (points.length - 1)) * plotWidth;
            const labelEvery = Math.max(1, Math.ceil(points.length / 8));
            const showLabel =
              index % labelEvery === 0 || index === points.length - 1;
            return (
              <g key={pt.month}>
                {showLabel && (
                  <line
                    x1={x}
                    x2={x}
                    y1={top + plotHeight}
                    y2={top + plotHeight + 4}
                    stroke="var(--line)"
                    strokeWidth="1.5"
                  />
                )}
                {showLabel && (
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="tick-label">
                    {shortMonthLabel(pt.month)}
                  </text>
                )}
              </g>
            );
          })}
          {activeDatasets.map((ds) => {
            const coords = getCoordinates(ds.values);
            return coords.map((point) => (
              <g key={`${ds.label}-${point.month}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="white"
                  stroke={ds.color}
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke">
                  <title>
                    {ds.label} - {monthLabel(point.month)}: {money(point.value)}
                  </title>
                </circle>
              </g>
            ));
          })}
        </svg>
      </div>
      <div className="salary-chart-values">
        {points.map((point, idx) => {
          const totalActiveVal = activeDatasets.reduce(
            (sum, ds) => sum + ds.values[idx],
            0,
          );
          return (
            <span key={point.month}>
              <small>{monthLabel(point.month)}</small>
              <strong>
                {activeDatasets.length === 1
                  ? money(activeDatasets[0].values[idx])
                  : money(totalActiveVal)}
              </strong>
            </span>
          );
        })}
      </div>
    </article>
  );
}

function ChronologicalTimeline({
  points,
}: {
  points: (SalaryTimelinePoint & { cumulativeNet: number })[];
}) {
  const sortedPoints = [...points].sort((a, b) =>
    b.month.localeCompare(a.month),
  );
  return (
    <section className="vertical-timeline-section">
      <h3>Chronological Pay Breakdown Feed</h3>
      <div className="vertical-timeline">
        {sortedPoints.map((point, idx) => {
          const prevPoint = sortedPoints[idx + 1];
          let momPct: number | null = null;
          if (prevPoint && prevPoint.netPay > 0) {
            momPct = Number(
              (((point.netPay - prevPoint.netPay) / prevPoint.netPay) * 100).toFixed(1)
            );
          }

          return (
            <div key={point.month} className="timeline-item">
              <div className="timeline-marker" />
              <div className="timeline-content">
                <div className="timeline-header">
                  <h4>{monthLabel(point.month)}</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {momPct !== null && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          background:
                            momPct >= 0
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(244, 63, 94, 0.15)",
                          color: momPct >= 0 ? "#10b981" : "#f43f5e",
                          border: `1px solid ${
                            momPct >= 0
                              ? "rgba(16, 185, 129, 0.3)"
                              : "rgba(244, 63, 94, 0.3)"
                          }`,
                        }}
                      >
                        {momPct >= 0 ? `+${momPct}%` : `${momPct}%`} MoM
                      </span>
                    )}
                    <span>Salary Slip</span>
                  </div>
                </div>
                <div className="timeline-stats-grid">
                  <div className="timeline-stat gross">
                    <small>Gross Earnings</small>
                    <strong>{money(point.grossEarnings)}</strong>
                  </div>
                  <div className="timeline-stat net">
                    <small>Net Earnings</small>
                    <strong>{money(point.netPay)}</strong>
                  </div>
                  <div className="timeline-stat tax">
                    <small>Taxes Paid</small>
                    <strong>{money(point.tax)}</strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shortMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function ManualSalaryModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [employer, setEmployer] = useState("");
  const [payPeriod, setPayPeriod] = useState("");
  const [grossEarnings, setGrossEarnings] = useState("");
  const [grossDeductions, setGrossDeductions] = useState("");
  const [netPay, setNetPay] = useState("");
  const [tax, setTax] = useState("");
  const [pf, setPf] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Auto-calculate net pay when gross or deductions change
  useEffect(() => {
    const gross = parseFloat(grossEarnings) || 0;
    const ded = parseFloat(grossDeductions) || 0;
    if (gross > 0 || ded > 0) {
      setNetPay((gross - ded).toString());
    }
  }, [grossEarnings, grossDeductions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employer || !payPeriod || !grossEarnings || !grossDeductions || !netPay) {
      setError("Please fill in all required fields.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = new FormData();
      payload.set("employer", employer);
      payload.set("payPeriod", `${payPeriod}-01T00:00:00.000Z`);
      payload.set("grossEarnings", (parseFloat(grossEarnings) * 100).toFixed(0));
      payload.set("grossDeductions", (parseFloat(grossDeductions) * 100).toFixed(0));
      payload.set("netPay", (parseFloat(netPay) * 100).toFixed(0));
      if (tax) payload.set("tax", (parseFloat(tax) * 100).toFixed(0));
      if (pf) payload.set("pf", (parseFloat(pf) * 100).toFixed(0));
      if (proof) payload.set("proof", proof);

      await api("/salary-statements/manual", {
        method: "POST",
        body: payload,
      });

      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Failed to save manual salary entry."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close modal" />
      <section className="modal manual-salary-modal" role="dialog" aria-modal="true" style={{ maxWidth: "560px", width: "100%" }}>
        <header className="modal-header" style={{ marginBottom: "18px" }}>
          <h2>Add salary manually</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Enter your monthly earnings, deductions, and optional proof of payment.
          </p>
        </header>
        {error && <p className="error" role="alert" style={{ marginBottom: "16px" }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <label className="span-2" style={{ gridColumn: "span 2" }}>
              Employer Name *
              <input
                type="text"
                required
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </label>
            <label>
              Pay Month *
              <input
                type="month"
                required
                value={payPeriod}
                onChange={(e) => setPayPeriod(e.target.value)}
              />
            </label>
            <div />
            <label>
              Gross Earnings (INR) *
              <input
                type="number"
                required
                min="0"
                value={grossEarnings}
                onChange={(e) => setGrossEarnings(e.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Gross Deductions (INR) *
              <input
                type="number"
                required
                min="0"
                value={grossDeductions}
                onChange={(e) => setGrossDeductions(e.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Net Pay (INR) *
              <input
                type="number"
                required
                min="0"
                value={netPay}
                onChange={(e) => setNetPay(e.target.value)}
                placeholder="0"
              />
            </label>
            <div />
            <label>
              Income Tax (INR)
              <input
                type="number"
                min="0"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Provident Fund (INR)
              <input
                type="number"
                min="0"
                value={pf}
                onChange={(e) => setPf(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="span-2" style={{ gridColumn: "span 2" }}>
              Proof Document (Optional)
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setProof(e.target.files?.[0] || null)}
                style={{ padding: "8px 0" }}
              />
              <small style={{ display: "block", color: "var(--text-muted)", marginTop: "4px" }}>
                Accepted formats: PDF, PNG, JPG, JPEG. Max size: 8MB.
              </small>
            </label>
          </div>
          <div className="modal-actions" style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save entry"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
