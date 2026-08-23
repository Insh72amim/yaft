"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
  Layers,
  Sparkles,
  Check,
  X,
  Tag as TagIcon,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { CategoryOption } from "./envelopes-tab";

interface CategoriesTabProps {
  categories: CategoryOption[];
  onReload: () => void;
}

const COLOR_PRESETS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#64748b", // Slate
  "#f97316", // Orange
  "#14b8a6", // Teal
];

export function CategoriesTab({ categories, onReload }: CategoriesTabProps) {
  const [filterType, setFilterType] = useState<"ALL" | "EXPENSE" | "INCOME" | "INVESTMENT">("ALL");

  // Modal / Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryOption | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME" | "INVESTMENT">("EXPENSE");
  const [color, setColor] = useState("#3b82f6");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setType("EXPENSE");
    setColor("#3b82f6");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (cat: CategoryOption) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type || "EXPENSE");
    setColor(cat.color || "#3b82f6");
    setError("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a category name.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      if (editingCategory) {
        await api(`/categories/${editingCategory.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: name.trim(), type, color }),
        });
        setSuccessMsg(`Updated category "${name.trim()}"!`);
      } else {
        await api("/categories", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), type, color }),
        });
        setSuccessMsg(`Created new category "${name.trim()}"!`);
      }

      setModalOpen(false);
      onReload();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to save category."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;
    try {
      setError("");
      setSuccessMsg("");
      await api(`/categories/${id}`, { method: "DELETE" });
      setSuccessMsg(`Deleted category "${catName}".`);
      onReload();
    } catch (err: any) {
      setError(errorMessage(err, "Could not delete category."));
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (filterType === "ALL") return true;
    return (c.type || "EXPENSE") === filterType;
  });

  const expenseCount = categories.filter((c) => (c.type || "EXPENSE") === "EXPENSE").length;
  const incomeCount = categories.filter((c) => c.type === "INCOME").length;
  const investmentCount = categories.filter((c) => c.type === "INVESTMENT").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Banner & Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Taxonomy Governance
          </span>
          <h3 style={{ margin: "4px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)" }}>
            Categories Manager
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Create and edit custom financial categories, manage color themes, and organize expense, income, and investment types.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={openCreateModal}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontWeight: 700, fontSize: "13px" }}>
          <Plus size={16} />
          <span>+ Create New Category</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", padding: "12px 16px", borderRadius: "10px", fontSize: "13px" }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", padding: "12px 16px", borderRadius: "10px", fontSize: "13px" }}>
          {successMsg}
        </div>
      )}

      {/* Summary Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        <div style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Layers size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Total Categories</span>
            <strong style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>{categories.length}</strong>
          </div>
        </div>

        <div style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FolderPlus size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Expenses</span>
            <strong style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>{expenseCount}</strong>
          </div>
        </div>

        <div style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Income &amp; Investment</span>
            <strong style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>{incomeCount + investmentCount}</strong>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", background: "var(--background-alt)", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)", width: "fit-content" }}>
        {(["ALL", "EXPENSE", "INCOME", "INVESTMENT"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`secondary compact ${filterType === t ? "active" : ""}`}
            onClick={() => setFilterType(t)}
            style={{ fontSize: "12px", fontWeight: 700, padding: "5px 14px", borderRadius: "8px" }}>
            {t === "ALL" ? `All (${categories.length})` : t === "EXPENSE" ? `Expense (${expenseCount})` : t === "INCOME" ? `Income (${incomeCount})` : `Investment (${investmentCount})`}
          </button>
        ))}
      </div>

      {/* Categories Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {filteredCategories.map((cat) => {
          const catType = cat.type || "EXPENSE";
          const badgeBg = catType === "EXPENSE" ? "rgba(239, 68, 68, 0.12)" : catType === "INCOME" ? "rgba(16, 185, 129, 0.12)" : "rgba(139, 92, 246, 0.12)";
          const badgeColor = catType === "EXPENSE" ? "#ef4444" : catType === "INCOME" ? "#10b981" : "#8b5cf6";

          return (
            <div
              key={cat.id}
              className="panel"
              style={{
                padding: "18px",
                borderRadius: "12px",
                border: "1px solid var(--line)",
                background: "var(--card)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: cat.color || "#3b82f6", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>{cat.name}</h4>
                  <span style={{ display: "inline-block", marginTop: "4px", padding: "2px 8px", borderRadius: "6px", background: badgeBg, color: badgeColor, fontSize: "10px", fontWeight: 800, letterSpacing: "0.04em" }}>
                    {catType}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="icon-button"
                  title="Edit Category"
                  onClick={() => openEditModal(cat)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  title="Delete Category"
                  onClick={() => handleDelete(cat.id, cat.name)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Creating / Editing Category */}
      {modalOpen && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setModalOpen(false)} aria-label="Close modal" />
          <section className="modal" style={{ width: "min(480px, 95vw)", padding: "24px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)" }}>
                {editingCategory ? `Edit "${editingCategory.name}"` : "Create New Category"}
              </h3>
              <button type="button" className="icon-button" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>Category Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Subscriptions, Pet Care, Utilities"
                  required
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>Category Type</label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                  <option value="INVESTMENT">Investment</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>Color Theme</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setColor(p)}
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: p,
                        border: color === p ? "3px solid var(--ink)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                      {color === p && <Check size={14} color="#ffffff" />}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="primary">
                  {saving ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
