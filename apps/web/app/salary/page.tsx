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

type SalaryStatement = {
  id: string;
  payPeriod: string;
  employer: string;
  grossEarnings: number;
  grossDeductions: number;
  netPay: number;
  filename: string;
};
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
  const [activeTab, setActiveTab] = useState<"statements" | "timeline" | "organizations">(
    "statements",
  );
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [viewingStatement, setViewingStatement] =
    useState<SalaryStatement | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  // Organizations state & Filter state
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("ALL");
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
      const current = list.find((o) => o.isCurrent);
      if (current) {
        setSelectedOrgId((prev) => (prev === "ALL" ? current.id : prev));
      }
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

  // Compute filtered statements, summary & timeline points based on selectedOrgId
  const targetOrg = organizations.find((o) => o.id === selectedOrgId);
  const filteredStatements = (data.statements || []).filter((statement: any) => {
    if (selectedOrgId === "ALL") return true;
    return (
      statement.organization?.id === selectedOrgId ||
      (targetOrg && statement.employer.toLowerCase().includes(targetOrg.name.toLowerCase()))
    );
  });

  const filteredSummary = {
    statementCount: filteredStatements.length,
    latestNetPay: filteredStatements[0]?.netPay || 0,
    totalNet: filteredStatements.reduce((acc, s) => acc + s.netPay, 0),
    totalGross: filteredStatements.reduce((acc, s) => acc + s.grossEarnings, 0),
    totalDeductions: filteredStatements.reduce((acc, s) => acc + s.grossDeductions, 0),
    employeePf: data.summary.employeePf,
    employerPf: data.summary.employerPf,
    taxes: data.summary.taxes,
  };

  const filteredTimelineMonths = new Set(
    filteredStatements.map((s) => new Date(s.payPeriod).toISOString().slice(0, 7))
  );

  const filteredTimeline = (data.timeline || []).filter((point) =>
    selectedOrgId === "ALL" ? true : filteredTimelineMonths.has(point.month)
  );

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
            <FileText />
            Statements
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "timeline"}
            className={activeTab === "timeline" ? "active" : ""}
            onClick={() => setActiveTab("timeline")}>
            <ArrowUpRight />
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

        {organizations.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
      </div>

      {activeTab === "statements" ? (
        <>
          <section className="salary-summary">
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
          <section className="panel salary-history salary-history-wide">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Verified payroll record</span>
                <h2>Salary history</h2>
              </div>
              <Link
                className="secondary compact"
                href="/import?kind=SALARY_PAYSLIP&source=STANDARD_PAYSLIP">
                <Upload />
                Unified importer
              </Link>
            </div>
            {filteredStatements.length ? (
              <div className="salary-history-list">
                {filteredStatements.map((statement: any) => (
                  <article key={statement.id}>
                    <time>
                      {new Date(statement.payPeriod).toLocaleDateString(
                        "en-IN",
                        { month: "short", year: "numeric", timeZone: "UTC" },
                      )}
                    </time>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong>{statement.employer}</strong>
                        {statement.organization && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: statement.organization.color ? `${statement.organization.color}22` : "var(--paper)",
                              color: statement.organization.color || "var(--ink)",
                              border: `1px solid ${statement.organization.color ? `${statement.organization.color}44` : "var(--line)"}`,
                              maxWidth: "180px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statement.organization.color || "var(--indigo)" }} />
                            {statement.organization.name}
                          </span>
                        )}
                      </div>
                      <small style={{ color: "var(--muted)" }}>
                        Gross {money(statement.grossEarnings)} · deductions{" "}
                        {money(statement.grossDeductions)}
                      </small>
                    </div>
                    <div className="statement-actions">
                      <div className="button-group">
                        <b>{money(statement.netPay)}</b>
                        <div></div>
                        {statement.filename !== "Manual Entry" ? (
                          <>
                            <button
                              className="secondary compact icon-only"
                              onClick={() => setViewingStatement(statement)}
                              title="View inline"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className="secondary compact"
                              onClick={() => void handleDownload(statement)}
                            >
                              Download
                            </button>
                          </>
                        ) : (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              padding: "4px 8px",
                              backgroundColor: "var(--background-alt)",
                              borderRadius: "4px",
                              fontWeight: "bold",
                            }}
                          >
                            Manual
                          </span>
                        )}
                        <button
                          className="danger compact icon-only"
                          onClick={() => {
                            setDeleteError("");
                            setDeletingId(statement.id);
                          }}
                          aria-label="Delete statement">
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="salary-empty">
                <BadgeIndianRupee />
                <strong>No verified salary months yet</strong>
                <p>
                  Use Import records to validate and review your first payslip.
                </p>
                <Link
                  className="primary"
                  href="/import?kind=SALARY_PAYSLIP&source=STANDARD_PAYSLIP">
                  Import first payslip
                </Link>
              </div>
            )}
          </section>
        </>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {organizations.map((org) => (
              <div
                key={org.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "var(--card)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          background: org.color || "#4f46e5",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 700,
                        }}>
                        {org.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong style={{ fontSize: "15px" }}>{org.name}</strong>
                          {org.isCurrent && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "6px",
                                background: "rgba(99,102,241,0.2)",
                                color: "#6366f1",
                                border: "1px solid rgba(99,102,241,0.4)",
                              }}>
                              Current Employer
                            </span>
                          )}
                        </div>
                        {org.taxId && <small style={{ color: "var(--muted)", display: "block" }}>Tax ID: {org.taxId}</small>}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "10px",
                        background: "var(--bg)",
                        color: "var(--muted)",
                      }}>
                      {org.statementCount} slips
                    </span>
                  </div>

                  <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--muted)" }}>
                    {org.sampleFilename ? (
                      <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={14} /> Sample slip: {org.sampleFilename}
                      </span>
                    ) : (
                      <span>No sample slip uploaded yet</span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
                  <button
                    type="button"
                    className="secondary compact"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setEditingOrg(org);
                      setShowOrgModal(true);
                    }}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="primary compact"
                    style={{ flex: 1 }}
                    onClick={() => setBuilderOrg(org)}>
                    Parser Config
                  </button>
                  <button
                    type="button"
                    className="secondary compact"
                    style={{ color: "#f43f5e" }}
                    onClick={() => setDeletingOrg(org)}>
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
        {sortedPoints.map((point) => (
          <div key={point.month} className="timeline-item">
            <div className="timeline-marker" />
            <div className="timeline-content">
              <div className="timeline-header">
                <h4>{monthLabel(point.month)}</h4>
                <span>Salary Slip</span>
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
        ))}
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
