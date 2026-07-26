"use client";

import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CreditCard,
  Gauge,
  Lock,
  PieChart,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";
import { VaultModal } from "@/components/vault-modal";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";

type CardSummary = {
  id: string;
  name: string;
  institution: string | null;
  cardLast4: string | null;
  cardNetwork: string | null;
  creditLimit: number;
  currentBalance: number;
  outstanding: number;
  availableCredit: number;
  utilizationPercent: number;
  statementDate: number | null;
  dueDate: number | null;
};

type MonthlyFlow = {
  month: string;
  spends: number;
  payments: number;
};

type TopCategory = {
  categoryId: string;
  categoryName: string;
  color: string;
  totalAmount: number;
  percentage: number;
};

type TopOutbound = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categoryColor: string;
  accountName: string;
};

type RecentTx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categoryColor: string;
  accountName: string;
};

type CreditCardsApiResponse = {
  summary: {
    totalLimit: number;
    totalOutstanding: number;
    totalAvailable: number;
    utilizationRate: number;
    activeCardCount: number;
  };
  cards: CardSummary[];
  monthlySpendsAndPayments: MonthlyFlow[];
  topCategories: TopCategory[];
  topOutbound?: TopOutbound[];
  recentTransactions: RecentTx[];
};

function CreditCardDoughnutChart({
  categories,
  total,
}: {
  categories: Array<{ categoryName: string; color: string; totalAmount: number; percentage: number }>;
  total: number;
}) {
  const r = 38;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;

  let currentOffset = 0;
  const filtered = categories.filter((c) => c.totalAmount > 0);

  if (total <= 0 || filtered.length === 0) {
    return (
      <div style={{ position: "relative", width: "130px", height: "130px", flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width="130" height="130">
          <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="var(--line)" strokeWidth="12" />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <strong style={{ fontSize: "14px", color: "var(--muted)" }}>₹0</strong>
          <span style={{ fontSize: "9px", color: "var(--muted)", fontWeight: 600 }}>total spend</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "130px", height: "130px", flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        {filtered.map((cat, idx) => {
          const sliceLength = (cat.totalAmount / total) * circumference;
          const strokeDasharray = `${sliceLength} ${circumference - sliceLength}`;
          const strokeDashoffset = -currentOffset;
          currentOffset += sliceLength;

          return (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              stroke={cat.color || "#3b82f6"}
              strokeWidth="12"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dasharray 0.3s ease" }}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
        <strong style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>
          {money(total, true)}
        </strong>
        <span style={{ fontSize: "9px", color: "var(--muted)", fontWeight: 600 }}>total spend</span>
      </div>
    </div>
  );
}

export default function CreditCardsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CreditCardsApiResponse | null>(null);
  const [error, setError] = useState("");
  const [vaultAccount, setVaultAccount] = useState<{ id: string; name: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api<CreditCardsApiResponse>("/accounts/credit-cards/summary");
      setData(res);
    } catch (err) {
      if (isUnauthorized(err)) {
        router.replace("/login");
        return;
      }
      setError(errorMessage(err, "Failed to load credit cards data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getUtilizationBadge = (rate: number) => {
    if (rate <= 30) return { label: "Healthy (<30%)", className: "income", color: "var(--green)" };
    if (rate <= 50) return { label: "Moderate (30-50%)", className: "saved", color: "#f59e0b" };
    return { label: "High Utilization (>50%)", className: "expense", color: "#ef4444" };
  };

  const totalCategorySpend = data?.topCategories.reduce((sum, cat) => sum + cat.totalAmount, 0) ?? 0;

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial Command Center</span>
          <h1>Credit Cards Analysis</h1>
          <p>
            Aggregated card utilization, category spending breakdown, top outbound transactions, and cash flow.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link href="/import" className="button secondary compact">
            <Upload size={14} /> Import Statement
          </Link>
          <Link href="/accounts" className="button secondary compact">
            <Building2 size={14} /> View Accounts
          </Link>
        </div>
      </header>

      {error && (
        <p className="error" role="alert" style={{ marginBottom: "16px" }}>
          {error}
        </p>
      )}

      {loading && !data && (
        <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
          <p>Loading Credit Cards Analytics...</p>
        </div>
      )}

      {data && (
        <>
          {/* Top KPI Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}>
            <div className="panel" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span className={`summary-icon ${getUtilizationBadge(data.summary.utilizationRate).className}`}>
                <Gauge size={22} />
              </span>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "12px", fontWeight: 600 }}>
                  Credit Utilization
                </small>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>
                  {data.summary.utilizationRate}%
                </div>
                <small style={{ fontSize: "11px", fontWeight: 600, color: getUtilizationBadge(data.summary.utilizationRate).color }}>
                  {getUtilizationBadge(data.summary.utilizationRate).label}
                </small>
              </div>
            </div>

            <div className="panel" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span className="summary-icon expense">
                <TrendingDown size={22} />
              </span>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "12px", fontWeight: 600 }}>
                  Total Outstanding Bill
                </small>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef4444" }}>
                  {money(data.summary.totalOutstanding)}
                </div>
                <small style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Across {data.summary.activeCardCount} active card{data.summary.activeCardCount === 1 ? "" : "s"}
                </small>
              </div>
            </div>

            <div className="panel" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span className="summary-icon income">
                <TrendingUp size={22} />
              </span>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "12px", fontWeight: 600 }}>
                  Total Available Credit
                </small>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--green)" }}>
                  {money(data.summary.totalAvailable)}
                </div>
                <small style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Total limit: {money(data.summary.totalLimit)}
                </small>
              </div>
            </div>

            <div className="panel" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span className="summary-icon saved">
                <CreditCard size={22} />
              </span>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "12px", fontWeight: 600 }}>
                  Active Credit Cards
                </small>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>
                  {data.summary.activeCardCount}
                </div>
                <small style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Managed &amp; Monitored
                </small>
              </div>
            </div>
          </div>

          {/* Card Utilization & Limits Breakdown */}
          <div style={{ marginBottom: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}>
              <div>
                <span className="eyebrow">Card Limits &amp; Health</span>
                <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Card Utilization Breakdown</h2>
              </div>
              <Link href="/accounts" style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
                View Accounts →
              </Link>
            </div>

            {data.cards.length === 0 ? (
              <div className="panel" style={{ padding: "32px", textAlign: "center" }}>
                <CreditCard size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
                <h3>No Credit Cards Added</h3>
                <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "16px" }}>
                  Add your credit cards in Accounts to track limit utilization and statement bills.
                </p>
                <Link href="/accounts" className="button primary compact">
                  Add Credit Card
                </Link>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "16px",
                }}>
                {data.cards.map((card) => {
                  const badge = getUtilizationBadge(card.utilizationPercent);
                  return (
                    <div key={card.id} className="panel" style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>
                            {card.institution || "Credit Card"}
                          </span>
                          <h3 style={{ fontSize: "1rem", margin: "2px 0 0 0", fontWeight: 700 }}>{card.name}</h3>
                          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--muted)" }}>
                            •••• {card.cardLast4 || "••••"} ({card.cardNetwork || "CARD"})
                          </span>
                        </div>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "rgba(255,255,255,0.06)",
                            color: badge.color,
                            border: `1px solid ${badge.color}33`,
                          }}>
                          {card.utilizationPercent}% Used
                        </span>
                      </div>

                      {/* Utilization Bar */}
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                          <span style={{ color: "var(--muted)" }}>Outstanding</span>
                          <strong style={{ color: card.outstanding > 0 ? "#ef4444" : "var(--ink)" }}>
                            {money(card.outstanding)} / {money(card.creditLimit)}
                          </strong>
                        </div>
                        <div
                          style={{
                            height: "8px",
                            background: "rgba(255,255,255,0.08)",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, card.utilizationPercent)}%`,
                              background: badge.color,
                              borderRadius: "4px",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "12px",
                          padding: "10px 12px",
                          background: "rgba(0,0,0,0.06)",
                          borderRadius: "8px",
                          marginBottom: "14px",
                        }}>
                        <div>
                          <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Available Credit</span>
                          <strong style={{ color: "var(--green)" }}>{money(card.availableCredit)}</strong>
                        </div>
                        {(card.statementDate || card.dueDate) && (
                          <div style={{ textAlign: "right", fontSize: "11px", color: "var(--muted)" }}>
                            {card.statementDate && <div>Statement: Day {card.statementDate}</div>}
                            {card.dueDate && <div>Due: Day {card.dueDate}</div>}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <Link
                          href={`/import?accountId=${card.id}`}
                          className="button secondary compact"
                          style={{ flex: 1, justifyContent: "center", fontSize: "11px" }}>
                          <Upload size={12} /> Import
                        </Link>
                        <button
                          type="button"
                          className="button secondary compact"
                          style={{ flex: 1, justifyContent: "center", fontSize: "11px" }}
                          onClick={() => setVaultAccount({ id: card.id, name: card.name })}>
                          <Lock size={12} /> Vault
                        </button>
                        <Link
                          href={`/transactions?mode=CREDIT_CARD&accountId=${card.id}`}
                          className="button ghost compact"
                          style={{ padding: "6px 8px" }}
                          title="View Transactions">
                          <Receipt size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Spending Details Donut & Top Outbound Section (Overview-style 2 Column) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "24px",
              marginBottom: "28px",
            }}>
            {/* Column 1: Category Spending Details Pie/Donut Chart */}
            <div className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">Category Breakdown</span>
                  <h2>Credit Card Spending Details</h2>
                </div>
                <PieChart size={18} style={{ color: "var(--muted)" }} />
              </div>

              {data.topCategories.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "13px", padding: "20px 0" }}>
                  No categorised credit card spending recorded.
                </p>
              ) : (
                <div style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "16px" }}>
                  <CreditCardDoughnutChart categories={data.topCategories} total={totalCategorySpend} />

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                    {data.topCategories.map((cat) => (
                      <div key={cat.categoryId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: cat.color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{cat.categoryName}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>
                            {money(cat.totalAmount)}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>{cat.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Top 5 Outbound Transactions */}
            <div className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">Highest Expenses</span>
                  <h2>Top 5 Outbound Transactions</h2>
                </div>
                <TrendingDown size={18} style={{ color: "#ef4444" }} />
              </div>

              {!data.topOutbound || data.topOutbound.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "13px", padding: "20px 0" }}>
                  No outbound credit card expenses found.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                  {data.topOutbound.map((tx, idx) => (
                    <div
                      key={tx.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--line)",
                        borderRadius: "10px",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                        <span
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "rgba(239, 68, 68, 0.12)",
                            color: "#ef4444",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "12px",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}>
                          {idx + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: "block",
                              fontSize: "13px",
                              color: "var(--ink)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>
                            {tx.description}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                            {tx.accountName} •{" "}
                            {new Date(tx.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                        <strong style={{ fontSize: "14px", color: "#ef4444", fontWeight: 700 }}>
                          -{money(tx.amount)}
                        </strong>
                        <span
                          style={{
                            display: "block",
                            fontSize: "10px",
                            fontWeight: 600,
                            color: tx.categoryColor,
                          }}>
                          {tx.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Monthly Flow Chart Panel */}
          <div className="panel" style={{ marginBottom: "28px" }}>
            <div className="panel-title">
              <div>
                <span className="eyebrow">Cash Flow Analysis</span>
                <h2>Monthly Credit Card Flow (Spends vs Payments)</h2>
              </div>
            </div>

            {data.monthlySpendsAndPayments.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "13px" }}>No recent credit card transactions logged.</p>
            ) : (
              <div style={{ marginTop: "16px" }}>
                {data.monthlySpendsAndPayments.map((item) => (
                  <div key={item.month} style={{ marginBottom: "14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        marginBottom: "4px",
                      }}>
                      <span style={{ fontWeight: 600 }}>{item.month}</span>
                      <span>
                        <span style={{ color: "#ef4444", marginRight: "12px" }}>
                          Spends: -{money(item.spends)}
                        </span>
                        <span style={{ color: "var(--green)" }}>Payments: +{money(item.payments)}</span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        height: "8px",
                        gap: "4px",
                        borderRadius: "4px",
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.06)",
                      }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (item.spends / (item.spends + item.payments || 1)) * 100)}%`,
                          background: "#ef4444",
                          borderRadius: "4px",
                        }}
                      />
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (item.payments / (item.spends + item.payments || 1)) * 100)}%`,
                          background: "var(--green)",
                          borderRadius: "4px",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Table */}
          <div className="panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}>
              <div>
                <span className="eyebrow">Recent Feed</span>
                <h2>Recent Credit Card Activity</h2>
              </div>
              <Link
                href="/transactions?mode=CREDIT_CARD"
                style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
                View All Credit Card Transactions →
              </Link>
            </div>

            {data.recentTransactions.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "13px" }}>No transactions logged for credit cards.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                      <th style={{ padding: "10px", color: "var(--muted)" }}>Date</th>
                      <th style={{ padding: "10px", color: "var(--muted)" }}>Card</th>
                      <th style={{ padding: "10px", color: "var(--muted)" }}>Description</th>
                      <th style={{ padding: "10px", color: "var(--muted)" }}>Category</th>
                      <th style={{ padding: "10px", color: "var(--muted)", textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTransactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                          {new Date(tx.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td style={{ padding: "10px", fontWeight: 600 }}>{tx.accountName}</td>
                        <td style={{ padding: "10px" }}>{tx.description}</td>
                        <td style={{ padding: "10px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: "rgba(255,255,255,0.06)",
                              color: tx.categoryColor,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}>
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: tx.categoryColor,
                              }}
                            />
                            {tx.category}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "10px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: tx.amount < 0 ? "#ef4444" : "var(--green)",
                          }}>
                          {tx.amount < 0 ? `-${money(Math.abs(tx.amount))}` : `+${money(tx.amount)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Vault Password Modal */}
      {vaultAccount && (
        <VaultModal
          accountId={vaultAccount.id}
          onClose={() => {
            setVaultAccount(null);
            loadData();
          }}
        />
      )}
    </Shell>
  );
}
