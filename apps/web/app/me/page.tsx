"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  CreditCard,
  Database,
  Download,
  FileLock2,
  Globe,
  Key,
  Landmark,
  Lock,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { ThemeColorSelector } from "@/components/theme-color-selector";
import { api, downloadPostFile, errorMessage, isUnauthorized } from "@/lib/api";

type UserProfile = {
  id: string;
  name: string;
  email: string;
};

type AccountItem = {
  id: string;
  name: string;
  type: string;
  institution?: string;
  accountNumber?: string;
  balance: number;
};

type VaultEntry = {
  accountId: string;
  last4?: string;
};

export default function ProfileMePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [vaultEntries, setVaultEntries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preference state
  const [defaultDatePreset, setDefaultDatePreset] = useState("DEFAULT");
  const [savedMessage, setSavedMessage] = useState("");

  // Backup & Restore state
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreResult, setRestoreResult] = useState<{
    accountsRestored: number;
    transactionsRestored: number;
    categoriesRestored: number;
    documentsRestored: number;
    filesRestored: number;
  } | null>(null);

  useEffect(() => {
    // Load stored default date preset preference
    const stored = localStorage.getItem("yaft_default_date_preset");
    if (stored) setDefaultDatePreset(stored);

    async function loadProfileData() {
      try {
        const [meData, accData, vaultData] = await Promise.all([
          api<UserProfile>("/auth/me"),
          api<AccountItem[]>("/accounts"),
          api<{ accountId: string; last4?: string }[]>("/vault").catch(() => []),
        ]);
        setProfile(meData);
        setAccounts(accData);

        const vMap: Record<string, string> = {};
        for (const v of vaultData) {
          if (v.last4) vMap[v.accountId] = v.last4;
        }
        setVaultEntries(vMap);
      } catch (err) {
        if (isUnauthorized(err)) {
          router.replace("/login");
        } else {
          setError(errorMessage(err, "Failed to load user profile."));
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfileData();
  }, [router]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSavePreferences = (preset: string) => {
    setDefaultDatePreset(preset);
    localStorage.setItem("yaft_default_date_preset", preset);
    setSavedMessage("Preference saved!");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">User profile & settings</span>
          <h1>My Account & Preferences</h1>
          <p>
            View your basic profile details, system identifiers, default configurations, and security status.
          </p>
        </div>
      </header>

      {error && (
        <p className="error" role="alert" style={{ marginBottom: "20px" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="loading">
          <span />
          <p>Loading profile & settings…</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "24px", maxWidth: "1200px" }}>
          {/* Section 1: User Identity Card & Quick Stats */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}>
            {/* User Details */}
            <article
              className="panel"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "18px",
                padding: "24px",
                display: "grid",
                gap: "16px",
              }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "16px",
                }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: "var(--theme-soft-end)",
                    color: "var(--green)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: "20px",
                  }}>
                  {profile?.name ? profile.name.trim()[0].toUpperCase() : <User />}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", letterSpacing: "-0.5px" }}>
                    {profile?.name}
                  </h2>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {profile?.email}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gap: "12px", fontSize: "13px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                  <span style={{ color: "var(--muted)" }}>User ID</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <code
                      style={{
                        fontFamily: "monospace",
                        fontSize: "12px",
                        background: "var(--background-alt)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                      }}>
                      {profile?.id}
                    </code>
                    <button
                      type="button"
                      className="ghost compact"
                      onClick={() => profile?.id && copyToClipboard(profile.id, "User ID")}
                      style={{ padding: "4px 8px", fontSize: "11px" }}>
                      {copiedId === profile?.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                  <span style={{ color: "var(--muted)" }}>Role & Vault Type</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "#10b981",
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}>
                    Personal Vault Owner
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                  <span style={{ color: "var(--muted)" }}>Data Isolation</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                    Self-Hosted Private Instance
                  </span>
                </div>
              </div>
            </article>

            {/* System Security & Instance Info */}
            <article
              className="panel"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "18px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "16px",
                }}>
                <ShieldCheck size={22} color="var(--green)" />
                <h3 style={{ margin: 0, fontSize: "16px" }}>Security & Engine Status</h3>
              </div>

              <div style={{ display: "grid", gap: "12px", fontSize: "12px", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Database size={16} color="var(--muted)" />
                  <div>
                    <strong style={{ display: "block" }}>Encrypted Local Database</strong>
                    <span style={{ color: "var(--muted)" }}>Strict Personal Privacy Rules Active</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Key size={16} color="var(--muted)" />
                  <div>
                    <strong style={{ display: "block" }}>Password Hashing Engine</strong>
                    <span style={{ color: "var(--muted)" }}>Argon2id High Security Standard</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Globe size={16} color="var(--muted)" />
                  <div>
                    <strong style={{ display: "block" }}>Document Storage Bucket</strong>
                    <span style={{ color: "var(--muted)" }}>S3 Bucket "yaft-documents" (Local MinIO/S3)</span>
                  </div>
                </div>
              </div>
            </article>
          </section>

          {/* Section 2: Basic Defaults & Configurations */}
          <section className="panel" style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
              }}>
              <Sliders size={20} color="var(--green)" />
              <h2 style={{ margin: 0, fontSize: "18px" }}>Default Preferences & Configurations</h2>
              {savedMessage && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#10b981",
                    marginLeft: "auto",
                  }}>
                  ✓ {savedMessage}
                </span>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "20px",
              }}>
              {/* Default Overview Time Range */}
              <div
                style={{
                  background: "var(--background-alt)",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "18px",
                  display: "grid",
                  gap: "10px",
                }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                  Default Overview Date Range
                </label>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                  Choose which date window Overview defaults to every time you log in or open YAFT.
                </p>
                <select
                  value={defaultDatePreset}
                  onChange={(e) => handleSavePreferences(e.target.value)}
                  style={{
                    height: "38px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    color: "var(--ink)",
                    padding: "0 10px",
                  }}>
                  <option value="DEFAULT">
                    Last Friday of prev month to Last Thursday of curr month (Default)
                  </option>
                  <option value="THIS_MONTH">Current Calendar Month</option>
                  <option value="LAST_MONTH">Last Calendar Month</option>
                  <option value="LAST_6_MONTHS">Last 6 Months</option>
                  <option value="THIS_FY">Financial Year (This FY)</option>
                </select>
              </div>

              {/* Theme & Palette Quick Settings */}
              <div
                style={{
                  background: "var(--background-alt)",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "18px",
                  display: "grid",
                  gap: "10px",
                }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                  Theme & Accent Color Customization
                </label>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                  Select your preferred UI color accent theme for YAFT.
                </p>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  <ThemeColorSelector />
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Encrypted Local Backup & Disaster Recovery Vault */}
          <section className="panel" style={{ padding: "24px" }}>
            <div style={{ marginBottom: "20px" }}>
              <span className="eyebrow">Disaster recovery & data privacy</span>
              <h2 style={{ margin: "4px 0 6px 0", fontSize: "18px" }}>Encrypted Local Backup & Restore (.yaft-backup)</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                Export your entire financial footprint (accounts, transactions, envelopes, rules, and attached MinIO statement documents) into an AES-256-GCM encrypted archive.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
              {/* Export Panel */}
              <div
                style={{
                  background: "var(--background-alt)",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <FileLock2 size={18} color="#10b981" />
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>1-Click Encrypted Export</h3>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px 0" }}>
                    Derives an AES-256 key via PBKDF2 with 100,000 iterations. The resulting archive contains zero unencrypted text.
                  </p>

                  <div style={{ display: "grid", gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600 }}>Set Backup Passphrase (min 6 chars)</label>
                    <input
                      type="password"
                      placeholder="Enter encryption passphrase..."
                      value={exportPassphrase}
                      onChange={(e) => setExportPassphrase(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        fontSize: "13px",
                        borderRadius: "8px",
                        border: "1px solid var(--line)",
                        background: "var(--card)",
                      }}
                    />
                  </div>

                  {exportError && <p className="error" style={{ fontSize: "12px", marginTop: "8px" }}>{exportError}</p>}
                  {exportSuccess && <p style={{ fontSize: "12px", color: "#10b981", marginTop: "8px", fontWeight: 600 }}>{exportSuccess}</p>}
                </div>

                <button
                  type="button"
                  className="button primary"
                  disabled={exporting || exportPassphrase.trim().length < 6}
                  onClick={async () => {
                    setExporting(true);
                    setExportError("");
                    setExportSuccess("");
                    try {
                      const dateStr = new Date().toISOString().split("T")[0];
                      await downloadPostFile(
                        "/backup/export",
                        { passphrase: exportPassphrase.trim() },
                        `yaft-backup-${dateStr}.yaft-backup`
                      );
                      setExportSuccess("Encrypted backup file generated and downloaded successfully!");
                    } catch (err) {
                      setExportError(errorMessage(err, "Failed to export backup."));
                    } finally {
                      setExporting(false);
                    }
                  }}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {exporting ? <RefreshCw className="spin" size={16} /> : <Download size={16} />}
                  <span>{exporting ? "Encrypting & Exporting..." : "Download .yaft-backup Archive"}</span>
                </button>
              </div>

              {/* Restore Panel */}
              <div
                style={{
                  background: "var(--background-alt)",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <Upload size={18} color="#0ea5e9" />
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Restore from .yaft-backup Archive</h3>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px 0" }}>
                    Decrypts the payload, validates authentication tags, and atomically restores database records & S3 attachments.
                  </p>

                  <div style={{ display: "grid", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Select Backup File (.yaft-backup)
                      </label>
                      <input
                        type="file"
                        accept=".yaft-backup"
                        onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                        style={{ fontSize: "12px" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Backup Passphrase
                      </label>
                      <input
                        type="password"
                        placeholder="Enter backup passphrase..."
                        value={restorePassphrase}
                        onChange={(e) => setRestorePassphrase(e.target.value)}
                        style={{
                          padding: "8px 12px",
                          fontSize: "13px",
                          borderRadius: "8px",
                          border: "1px solid var(--line)",
                          background: "var(--card)",
                          width: "100%",
                        }}
                      />
                    </div>
                  </div>

                  {restoreError && <p className="error" style={{ fontSize: "12px", marginTop: "8px" }}>{restoreError}</p>}
                  {restoreResult && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "10px 12px",
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#10b981",
                      }}>
                      <strong>Backup Restored Successfully!</strong>
                      <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                        <li>{restoreResult.accountsRestored} Accounts</li>
                        <li>{restoreResult.transactionsRestored} Transactions</li>
                        <li>{restoreResult.categoriesRestored} Categories</li>
                        <li>{restoreResult.documentsRestored} Documents ({restoreResult.filesRestored} S3 files)</li>
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="button secondary"
                  disabled={restoring || !restoreFile || !restorePassphrase.trim()}
                  onClick={async () => {
                    if (!restoreFile || !restorePassphrase.trim()) return;
                    setRestoring(true);
                    setRestoreError("");
                    setRestoreResult(null);
                    try {
                      const formData = new FormData();
                      formData.append("file", restoreFile);
                      formData.append("passphrase", restorePassphrase.trim());

                      const res = await api<{
                        accountsRestored: number;
                        transactionsRestored: number;
                        categoriesRestored: number;
                        documentsRestored: number;
                        filesRestored: number;
                      }>("/backup/restore", {
                        method: "POST",
                        body: formData,
                      });

                      setRestoreResult(res);
                    } catch (err) {
                      setRestoreError(errorMessage(err, "Failed to restore backup. Please verify passphrase."));
                    } finally {
                      setRestoring(false);
                    }
                  }}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {restoring ? <RefreshCw className="spin" size={16} /> : <Upload size={16} />}
                  <span>{restoring ? "Decrypting & Restoring..." : "Restore Archive to Ledger"}</span>
                </button>
              </div>
            </div>
          </section>

          {/* Section 3: System Identifiers & Linked Accounts Directory */}
          <section className="panel" style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "10px",
              }}>
              <div>
                <span className="eyebrow">System metadata</span>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Linked Accounts & System Identifiers (IDs)</h2>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  background: "var(--card-hover)",
                  border: "1px solid var(--line)",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontWeight: 600,
                }}>
                {accounts.length} Total Account{accounts.length === 1 ? "" : "s"}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <div className="account-transaction-table system-ids-table">
                <header>
                  <span>Account Name</span>
                  <span>System ID (accountId)</span>
                  <span>Type & Institution</span>
                  <span>Card / Account Masked</span>
                  <span style={{ textAlign: "right" }}>Copy</span>
                </header>

                {accounts.map((acc) => {
                  const last4 = vaultEntries[acc.id];
                  return (
                    <article key={acc.id} className="transaction-row">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
                        {acc.type === "CREDIT_CARD" ? (
                          <CreditCard size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                        ) : (
                          <Landmark size={15} color="#0ea5e9" style={{ flexShrink: 0 }} />
                        )}
                        <strong
                          style={{
                            fontSize: "13px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={acc.name}>
                          {acc.name}
                        </strong>
                      </div>

                      <div>
                        <code
                          style={{
                            fontFamily: "monospace",
                            fontSize: "11px",
                            background: "var(--background-alt)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            border: "1px solid var(--line)",
                          }}>
                          {acc.id}
                        </code>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: acc.type === "CREDIT_CARD" ? "rgba(245, 158, 11, 0.15)" : "rgba(14, 165, 233, 0.15)",
                            color: acc.type === "CREDIT_CARD" ? "#f59e0b" : "#0ea5e9",
                          }}>
                          {acc.type}
                        </span>
                        {acc.institution && (
                          <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                            ({acc.institution})
                          </small>
                        )}
                      </div>

                      <div>
                        {last4 ? (
                          <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 600 }}>
                            ••••{last4}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>—</span>
                        )}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="ghost compact"
                          onClick={() => copyToClipboard(acc.id, "Account ID")}
                          style={{ padding: "4px 8px", fontSize: "11px" }}>
                          {copiedId === acc.id ? (
                            <span style={{ color: "#10b981", fontWeight: 600 }}>Copied!</span>
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}
