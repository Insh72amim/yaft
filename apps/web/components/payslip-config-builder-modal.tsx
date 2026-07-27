"use client";
import { AlertCircle, CheckCircle2, FileCode, Play, Upload, X } from "lucide-react";
import { useState } from "react";
import { api, errorMessage, money } from "@/lib/api";

type Organization = {
  id: string;
  name: string;
  parsingConfig?: any;
  sampleFilename?: string | null;
};

export function PayslipConfigBuilderModal({
  org,
  onClose,
  onSuccess,
}: {
  org: Organization;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [configJson, setConfigJson] = useState(
    JSON.stringify(
      org.parsingConfig || {
        documentAnchors: [org.name.toUpperCase()],
        fields: {
          payPeriod: { anchor: "Pay Period" },
          grossEarnings: { anchor: "Gross Earnings" },
          grossDeductions: { anchor: "Total Deductions" },
          netPay: { anchor: "Net Pay" },
        },
        tables: [
          { startAnchor: "EARNINGS", endAnchor: "DEDUCTIONS", type: "EARNING" },
          { startAnchor: "DEDUCTIONS", endAnchor: "NET PAY", type: "DEDUCTION" },
        ],
      },
      null,
      2,
    ),
  );
  const [testResult, setTestResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleUploadSample() {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (pdfPassword) formData.set("pdfPassword", pdfPassword);

      const res = await api<any>(`/organizations/${org.id}/sample-slip`, {
        method: "POST",
        body: formData,
      });

      setConfigJson(JSON.stringify(res.detectedConfig, null, 2));
      setTestResult(res.extractedSample);
      setNotice("Sample uploaded successfully! Parsing rules auto-detected.");
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Could not analyze sample payslip."));
    } finally {
      setBusy(false);
    }
  }

  async function handleTestParser() {
    if (!file) {
      setError("Please select a sample payslip PDF file first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("configJson", configJson);
      if (pdfPassword) formData.set("pdfPassword", pdfPassword);

      const res = await api<any>(`/organizations/${org.id}/test-parser`, {
        method: "POST",
        body: formData,
      });

      setTestResult(res.parsedResult);
    } catch (err) {
      setError(errorMessage(err, "Test run failed. Check your JSON format or PDF."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveConfig() {
    setBusy(true);
    setError("");
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(configJson);
      } catch {
        throw new Error("Invalid JSON configuration format.");
      }

      await api(`/organizations/${org.id}`, {
        method: "PUT",
        body: JSON.stringify({ parsingConfig: parsed }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save parsing configuration."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: "840px", width: "90vw" }}>
        <header className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>Payslip Parser Config — {org.name}</h3>
            <small style={{ color: "var(--muted)" }}>
              Upload sample slip & inspect database JSON rules for parsing future slips.
            </small>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {error && <p className="error">{error}</p>}
        {notice && <p className="notice" style={{ color: "var(--green)" }}>{notice}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "16px" }}>
          {/* Left Column: Sample PDF & Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="panel" style={{ padding: "16px", background: "var(--card)" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>1. Sample Payslip PDF</h4>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ marginBottom: "12px" }}
              />
              <input
                type="password"
                className="text-input"
                placeholder="PDF opening password (if required)"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                style={{ marginBottom: "12px" }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={handleUploadSample}
                  disabled={busy || !file}>
                  <Upload size={14} /> Auto-Detect Anchors
                </button>
                <button
                  type="button"
                  className="primary compact"
                  onClick={handleTestParser}
                  disabled={busy || !file}>
                  <Play size={14} /> Test Run
                </button>
              </div>
            </div>

            {/* Test Execution Output */}
            {testResult && (
              <div
                className="panel"
                style={{
                  padding: "16px",
                  background: "var(--card)",
                  border: testResult.mathValidated ? "1px solid var(--green)" : "1px solid #e11d48",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px" }}>Test Extraction Result</h4>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: testResult.mathValidated ? "#10b981" : "#f43f5e",
                    }}>
                    {testResult.mathValidated ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {testResult.mathValidated ? "Math Verified" : "Math Discrepancy"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "12px" }}>
                  <div>
                    <small style={{ color: "var(--muted)" }}>Gross</small>
                    <div><strong>{money(testResult.grossEarnings)}</strong></div>
                  </div>
                  <div>
                    <small style={{ color: "var(--muted)" }}>Deductions</small>
                    <div><strong>{money(testResult.grossDeductions)}</strong></div>
                  </div>
                  <div>
                    <small style={{ color: "var(--muted)" }}>Net Pay</small>
                    <div><strong>{money(testResult.netPay)}</strong></div>
                  </div>
                </div>

                {testResult.lineItems.length > 0 && (
                  <div style={{ marginTop: "12px", maxHeight: "150px", overflowY: "auto", fontSize: "12px" }}>
                    <small style={{ color: "var(--muted)" }}>Extracted Line Items ({testResult.lineItems.length}):</small>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px" }}>
                      {testResult.lineItems.map((item: any, idx: number) => (
                        <li key={idx}>
                          <span>[{item.type}] </span>
                          <strong>{item.description}: </strong>
                          <span>{money(item.currentAmount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Database JSON Schema Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="field-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <FileCode size={16} /> Parser JSON Schema (Saved in DB)
              </label>
            </div>
            <textarea
              className="text-input"
              style={{
                fontFamily: "monospace",
                fontSize: "12px",
                height: "360px",
                resize: "vertical",
                background: "var(--bg)",
              }}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
            />
          </div>
        </div>

        <footer className="modal-actions" style={{ marginTop: "20px" }}>
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={handleSaveConfig} disabled={busy}>
            {busy ? "Saving config…" : "Save DB Config"}
          </button>
        </footer>
      </div>
    </div>
  );
}
