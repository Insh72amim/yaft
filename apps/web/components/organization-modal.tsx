"use client";
import { Building2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

type Organization = {
  id?: string;
  name: string;
  code?: string | null;
  taxId?: string | null;
  currency?: string;
  color?: string | null;
  isCurrent?: boolean;
};

export function OrganizationModal({
  org,
  onClose,
  onSuccess,
}: {
  org?: Organization | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(org?.name || "");
  const [code, setCode] = useState(org?.code || "");
  const [taxId, setTaxId] = useState(org?.taxId || "");
  const [currency, setCurrency] = useState(org?.currency || "INR");
  const [color, setColor] = useState(org?.color || "#4f46e5");
  const [isCurrent, setIsCurrent] = useState(Boolean(org?.isCurrent));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(org?.id);

  // Sync state whenever org prop updates
  useEffect(() => {
    setName(org?.name || "");
    setCode(org?.code || "");
    setTaxId(org?.taxId || "");
    setCurrency(org?.currency || "INR");
    setColor(org?.color || "#4f46e5");
    setIsCurrent(Boolean(org?.isCurrent));
    setError("");
  }, [org]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");

    try {
      if (isEditing && org?.id) {
        await api(`/organizations/${org.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim() || undefined,
            taxId: taxId.trim() || undefined,
            currency,
            color,
            isCurrent,
          }),
        });
      } else {
        await api("/organizations", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim() || undefined,
            taxId: taxId.trim() || undefined,
            currency,
            color,
            isCurrent,
          }),
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save organization."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close modal" />
      <section className="modal" role="dialog" aria-modal="true" style={{ maxWidth: "520px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: color,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 700,
                boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
              }}>
              <Building2 size={20} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px" }}>
                {isEditing ? "Edit Employer Organization" : "Create Organization"}
              </h3>
              <p style={{ margin: "2px 0 0 0", color: "var(--muted)", fontSize: "12px" }}>
                Manage employer details & payslip configuration.
              </p>
            </div>
          </div>
          <button type="button" className="ghost icon-only" onClick={onClose} style={{ borderRadius: "50%", padding: "6px" }}>
            <X size={18} />
          </button>
        </header>

        {error && <p className="error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
          <div>
            <label className="field-label" htmlFor="orgName">Organization / Employer Name *</label>
            <input
              id="orgName"
              className="text-input"
              type="text"
              placeholder="e.g. Acme Corp, Acme Corp, Google"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label" htmlFor="orgCode">Company Code</label>
              <input
                id="orgCode"
                className="text-input"
                type="text"
                placeholder="e.g. GS, STOR"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="orgTaxId">Corporate Tax ID / PAN</label>
              <input
                id="orgTaxId"
                className="text-input"
                type="text"
                placeholder="e.g. AAACG1234F"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label" htmlFor="orgCurrency">Currency</label>
              <select
                id="orgCurrency"
                className="text-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="orgColor">Theme Brand Color</label>
              <input
                id="orgColor"
                type="color"
                className="text-input"
                style={{ height: "42px", padding: "4px", cursor: "pointer" }}
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "var(--paper)", borderRadius: "10px", cursor: "pointer", border: "1px solid var(--line)" }}>
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              style={{ width: "16px", height: "16px", accentColor: "var(--indigo)" }}
            />
            <div>
              <strong style={{ fontSize: "13px", display: "block", color: "var(--ink)" }}>Set as Current Employer</strong>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>Pre-selects this employer on salary imports & top filters.</span>
            </div>
          </label>

          <footer className="modal-actions" style={{ marginTop: "12px" }}>
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy || !name.trim()}>
              {busy ? "Saving…" : isEditing ? "Save changes" : "Create organization"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
