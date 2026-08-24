"use client";

import { useState } from "react";
import { X, RefreshCw, Zap, ShieldCheck, Key, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/api";

interface ZerodhaSyncModalProps {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ZerodhaSyncModal({
  accountId,
  accountName,
  onClose,
  onSuccess,
}: ZerodhaSyncModalProps) {
  const [authType, setAuthType] = useState<"ENCTOKEN" | "KITE_API">("ENCTOKEN");
  const [enctoken, setEnctoken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
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

      if (authType === "ENCTOKEN") {
        if (enctoken.trim()) {
          payload.enctoken = enctoken.trim();
        }
      } else {
        if (apiKey.trim() && accessToken.trim()) {
          payload.apiKey = apiKey.trim();
          payload.accessToken = accessToken.trim();
        }
      }

      const res = await api<any>(`/investments/${accountId}/sync-zerodha`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(
        res.message ||
          `Successfully synchronized ${res.holdingsCount || 0} stock holdings from Zerodha!`,
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(errorMessage(err, "Failed to sync holdings from Zerodha."));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "520px", width: "95%" }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--line)",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "rgba(249, 115, 22, 0.12)",
                color: "#f97316",
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
                Automated Zerodha Sync
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

          <div
            style={{
              display: "flex",
              gap: "6px",
              background: "var(--background-alt)",
              padding: "4px",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={() => setAuthType("ENCTOKEN")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "6px",
                border: "none",
                background: authType === "ENCTOKEN" ? "var(--card)" : "transparent",
                color: authType === "ENCTOKEN" ? "var(--ink)" : "var(--muted)",
                fontWeight: 600,
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: authType === "ENCTOKEN" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Kite Session (enctoken)
            </button>
            <button
              type="button"
              onClick={() => setAuthType("KITE_API")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "6px",
                border: "none",
                background: authType === "KITE_API" ? "var(--card)" : "transparent",
                color: authType === "KITE_API" ? "var(--ink)" : "var(--muted)",
                fontWeight: 600,
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: authType === "KITE_API" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Kite Connect API
            </button>
          </div>

          {authType === "ENCTOKEN" ? (
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
                  Zerodha enctoken Cookie
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
                  <strong>How to get your enctoken in 3 steps:</strong>
                  <ol style={{ margin: "6px 0 0 16px", padding: 0 }}>
                    <li>Log in to <strong>kite.zerodha.com</strong> in your browser.</li>
                    <li>Press <code>F12</code> (or Inspect) &rarr; Go to <strong>Application</strong> tab &rarr; <strong>Cookies</strong> &rarr; <code>https://kite.zerodha.com</code>.</li>
                    <li>Copy the value of the <code>enctoken</code> cookie and paste it below.</li>
                  </ol>
                </div>
              )}

              <input
                type="password"
                placeholder="Paste enctoken (leave empty to use saved Vault token)..."
                value={enctoken}
                onChange={(e) => setEnctoken(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--ink)",
                  fontSize: "13px",
                  fontFamily: "monospace",
                }}
              />
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Kite API Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. your_kite_api_key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Access Token
                </label>
                <input
                  type="password"
                  placeholder="e.g. your_kite_access_token"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>
          )}

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
              id="saveToVault"
              checked={saveToVault}
              onChange={(e) => setSaveToVault(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <label htmlFor="saveToVault" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
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
                  Syncing from Zerodha…
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
