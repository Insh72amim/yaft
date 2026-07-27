"use client";
import { Building2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, errorMessage } from "@/lib/api";

type Organization = {
  id?: string;
  name: string;
  code?: string | null;
  taxId?: string | null;
  currency?: string;
  color?: string | null;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(org?.id);

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
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: "480px" }}>
        <header className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: color,
                display: "grid",
                placeItems: "center",
                color: "#fff",
              }}>
              <Building2 size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0 }}>
                {isEditing ? "Edit Employer Organization" : "Create Organization"}
              </h3>
              <small style={{ color: "var(--muted)" }}>
                Manage employer details & payslip configuration.
              </small>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
          <div>
            <label className="field-label" htmlFor="orgName">Organization / Employer Name *</label>
            <input
              id="orgName"
              className="text-input"
              type="text"
              placeholder="e.g. Goldman Sachs, Acme Corp, Google"
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

          <footer className="modal-actions" style={{ marginTop: "12px" }}>
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy || !name.trim()}>
              {busy ? "Saving…" : isEditing ? "Save changes" : "Create organization"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
