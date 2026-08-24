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
  Tag,
  ArrowRight,
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
  const [superKind, setSuperKind] = useState<"EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER" | "OTHER">("EXPENSE");
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
    if (!confirm(`Are you sure you want to delete super category "${name}"? Child categories will remain safe.`)) return;
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

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>("ALL");

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "EXPENSE":
        return { bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444", label: "Expense" };
      case "INCOME":
        return { bg: "rgba(16, 185, 129, 0.1)", color: "#10b981", label: "Income" };
      case "INVESTMENT":
        return { bg: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6", label: "Investment" };
      case "TRANSFER":
        return { bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", label: "Transfer" };
      case "OTHER":
        return { bg: "rgba(100, 116, 139, 0.1)", color: "#64748b", label: "Others" };
      default:
        return { bg: "rgba(100, 116, 139, 0.1)", color: "#64748b", label: kind };
    }
  };

  const openCreateCatForSuperModal = (superId: string) => {
    setEditingCategory(null);
    setCatName("");
    setCatSuperId(superId);
    setCatColor("#3b82f6");
    setError("");
    setCatModalOpen(true);
  };

  // Group categories under their super category
  const filteredSuperCategories = superCategories
    .filter((s) => {
      if (activeTypeFilter !== "ALL" && s.kind !== activeTypeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const superMatches = s.name.toLowerCase().includes(q);
      const childMatches = categories.some(
        (c) => (c.superCategoryId || c.superCategory?.id) === s.id && c.name.toLowerCase().includes(q)
      );
      return superMatches || childMatches;
    })
    .map((s) => {
      let childCats = categories.filter((c) => (c.superCategoryId || c.superCategory?.id) === s.id);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        // If super matches, show all, otherwise filter children
        if (!s.name.toLowerCase().includes(q)) {
          childCats = childCats.filter((c) => c.name.toLowerCase().includes(q));
        }
      }
      return {
        ...s,
        childCategories: childCats,
      };
    });

  const unassignedCategories = categories.filter((c) => {
    const isUnassigned = !c.superCategoryId && !c.superCategory?.id;
    if (!isUnassigned) return false;
    if (!searchQuery.trim()) return true;
    return c.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "24px" }}>
      {/* Top Header & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              Financial Taxonomy
            </h3>
            <span style={{ padding: "2px 8px", borderRadius: "100px", background: "var(--background-alt)", border: "1px solid var(--line)", fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>
              {superCategories.length} Super &bull; {categories.length} Categories
            </span>
          </div>
          <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
            Parent super-groups and granular transaction categories.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Quick Search */}
          <div style={{ position: "relative", minWidth: "180px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter categories..."
              style={{
                height: "34px",
                padding: "0 28px 0 10px",
                fontSize: "12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--background-alt)",
                color: "var(--ink)",
                width: "100%",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  padding: 0,
                  display: "grid",
                  placeItems: "center",
                }}>
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="secondary compact"
            onClick={openCreateSuperModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "12px",
            }}>
            <FolderTree size={13} color="var(--green)" />
            <span>+ Super Group</span>
          </button>

          <button
            type="button"
            className="primary compact"
            onClick={openCreateCatModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "12px",
            }}>
            <Plus size={14} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#ef4444", padding: "10px 14px", borderRadius: "10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>⚠️</span> {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#10b981", padding: "10px 14px", borderRadius: "10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Check size={14} /> {successMsg}
        </div>
      )}

      {/* Type Filter Tabs */}
      <div style={{ display: "flex", gap: "5px", background: "var(--background-alt)", padding: "3px", borderRadius: "10px", border: "1px solid var(--line)", width: "fit-content", flexWrap: "wrap" }}>
        {[
          { key: "ALL", label: `All (${categories.length})` },
          { key: "EXPENSE", label: "Expense" },
          { key: "INCOME", label: "Income" },
          { key: "INVESTMENT", label: "Investment" },
          { key: "TRANSFER", label: "Transfer" },
          { key: "OTHER", label: "Others" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`secondary compact ${activeTypeFilter === tab.key ? "active" : ""}`}
            onClick={() => setActiveTypeFilter(tab.key)}
            style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grouped Taxonomy Cards Grid */}
      <div className="taxonomy-grid">
        {filteredSuperCategories.map((s) => {
          const kindBadge = getKindBadge(s.kind);
          const themeColor = s.color || "#3b82f6";
          const count = s.childCategories.length;

          return (
            <div key={s.id} className="taxonomy-card" style={{ borderLeft: `3px solid ${themeColor}` }}>
              {/* Header */}
              <div className="taxonomy-card-header">
                <div className="taxonomy-card-title-wrap">
                  <h4 className="taxonomy-card-title">{s.name}</h4>
                  <span style={{ padding: "1px 6px", borderRadius: "5px", background: kindBadge.bg, color: kindBadge.color, fontSize: "10px", fontWeight: 800 }}>
                    {kindBadge.label}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                    ({count})
                  </span>
                </div>

                <div className="taxonomy-card-actions">
                  <button
                    type="button"
                    title="Edit super group"
                    onClick={() => openEditSuperModal(s)}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      background: "var(--background-alt)",
                      color: "var(--ink)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}>
                    <Pencil size={11} />
                  </button>
                  <button
                    type="button"
                    title="Delete super group"
                    onClick={() => handleDeleteSuperCategory(s.id, s.name)}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      background: "rgba(239, 68, 68, 0.06)",
                      color: "#ef4444",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* Child Sub-Categories as Clean Chips */}
              <div className="taxonomy-chip-list">
                {s.childCategories.map((cat) => {
                  const dotColor = cat.color || "#3b82f6";
                  return (
                    <div
                      key={cat.id}
                      className="cat-pill"
                      onClick={() => openEditCatModal(cat)}
                      title={`Click to edit ${cat.name}`}>
                      <span className="cat-pill-dot" style={{ background: dotColor }} />
                      <span>{cat.name}</span>
                      <div className="cat-pill-actions">
                        <button
                          type="button"
                          className="cat-pill-btn"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCatModal(cat);
                          }}>
                          <Pencil size={9} />
                        </button>
                        <button
                          type="button"
                          className="cat-pill-btn delete"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(cat.id, cat.name);
                          }}>
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="cat-pill-add"
                  onClick={() => openCreateCatForSuperModal(s.id)}>
                  <Plus size={11} />
                  <span>Sub-category</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Unassigned / General Categories if any exist */}
        {unassignedCategories.length > 0 && (
          <div className="taxonomy-card" style={{ borderLeft: "3px solid var(--muted)" }}>
            <div className="taxonomy-card-header">
              <div className="taxonomy-card-title-wrap">
                <h4 className="taxonomy-card-title">General / Unassigned</h4>
                <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                  ({unassignedCategories.length})
                </span>
              </div>
            </div>

            <div className="taxonomy-chip-list">
              {unassignedCategories.map((cat) => {
                const dotColor = cat.color || "#3b82f6";
                return (
                  <div
                    key={cat.id}
                    className="cat-pill"
                    onClick={() => openEditCatModal(cat)}
                    title={`Click to edit ${cat.name}`}>
                    <span className="cat-pill-dot" style={{ background: dotColor }} />
                    <span>{cat.name}</span>
                    <div className="cat-pill-actions">
                      <button
                        type="button"
                        className="cat-pill-btn"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCatModal(cat);
                        }}>
                        <Pencil size={9} />
                      </button>
                      <button
                        type="button"
                        className="cat-pill-btn delete"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(cat.id, cat.name);
                        }}>
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE / EDIT SUPER CATEGORY */}
      {superModalOpen && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setSuperModalOpen(false)} aria-label="Close modal" />
          <section className="modal" style={{ width: "min(480px, 95vw)", padding: "26px", borderRadius: "16px", background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(184, 91, 53, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FolderTree size={18} color="var(--green)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)" }}>
                    {editingSuper ? `Edit "${editingSuper.name}"` : "New Super Category"}
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    High-level parent group for your categories
                  </p>
                </div>
              </div>
              <button type="button" className="icon-button" onClick={() => setSuperModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSuperCategory} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
                  Super Category Name
                </label>
                <input
                  type="text"
                  value={superName}
                  onChange={(e) => setSuperName(e.target.value)}
                  placeholder="e.g. Living & Household, Lifestyle & Fun, Subscriptions"
                  required
                  style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 14px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
                  Financial Accounting Nature
                </label>
                <select
                  value={superKind}
                  onChange={(e: any) => setSuperKind(e.target.value)}
                  style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 14px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  <option value="EXPENSE">Expense (Outflows &amp; Spending)</option>
                  <option value="INCOME">Income (Earnings &amp; Inflows)</option>
                  <option value="INVESTMENT">Investment (Wealth &amp; Assets)</option>
                  <option value="TRANSFER">Internal Transfer (Balance Neutral)</option>
                  <option value="OTHER">Others (General &amp; Unclassified)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                  Theme Accent Color
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSuperColor(p)}
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "8px",
                        background: p,
                        border: superColor === p ? "3px solid var(--ink)" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform 0.1s ease",
                      }}>
                      {superColor === p && <Check size={14} color="#ffffff" />}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
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
          <section className="modal" style={{ width: "min(480px, 95vw)", padding: "26px", borderRadius: "16px", background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(184, 91, 53, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Tag size={18} color="var(--green)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)" }}>
                    {editingCategory ? `Edit "${editingCategory.name}"` : "New Category"}
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Granular classification for transactions
                  </p>
                </div>
              </div>
              <button type="button" className="icon-button" onClick={() => setCatModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
                  Category Name
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Subscriptions, Pet Care, Utilities"
                  required
                  style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 14px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
                  Parent Super Category
                </label>
                <select
                  value={catSuperId}
                  onChange={(e) => setCatSuperId(e.target.value)}
                  style={{ width: "100%", height: "42px", fontSize: "13px", padding: "0 14px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  {superCategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.kind})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                  Category Color Dot
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCatColor(p)}
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: p,
                        border: catColor === p ? "3px solid var(--ink)" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform 0.1s ease",
                      }}>
                      {catColor === p && <Check size={14} color="#ffffff" />}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
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


