"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Layers,
  FolderTree,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { CategoryOption, SuperCategoryOption } from "./envelopes-tab";

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
  const [superCategories, setSuperCategories] = useState<SuperCategoryOption[]>([]);
  const [loadingSuper, setLoadingSuper] = useState(false);
  const [selectedSuperFilterId, setSelectedSuperFilterId] = useState<string>("ALL");

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryOption | null>(null);
  const [catName, setCatName] = useState("");
  const [catSuperId, setCatSuperId] = useState<string>("");
  const [catColor, setCatColor] = useState("#3b82f6");
  const [catSaving, setCatSaving] = useState(false);

  // Super Category Modal State
  const [superModalOpen, setSuperModalOpen] = useState(false);
  const [editingSuper, setEditingSuper] = useState<SuperCategoryOption | null>(null);
  const [superName, setSuperName] = useState("");
  const [superKind, setSuperKind] = useState<"EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER">("EXPENSE");
  const [superColor, setSuperColor] = useState("#3b82f6");
  const [superSaving, setSuperSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadSuperCategories = useCallback(async () => {
    try {
      setLoadingSuper(true);
      const res = await api<SuperCategoryOption[]>("/super-categories");
      setSuperCategories(res || []);
    } catch (err: any) {
      console.error("Could not load super categories", err);
    } finally {
      setLoadingSuper(false);
    }
  }, []);

  useEffect(() => {
    loadSuperCategories();
  }, [loadSuperCategories]);

  // Open Create / Edit Category Modal
  const openCreateCatModal = () => {
    setEditingCategory(null);
    setCatName("");
    setCatSuperId(superCategories[0]?.id || "");
    setCatColor("#3b82f6");
    setError("");
    setCatModalOpen(true);
  };

  const openEditCatModal = (cat: CategoryOption) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSuperId(cat.superCategoryId || cat.superCategory?.id || superCategories[0]?.id || "");
    setCatColor(cat.color || "#3b82f6");
    setError("");
    setCatModalOpen(true);
  };

  // Open Create / Edit Super Category Modal
  const openCreateSuperModal = () => {
    setEditingSuper(null);
    setSuperName("");
    setSuperKind("EXPENSE");
    setSuperColor("#3b82f6");
    setError("");
    setSuperModalOpen(true);
  };

  const openEditSuperModal = (superCat: SuperCategoryOption) => {
    setEditingSuper(superCat);
    setSuperName(superCat.name);
    setSuperKind(superCat.kind);
    setSuperColor(superCat.color || "#3b82f6");
    setError("");
    setSuperModalOpen(true);
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setError("Please enter a category name.");
      return;
    }

    try {
      setCatSaving(true);
      setError("");
      setSuccessMsg("");

      const chosenSuper = superCategories.find((s) => s.id === catSuperId);
      const categoryType = chosenSuper ? chosenSuper.kind : "EXPENSE";

      if (editingCategory) {
        await api(`/categories/${editingCategory.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: catName.trim(),
            color: catColor,
            type: categoryType,
            superCategoryId: catSuperId || null,
          }),
        });
        setSuccessMsg(`Updated category "${catName.trim()}"!`);
      } else {
        await api("/categories", {
          method: "POST",
          body: JSON.stringify({
            name: catName.trim(),
            color: catColor,
            type: categoryType,
            superCategoryId: catSuperId || null,
          }),
        });
        setSuccessMsg(`Created category "${catName.trim()}"!`);
      }

      setCatModalOpen(false);
      onReload();
      loadSuperCategories();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to save category."));
    } finally {
      setCatSaving(false);
    }
  };

  // Save Super Category
  const handleSaveSuperCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superName.trim()) {
      setError("Please enter a super category name.");
      return;
    }

    try {
      setSuperSaving(true);
      setError("");
      setSuccessMsg("");

      if (editingSuper) {
        await api(`/super-categories/${editingSuper.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: superName.trim(),
            kind: superKind,
            color: superColor,
          }),
        });
        setSuccessMsg(`Updated super category "${superName.trim()}"!`);
      } else {
        await api("/super-categories", {
          method: "POST",
          body: JSON.stringify({
            name: superName.trim(),
            kind: superKind,
            color: superColor,
          }),
        });
        setSuccessMsg(`Created super category "${superName.trim()}"!`);
      }

      setSuperModalOpen(false);
      loadSuperCategories();
      onReload();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to save super category."));
    } finally {
      setSuperSaving(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      setError("");
      setSuccessMsg("");
      await api(`/categories/${id}`, { method: "DELETE" });
      setSuccessMsg(`Deleted category "${name}".`);
      onReload();
      loadSuperCategories();
    } catch (err: any) {
      setError(errorMessage(err, "Could not delete category."));
    }
  };

  // Delete Super Category
  const handleDeleteSuperCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete super category "${name}"? Child categories will become unparented but remain safe.`)) return;
    try {
      setError("");
      setSuccessMsg("");
      await api(`/super-categories/${id}`, { method: "DELETE" });
      setSuccessMsg(`Deleted super category "${name}".`);
      loadSuperCategories();
      onReload();
    } catch (err: any) {
      setError(errorMessage(err, "Could not delete super category."));
    }
  };

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "EXPENSE":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", label: "Expense" };
      case "INCOME":
        return { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981", label: "Income" };
      case "INVESTMENT":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", label: "Investment" };
      case "TRANSFER":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", label: "Internal Transfer" };
      default:
        return { bg: "rgba(100, 116, 139, 0.12)", color: "#64748b", label: kind };
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (selectedSuperFilterId === "ALL") return true;
    const parentId = c.superCategoryId || c.superCategory?.id;
    return parentId === selectedSuperFilterId;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header & Global Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h3 style={{ margin: "0", fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>
            Financial Taxonomy &amp; Categories
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Create and organize custom Super Categories and nest your financial categories under them.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="secondary"
            onClick={openCreateSuperModal}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px", fontWeight: 700, fontSize: "13px" }}>
            <FolderTree size={16} color="var(--green)" />
            <span>+ Add Super Category</span>
          </button>

          <button
            type="button"
            className="primary"
            onClick={openCreateCatModal}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontWeight: 700, fontSize: "13px" }}>
            <Plus size={16} />
            <span>+ Add Category</span>
          </button>
        </div>
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

      {/* SECTION 1: SUPER CATEGORIES */}
      <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={18} color="var(--green)" />
            <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--ink)" }}>
              Super Categories ({superCategories.length})
            </h4>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            High-level financial parent groups
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
          {superCategories.map((s) => {
            const kindBadge = getKindBadge(s.kind);
            const count = s._count?.categories ?? s.categories?.length ?? 0;

            return (
              <div
                key={s.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: `1.5px solid ${s.color || "var(--line)"}40`,
                  background: "var(--card)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <span style={{ width: "14px", height: "14px", borderRadius: "4px", background: s.color || "#3b82f6", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}
                    </h4>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                      <span style={{ padding: "2px 6px", borderRadius: "5px", background: kindBadge.bg, color: kindBadge.color, fontSize: "9px", fontWeight: 800 }}>
                        {kindBadge.label}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                        {count} {count === 1 ? "cat" : "cats"}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="icon-button"
                    title="Edit Super Category"
                    onClick={() => openEditSuperModal(s)}>
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="Delete Super Category"
                    onClick={() => handleDeleteSuperCategory(s.id, s.name)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: CATEGORIES */}
      <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--ink)" }}>
            Categories ({filteredCategories.length})
          </h4>

          {/* Filter Pills by Super Category */}
          <div style={{ display: "flex", gap: "6px", background: "var(--background-alt)", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`secondary compact ${selectedSuperFilterId === "ALL" ? "active" : ""}`}
              onClick={() => setSelectedSuperFilterId("ALL")}
              style={{ fontSize: "11px", fontWeight: 700, padding: "5px 12px", borderRadius: "7px" }}>
              All ({categories.length})
            </button>
            {superCategories.map((s) => {
              const catCount = categories.filter((c) => (c.superCategoryId || c.superCategory?.id) === s.id).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`secondary compact ${selectedSuperFilterId === s.id ? "active" : ""}`}
                  onClick={() => setSelectedSuperFilterId(s.id)}
                  style={{ fontSize: "11px", fontWeight: 700, padding: "5px 12px", borderRadius: "7px" }}>
                  {s.name} ({catCount})
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {filteredCategories.map((cat) => {
            const parentSuper = superCategories.find((s) => s.id === (cat.superCategoryId || cat.superCategory?.id));
            const parentName = parentSuper ? parentSuper.name : cat.superCategory?.name || cat.type || "General";
            const parentColor = parentSuper ? parentSuper.color : cat.superCategory?.color || "#64748b";

            return (
              <div
                key={cat.id}
                className="panel"
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: cat.color || "#3b82f6", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cat.name}
                    </h4>
                    <span style={{
                      display: "inline-block",
                      marginTop: "4px",
                      padding: "2px 7px",
                      borderRadius: "5px",
                      background: `${parentColor}20`,
                      color: parentColor,
                      fontSize: "9.5px",
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                    }}>
                      📁 {parentName}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="icon-button"
                    title="Edit Category"
                    onClick={() => openEditCatModal(cat)}>
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="Delete Category"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL 1: CREATE / EDIT SUPER CATEGORY */}
      {superModalOpen && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setSuperModalOpen(false)} aria-label="Close modal" />
          <section className="modal" style={{ width: "min(480px, 95vw)", padding: "24px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderTree size={20} color="var(--green)" />
                {editingSuper ? `Edit "${editingSuper.name}"` : "Create Super Category"}
              </h3>
              <button type="button" className="icon-button" onClick={() => setSuperModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSuperCategory} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                  Super Category Name
                </label>
                <input
                  type="text"
                  value={superName}
                  onChange={(e) => setSuperName(e.target.value)}
                  placeholder="e.g. Living & Household, Lifestyle & Fun, Passive Income"
                  required
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                  Financial Accounting Nature
                </label>
                <select
                  value={superKind}
                  onChange={(e: any) => setSuperKind(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  <option value="EXPENSE">Expense (Outflows &amp; Spending)</option>
                  <option value="INCOME">Income (Earnings &amp; Inflows)</option>
                  <option value="INVESTMENT">Investment (Wealth &amp; Assets)</option>
                  <option value="TRANSFER">Internal Transfer (Balance Neutral)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                  Color Theme
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSuperColor(p)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        background: p,
                        border: superColor === p ? "3px solid var(--ink)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                      {superColor === p && <Check size={14} color="#ffffff" />}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="secondary" onClick={() => setSuperModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={superSaving} className="primary">
                  {superSaving ? "Saving..." : editingSuper ? "Save Changes" : "Create Super Category"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL 2: CREATE / EDIT CATEGORY */}
      {catModalOpen && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setCatModalOpen(false)} aria-label="Close modal" />
          <section className="modal" style={{ width: "min(480px, 95vw)", padding: "24px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)" }}>
                {editingCategory ? `Edit "${editingCategory.name}"` : "Create Category"}
              </h3>
              <button type="button" className="icon-button" onClick={() => setCatModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                  Category Name
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Subscriptions, Pet Care, Utilities"
                  required
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                  Parent Super Category
                </label>
                <select
                  value={catSuperId}
                  onChange={(e) => setCatSuperId(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  {superCategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.kind})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                  Color Theme
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCatColor(p)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: p,
                        border: catColor === p ? "3px solid var(--ink)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                      {catColor === p && <Check size={14} color="#ffffff" />}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="secondary" onClick={() => setCatModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={catSaving} className="primary">
                  {catSaving ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

