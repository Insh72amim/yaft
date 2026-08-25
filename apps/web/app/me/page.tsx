"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  ExternalLink,
  FileLock2,
  Globe,
  History,
  Key,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Trash2,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, downloadPostFile, errorMessage, isUnauthorized } from "@/lib/api";

type UserProfile = {
  id: string;
  name: string;
  email: string;
};

type DriveConfig = {
  connected: boolean;
  email: string | null;
  autoBackupEnabled: boolean;
  hasAutoPassphrase: boolean;
  lastBackupAt: string | null;
  lastBackupStatus: string | null;
  lastBackupError: string | null;
};

type DriveRevision = {
  id: string;
  modifiedTime: string;
  size: number;
  keepForever?: boolean;
};

export default function ProfileMePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Preference state
  const [defaultDatePreset, setDefaultDatePreset] = useState("DEFAULT");
  const [savedMessage, setSavedMessage] = useState("");

  // Local Backup & Restore state
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
    salariesRestored: number;
    organizationsRestored: number;
    holdingsRestored: number;
    filesRestored: number;
  } | null>(null);

  // Google Drive Cloud Backup & Version Sync state
  const [driveConfig, setDriveConfig] = useState<DriveConfig | null>(null);
  const [driveRevisions, setDriveRevisions] = useState<DriveRevision[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveActionLoading, setDriveActionLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [driveSuccess, setDriveSuccess] = useState("");
  const [driveManualPassphrase, setDriveManualPassphrase] = useState("");
  const [driveAutoPassphraseInput, setDriveAutoPassphraseInput] = useState("");
  const [isEditingAutoPassphrase, setIsEditingAutoPassphrase] = useState(false);

  // Cloud Restore Modal State
  const [cloudRestoreTargetRev, setCloudRestoreTargetRev] = useState<DriveRevision | null>(null);
  const [cloudRestorePassphrase, setCloudRestorePassphrase] = useState("");
  const [cloudRestoring, setCloudRestoring] = useState(false);
  const [cloudRestoreError, setCloudRestoreError] = useState("");

  const loadGoogleDriveData = useCallback(async () => {
    try {
      setDriveLoading(true);
      const cfg = await api<DriveConfig>("/backup/drive/config");
      setDriveConfig(cfg);
      if (cfg.connected) {
        const revs = await api<DriveRevision[]>("/backup/drive/revisions").catch(() => []);
        setDriveRevisions(revs);
      } else {
        setDriveRevisions([]);
      }
    } catch {
      // Non-fatal if drive config can't be fetched
    } finally {
      setDriveLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load stored default date preset preference
    const stored = localStorage.getItem("yaft_default_date_preset");
    if (stored) setDefaultDatePreset(stored);

    async function loadProfileData() {
      try {
        const meData = await api<UserProfile>("/auth/me");
        setProfile(meData);
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
    loadGoogleDriveData();

    // Check for Google OAuth callback in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const redirectUri = window.location.origin + window.location.pathname;
      window.history.replaceState({}, "", window.location.pathname);
      setDriveSuccess("Linking Google Drive account…");
      api<any>("/backup/drive/callback", {
        method: "POST",
        body: JSON.stringify({ code, redirectUri }),
      })
        .then(() => {
          setDriveSuccess("Google Drive connected successfully!");
          loadGoogleDriveData();
          setTimeout(() => setDriveSuccess(""), 4000);
        })
        .catch((err) => {
          setDriveError(errorMessage(err, "Failed to connect Google Drive."));
        });
    }
  }, [router, loadGoogleDriveData]);

  const handleSavePreferences = (preset: string) => {
    setDefaultDatePreset(preset);
    localStorage.setItem("yaft_default_date_preset", preset);
    setSavedMessage("Preference saved!");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleConnectDrive = async () => {
    try {
      setDriveError("");
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await api<{ configured: boolean; authUrl: string | null; message?: string }>(
        `/backup/drive/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`
      );
      if (!res.configured || !res.authUrl) {
        setDriveError(res.message || "Google OAuth credentials not configured on the server.");
        return;
      }
      window.location.href = res.authUrl;
    } catch (err) {
      setDriveError(errorMessage(err, "Failed to initiate Google Drive authorization."));
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm("Are you sure you want to disconnect Google Drive? Your existing cloud backups in Google Drive will remain safe.")) {
      return;
    }
    try {
      setDriveActionLoading(true);
      await api("/backup/drive/disconnect", { method: "DELETE" });
      setDriveSuccess("Google Drive disconnected.");
      setDriveConfig(null);
      setDriveRevisions([]);
      setTimeout(() => setDriveSuccess(""), 3000);
    } catch (err) {
      setDriveError(errorMessage(err, "Failed to disconnect Google Drive."));
    } finally {
      setDriveActionLoading(false);
    }
  };

  const handleSaveAutoPassphrase = async () => {
    if (!driveAutoPassphraseInput || driveAutoPassphraseInput.trim().length < 6) {
      setDriveError("Auto-backup passphrase must be at least 6 characters.");
      return;
    }
    try {
      setDriveActionLoading(true);
      setDriveError("");
      await api("/backup/drive/settings", {
        method: "PATCH",
        body: JSON.stringify({ autoPassphrase: driveAutoPassphraseInput.trim() }),
      });
      setDriveSuccess("Automated daily backup passphrase securely saved!");
      setIsEditingAutoPassphrase(false);
      setDriveAutoPassphraseInput("");
      loadGoogleDriveData();
      setTimeout(() => setDriveSuccess(""), 3000);
    } catch (err) {
      setDriveError(errorMessage(err, "Failed to save auto-backup passphrase."));
    } finally {
      setDriveActionLoading(false);
    }
  };

  const handleToggleDailyBackup = async (enabled: boolean) => {
    try {
      setDriveActionLoading(true);
      setDriveError("");
      await api("/backup/drive/settings", {
        method: "PATCH",
        body: JSON.stringify({ autoBackupEnabled: enabled }),
      });
      loadGoogleDriveData();
    } catch (err) {
      setDriveError(errorMessage(err, "Failed to update automated backup schedule."));
    } finally {
      setDriveActionLoading(false);
    }
  };

  const handleUploadDriveBackup = async () => {
    if (!driveManualPassphrase && !driveConfig?.hasAutoPassphrase) {
      setDriveError("Please enter an encryption passphrase for this cloud backup.");
      return;
    }
    try {
      setDriveActionLoading(true);
      setDriveError("");
      setDriveSuccess("");
      const res = await api<{ success: boolean; byteSize: number; revisionId: string }>(
        "/backup/drive/upload",
        {
          method: "POST",
          body: JSON.stringify({ passphrase: driveManualPassphrase.trim() || undefined }),
        }
      );
      const sizeMb = (res.byteSize / (1024 * 1024)).toFixed(2);
      setDriveSuccess(`Encrypted backup pushed to Google Drive successfully (${sizeMb} MB)!`);
      setDriveManualPassphrase("");
      loadGoogleDriveData();
      setTimeout(() => setDriveSuccess(""), 5000);
    } catch (err) {
      setDriveError(errorMessage(err, "Failed to upload backup to Google Drive."));
    } finally {
      setDriveActionLoading(false);
    }
  };

  const handleExecuteCloudRestore = async () => {
    if (!cloudRestoreTargetRev || !cloudRestorePassphrase.trim()) {
      setCloudRestoreError("Please enter the decryption passphrase for this backup.");
      return;
    }
    try {
      setCloudRestoring(true);
      setCloudRestoreError("");
      const res = await api<any>("/backup/drive/restore", {
        method: "POST",
        body: JSON.stringify({
          passphrase: cloudRestorePassphrase.trim(),
          revisionId: cloudRestoreTargetRev.id,
        }),
      });
      setRestoreResult(res);
      setCloudRestoreTargetRev(null);
      setCloudRestorePassphrase("");
      setDriveSuccess("Google Drive cloud revision restored successfully into ledger!");
      setTimeout(() => setDriveSuccess(""), 5000);
    } catch (err) {
      setCloudRestoreError(errorMessage(err, "Failed to restore backup revision from Google Drive. Please verify passphrase."));
    } finally {
      setCloudRestoring(false);
    }
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
                    borderRadius: "50%",
                    background: "var(--accent-glow)",
                    border: "1px solid var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                  }}>
                  <User size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
                    {profile?.name || "YAFT User"}
                  </h2>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                    {profile?.email}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gap: "10px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>User ID (sub):</span>
                  <code style={{ fontFamily: "monospace", fontSize: "12px" }}>
                    {profile?.id}
                  </code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Security Model:</span>
                  <span style={{ color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                    <ShieldCheck size={14} /> Zero-Knowledge At Rest
                  </span>
                </div>
              </div>
            </article>

            {/* Application Preferences Panel */}
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sliders size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                  Ledger Date Range Preferences
                </h3>
              </div>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                Choose the default timeline range opened when navigating to Transactions or Dashboard.
              </p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[
                  { label: "Full History (All Time)", value: "ALL" },
                  { label: "Last 30 Days", value: "30D" },
                  { label: "This Month", value: "MONTH" },
                  { label: "This Year", value: "YEAR" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`button compact ${defaultDatePreset === opt.value ? "primary" : "secondary"}`}
                    onClick={() => handleSavePreferences(opt.value)}
                    style={{ fontSize: "12px", padding: "6px 12px" }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {savedMessage && (
                <span style={{ fontSize: "12px", color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <Check size={14} /> {savedMessage}
                </span>
              )}
            </article>
          </section>

          {/* Section 2: Google Drive Automated Versioned Cloud Backup & Sync */}
          <section className="panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <span className="eyebrow">Automated Cloud Redundancy</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Cloud size={22} color="#0ea5e9" />
                  <h2 style={{ margin: "4px 0 2px 0", fontSize: "18px" }}>Google Drive Cloud Backup & Version History</h2>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                  Push daily encrypted snapshots into your private Google Drive folder with native revision history and 1-click cloud restoration.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "12px",
                    background: driveConfig?.connected ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)",
                    color: driveConfig?.connected ? "#10b981" : "var(--muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: driveConfig?.connected ? "#10b981" : "#94a3b8" }} />
                  {driveConfig?.connected ? `Connected (${driveConfig.email})` : "Disconnected"}
                </span>

                {driveConfig?.connected ? (
                  <button
                    type="button"
                    className="button ghost compact"
                    disabled={driveActionLoading}
                    onClick={handleDisconnectDrive}
                    style={{ fontSize: "11px", padding: "4px 10px", color: "#ef4444" }}>
                    <Trash2 size={12} style={{ marginRight: "4px" }} /> Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button primary compact"
                    disabled={driveActionLoading}
                    onClick={handleConnectDrive}
                    style={{ fontSize: "12px", padding: "6px 14px" }}>
                    <ExternalLink size={13} style={{ marginRight: "6px" }} /> Connect Google Drive
                  </button>
                )}
              </div>
            </div>

            {driveError && <p className="error" style={{ fontSize: "12px", marginBottom: "16px" }}>{driveError}</p>}
            {driveSuccess && <p style={{ fontSize: "12px", color: "#10b981", marginBottom: "16px", fontWeight: 600 }}>{driveSuccess}</p>}

            {driveConfig?.connected ? (
              <div style={{ display: "grid", gap: "20px" }}>
                {/* Control Panel Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                  {/* Manual Push Card */}
                  <div
                    style={{
                      background: "var(--background-alt)",
                      border: "1px solid var(--line)",
                      borderRadius: "14px",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "14px",
                    }}>
                    <div>
                      <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                        <Upload size={16} color="#0ea5e9" /> Push Snapshot Now
                      </h4>
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px 0" }}>
                        Uploads a new encrypted version into your Google Drive <code style={{ fontSize: "11px" }}>YAFT Backups</code> folder.
                      </p>

                      <div style={{ display: "grid", gap: "6px" }}>
                        <label style={{ fontSize: "11px", fontWeight: 600 }}>Encryption Passphrase</label>
                        <input
                          type="password"
                          placeholder={driveConfig.hasAutoPassphrase ? "Using saved auto-passphrase (or enter override)..." : "Enter encryption passphrase..."}
                          value={driveManualPassphrase}
                          onChange={(e) => setDriveManualPassphrase(e.target.value)}
                          style={{
                            padding: "6px 10px",
                            fontSize: "12px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "var(--card)",
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="button primary"
                      disabled={driveActionLoading || (!driveManualPassphrase && !driveConfig.hasAutoPassphrase)}
                      onClick={handleUploadDriveBackup}
                      style={{ fontSize: "12px", padding: "8px 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      {driveActionLoading ? <RefreshCw className="spin" size={14} /> : <Upload size={14} />}
                      <span>{driveActionLoading ? "Exporting & Uploading..." : "Backup to Drive Now"}</span>
                    </button>
                  </div>

                  {/* Automated Nightly Schedule Card */}
                  <div
                    style={{
                      background: "var(--background-alt)",
                      border: "1px solid var(--line)",
                      borderRadius: "14px",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "14px",
                    }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                          <Zap size={16} color="#f59e0b" /> Daily Automated Backup
                        </h4>
                        <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={driveConfig.autoBackupEnabled}
                            onChange={(e) => handleToggleDailyBackup(e.target.checked)}
                            style={{ width: "16px", height: "16px", cursor: "pointer" }}
                          />
                        </label>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 10px 0" }}>
                        Runs every day at 02:00 AM automatically in the background.
                      </p>

                      <div style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                          <span>Last Backup:</span>
                          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                            {driveConfig.lastBackupAt ? new Date(driveConfig.lastBackupAt).toLocaleString() : "Never"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                          <span>Auto-Passphrase Status:</span>
                          <span style={{ fontWeight: 600, color: driveConfig.hasAutoPassphrase ? "#10b981" : "#f59e0b" }}>
                            {driveConfig.hasAutoPassphrase ? "Configured (AES-256 Secured)" : "Not Set"}
                          </span>
                        </div>
                      </div>

                      {isEditingAutoPassphrase && (
                        <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600 }}>Set Auto-Backup Passphrase</label>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input
                              type="password"
                              placeholder="Enter passphrase (min 6 chars)..."
                              value={driveAutoPassphraseInput}
                              onChange={(e) => setDriveAutoPassphraseInput(e.target.value)}
                              style={{
                                flex: 1,
                                padding: "6px 10px",
                                fontSize: "12px",
                                borderRadius: "6px",
                                border: "1px solid var(--line)",
                                background: "var(--card)",
                              }}
                            />
                            <button
                              type="button"
                              className="button primary compact"
                              onClick={handleSaveAutoPassphrase}
                              style={{ fontSize: "11px" }}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="button ghost compact"
                              onClick={() => {
                                setIsEditingAutoPassphrase(false);
                                setDriveAutoPassphraseInput("");
                              }}
                              style={{ fontSize: "11px" }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditingAutoPassphrase && (
                      <button
                        type="button"
                        className="button secondary compact"
                        onClick={() => setIsEditingAutoPassphrase(true)}
                        style={{ fontSize: "11px", alignSelf: "flex-start" }}>
                        <Key size={12} style={{ marginRight: "4px" }} />
                        {driveConfig.hasAutoPassphrase ? "Update Auto-Passphrase" : "Set Auto-Passphrase"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Google Drive Revision History Table */}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                      <History size={16} color="var(--accent)" /> Drive Revision History ({driveRevisions.length} Snapshot{driveRevisions.length === 1 ? "" : "s"})
                    </h3>
                    <button
                      type="button"
                      className="button ghost compact"
                      onClick={loadGoogleDriveData}
                      disabled={driveLoading}
                      style={{ fontSize: "11px" }}>
                      <RefreshCw className={driveLoading ? "spin" : ""} size={12} style={{ marginRight: "4px" }} /> Refresh
                    </button>
                  </div>

                  {driveRevisions.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                      No cloud revisions found yet. Click &quot;Backup to Drive Now&quot; above to push your first snapshot.
                    </p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)", textAlign: "left" }}>
                            <th style={{ padding: "8px 10px" }}>Revision Date & Time</th>
                            <th style={{ padding: "8px 10px" }}>File Size</th>
                            <th style={{ padding: "8px 10px" }}>Revision ID</th>
                            <th style={{ padding: "8px 10px", textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driveRevisions.map((rev, idx) => {
                            const date = new Date(rev.modifiedTime).toLocaleString();
                            const sizeMb = (rev.size / (1024 * 1024)).toFixed(2);
                            const isLatest = idx === 0;
                            return (
                              <tr key={rev.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                <td style={{ padding: "10px" }}>
                                  <span style={{ fontWeight: isLatest ? 700 : 500 }}>{date}</span>
                                  {isLatest && (
                                    <span style={{ marginLeft: "8px", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 700 }}>
                                      LATEST
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "10px", color: "var(--muted)" }}>{sizeMb} MB</td>
                                <td style={{ padding: "10px" }}>
                                  <code style={{ fontSize: "11px", background: "var(--background-alt)", padding: "2px 6px", borderRadius: "4px" }}>
                                    {rev.id.substring(0, 16)}...
                                  </code>
                                </td>
                                <td style={{ padding: "10px", textAlign: "right" }}>
                                  <button
                                    type="button"
                                    className="button secondary compact"
                                    onClick={() => {
                                      setCloudRestoreTargetRev(rev);
                                      setCloudRestorePassphrase("");
                                      setCloudRestoreError("");
                                    }}
                                    style={{ fontSize: "11px", padding: "4px 10px" }}>
                                    <RotateCcw size={12} style={{ marginRight: "4px" }} /> Restore
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--background-alt)",
                  border: "1px dashed var(--line)",
                  borderRadius: "14px",
                  padding: "24px",
                  textAlign: "center",
                  display: "grid",
                  gap: "12px",
                  justifyItems: "center",
                }}>
                <Cloud size={36} color="var(--muted)" />
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700 }}>
                    Connect Your Google Drive
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", maxWidth: "500px" }}>
                    YAFT uses the strictly isolated <code style={{ fontSize: "11px" }}>drive.file</code> OAuth permission. It can only access files created by YAFT itself in a dedicated &quot;YAFT Backups&quot; folder.
                  </p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={handleConnectDrive}
                  style={{ fontSize: "13px", padding: "8px 18px" }}>
                  <ExternalLink size={14} style={{ marginRight: "6px" }} /> Authorize with Google
                </button>
              </div>
            )}
          </section>

          {/* Section 4: Encrypted Local Backup & Disaster Recovery Vault */}
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
                        <li>{restoreResult.holdingsRestored || 0} Demat & MF Holdings</li>
                        <li>{restoreResult.salariesRestored || 0} Salary Payslips</li>
                        <li>{restoreResult.organizationsRestored || 0} Employer Profiles</li>
                        <li>{restoreResult.documentsRestored} Account Documents ({restoreResult.filesRestored} S3 files restored)</li>
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
                        salariesRestored: number;
                        organizationsRestored: number;
                        holdingsRestored: number;
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

          {/* Cloud Restore Passphrase Modal */}
          {cloudRestoreTargetRev && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px",
              }}>
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "16px",
                  padding: "24px",
                  maxWidth: "460px",
                  width: "100%",
                  display: "grid",
                  gap: "16px",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Cloud size={22} color="#0ea5e9" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                      Restore Google Drive Revision
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {new Date(cloudRestoreTargetRev.modifiedTime).toLocaleString()} ({(cloudRestoreTargetRev.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                  Enter the encryption passphrase used when creating this cloud backup snapshot to decrypt and restore records into your ledger.
                </p>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600 }}>Decryption Passphrase</label>
                  <input
                    type="password"
                    placeholder="Enter backup passphrase..."
                    value={cloudRestorePassphrase}
                    onChange={(e) => setCloudRestorePassphrase(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "13px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--background-alt)",
                      width: "100%",
                    }}
                  />
                </div>

                {cloudRestoreError && (
                  <p className="error" style={{ fontSize: "12px", margin: 0 }}>
                    {cloudRestoreError}
                  </p>
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="button ghost"
                    disabled={cloudRestoring}
                    onClick={() => {
                      setCloudRestoreTargetRev(null);
                      setCloudRestorePassphrase("");
                      setCloudRestoreError("");
                    }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={cloudRestoring || !cloudRestorePassphrase.trim()}
                    onClick={handleExecuteCloudRestore}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    {cloudRestoring ? <RefreshCw className="spin" size={14} /> : <RotateCcw size={14} />}
                    <span>{cloudRestoring ? "Downloading & Restoring..." : "Restore Snapshot"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
