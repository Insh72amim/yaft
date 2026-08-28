"use client";

import { useState } from "react";
import { X, RefreshCw, Zap, ShieldCheck, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/api";

interface GrowwSyncModalProps {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function GrowwSyncModal({
  accountId,
  accountName,
  onClose,
  onSuccess,
}: GrowwSyncModalProps) {
  const [token, setToken] = useState("");
  const [saveToVault, setSaveToVault] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess(null);
    setSyncing(true);

    try {
      const payload: any = {
        saveCredential: saveToVault,
      };

      if (token.trim()) {
        payload.token = token.trim();
      }

      const res = await api<any>(`/investments/${accountId}/sync-groww`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(
        res.message ||
          `Successfully synchronized ${res.holdingsCount || 0} mutual fund holdings from Groww!`,
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(errorMessage(err, "Failed to sync holdings from Groww."));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          maxWidth: "520px",
          width: "100%",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--line)",
            padding: "16px 20px",
            background: "var(--background-alt)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "rgba(0, 208, 156, 0.12)",
                color: "#00d09c",
                borderRadius: "8px",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                Automated Groww Sync
              </h3>
              <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                {accountName}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="secondary compact"
            onClick={onClose}
            style={{ padding: "4px 8px", border: "none" }}
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSync} style={{ padding: "20px" }}>
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                background: "rgba(29, 117, 79, 0.1)",
                color: "var(--green)",
                border: "1px solid rgba(29, 117, 79, 0.2)",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                Groww Session Token or cURL
              </label>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "11px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: 0,
                }}
              >
                <HelpCircle size={13} /> {showHelp ? "Hide help" : "Where to find this?"}
              </button>
            </div>

            {showHelp && (
              <div
                style={{
                  background: "var(--background-alt)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "11.5px",
                  lineHeight: 1.5,
                  color: "var(--muted)",
                  marginBottom: "10px",
                }}
              >
                <strong>Easiest method (10 seconds):</strong>
                <ol style={{ margin: "6px 0 0 16px", padding: 0 }}>
                  <li>Log in to <strong>groww.in</strong> &rarr; Open Reports &rarr; Click download holdings.</li>
                  <li>Press <code>F12</code> &rarr; <strong>Network</strong> tab &rarr; find <code>holdings_report</code>.</li>
                  <li>Right-click <code>holdings_report</code> &rarr; <strong>Copy</strong> &rarr; <strong>Copy as cURL</strong> (or copy <code>x-user-campaign</code>) and paste below!</li>
                </ol>
              </div>
            )}

            <textarea
              rows={3}
              placeholder="Paste Groww x-user-campaign token OR full cURL (leave empty to use saved Vault token)..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--ink)",
                fontSize: "12px",
                fontFamily: "monospace",
                resize: "vertical",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            <input
              type="checkbox"
              id="saveGrowwToVault"
              checked={saveToVault}
              onChange={(e) => setSaveToVault(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <label htmlFor="saveGrowwToVault" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
              <ShieldCheck size={14} color="var(--green)" /> Save encrypted credentials in YAFT Vault for 1-click sync
            </label>
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="secondary compact"
              onClick={onClose}
              disabled={syncing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary compact"
              disabled={syncing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
              }}
            >
              {syncing ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  Syncing from Groww…
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Fetch &amp; Sync Valuation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
