"use client";

import {
  CreditCard,
  Gauge,
  Landmark,
  Lock,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
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
  recentTransactions: RecentTx[];
};

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
    if (rate <= 30) return { label: "Healthy (<30%)", className: "income" };
    if (rate <= 50) return { label: "Moderate (30-50%)", className: "saved" };
    return { label: "High Utilization (>50%)", className: "expense" };
  };

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial Command Center</span>
          <h1>Credit Cards Hub</h1>
          <p>
            Track overall credit utilization, monthly bill payments, statement cycles, and card vault credentials.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link href="/import" className="button secondary compact">
            <Upload size={14} /> Import Statement
          </Link>
          <Link href="/accounts" className="button primary compact">
            <Plus size={14} /> Add Card
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
          <p>Loading Credit Cards Hub...</p>
        </div>
      )}

      {data && (
        <>
          {/* Top KPI Cards */}
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
                <small style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)" }}>
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

          {/* Cards Gallery / Digital Stack */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}>
              <h2 style={{ fontSize: "1.25rem", margin: 0 }}>My Credit Cards</h2>
              <Link href="/accounts" style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
                Manage Accounts →
              </Link>
            </div>

            {data.cards.length === 0 ? (
              <div className="panel" style={{ padding: "32px", textAlign: "center" }}>
                <CreditCard size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
                <h3>No Credit Cards Added</h3>
                <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "16px" }}>
                  Add your credit cards to track limit utilization and statement bills.
                </p>
                <Link href="/accounts" className="button primary compact">
                  Add Credit Card
                </Link>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}>
                {data.cards.map((card) => (
                  <div
                    key={card.id}
                    className="panel"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      overflow: "hidden",
                      border: "1px solid var(--line)",
                      background: "linear-gradient(145deg, var(--card) 0%, rgba(15,23,42,0.6) 100%)",
                      padding: "20px",
                    }}>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "16px",
                        }}>
                        <div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "var(--accent)",
                            }}>
                            {card.institution || "Credit Card"}
                          </span>
                          <h3 style={{ fontSize: "1.1rem", margin: "2px 0 0 0" }}>{card.name}</h3>
                        </div>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "rgba(255,255,255,0.08)",
                            color: "var(--ink)",
                          }}>
                          {card.cardNetwork || "CARD"}
                        </span>
                      </div>

                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "15px",
                          letterSpacing: "2px",
                          color: "var(--muted)",
                          marginBottom: "20px",
                        }}>
                        •••• •••• •••• {card.cardLast4 || "••••"}
                      </div>

                      {/* Limit Utilization Progress Bar */}
                      <div style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "12px",
                            marginBottom: "6px",
                          }}>
                          <span style={{ color: "var(--muted)" }}>Limit Used</span>
                          <span style={{ fontWeight: 600 }}>
                            {money(card.outstanding)} / {money(card.creditLimit)} ({card.utilizationPercent}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: "6px",
                            background: "rgba(255,255,255,0.1)",
                            borderRadius: "3px",
                            overflow: "hidden",
                          }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, card.utilizationPercent)}%`,
                              background:
                                card.utilizationPercent > 50
                                  ? "#ef4444"
                                  : card.utilizationPercent > 30
                                  ? "#f59e0b"
                                  : "var(--green)",
                              borderRadius: "3px",
                            }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "12px",
                          padding: "12px",
                          background: "rgba(0,0,0,0.15)",
                          borderRadius: "10px",
                          marginBottom: "16px",
                          fontSize: "12px",
                        }}>
                        <div>
                          <span style={{ color: "var(--muted)", display: "block" }}>Available</span>
                          <strong style={{ color: "var(--green)" }}>{money(card.availableCredit)}</strong>
                        </div>
                        <div>
                          <span style={{ color: "var(--muted)", display: "block" }}>Outstanding</span>
                          <strong style={{ color: card.outstanding > 0 ? "#ef4444" : "var(--ink)" }}>
                            {money(card.outstanding)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Quick Card Actions */}
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        paddingTop: "12px",
                        borderTop: "1px solid var(--line)",
                      }}>
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
                ))}
              </div>
            )}
          </div>

          {/* Charts & Analytics Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}>
            {/* Monthly Spends vs Payments */}
            <div className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">Cash Flow</span>
                  <h2>Monthly Credit Card Flow</h2>
                </div>
              </div>

              {data.monthlySpendsAndPayments.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>No recent credit card transactions.</p>
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
                          <span style={{ color: "#ef4444", marginRight: "8px" }}>
                            -{money(item.spends)}
                          </span>
                          <span style={{ color: "var(--green)" }}>+{money(item.payments)}</span>
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

            {/* Top Categories */}
            <div className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">Spend Distribution</span>
                  <h2>Top Credit Card Categories</h2>
                </div>
              </div>

              {data.topCategories.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>No categorised credit card spend yet.</p>
              ) : (
                <div style={{ marginTop: "16px" }}>
                  {data.topCategories.map((cat) => (
                    <div key={cat.categoryId} style={{ marginBottom: "14px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          marginBottom: "4px",
                        }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: cat.color,
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>{cat.categoryName}</span>
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {money(cat.totalAmount)} ({cat.percentage}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: "6px",
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${cat.percentage}%`,
                            background: cat.color,
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Credit Card Activity Feed */}
          <div className="panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}>
            <div>
              <span className="eyebrow">Recent Activity</span>
              <h2>Recent Credit Card Transactions</h2>
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
