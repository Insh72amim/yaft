"use client";

import {
  Check,
  Download,
  Eye,
  FileImage,
  FileText,
  Loader2,
  Maximize,
  Minimize,
  MoreVertical,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { API_URL, api, downloadFile, errorMessage } from "@/lib/api";

type AccountDocument = {
  id: string;
  name: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
  byteSize: number;
  createdAt: string;
};

const MAX_FILES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

function DocumentViewer({
  accountId,
  document,
  onClose,
}: {
  accountId: string;
  document: AccountDocument;
  onClose: () => void;
}) {
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewerError, setViewerError] = useState("");
  const [scale, setScale] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isImage = document.mimeType.startsWith("image/");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    void fetch(
      `${API_URL}/accounts/${encodeURIComponent(accountId)}/documents/${encodeURIComponent(document.id)}/content`,
      { credentials: "include", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("The document could not be opened.");
        objectUrl = URL.createObjectURL(await response.blob());
        setSource(objectUrl);
      })
      .catch((reason) => {
        if ((reason as Error).name !== "AbortError") {
          setViewerError(errorMessage(reason, "The document could not be opened."));
        }
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accountId, document.id]);

  useEffect(() => {
    const previousOverflow = documentBodyOverflow();
    window.document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onFullscreenChange = () => setFullscreen(Boolean(window.document.fullscreenElement));
    window.document.addEventListener("keydown", onKeyDown);
    window.document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.document.removeEventListener("keydown", onKeyDown);
      window.document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [onClose]);

  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (window.document.fullscreenElement) void window.document.exitFullscreen();
    else void modalRef.current.requestFullscreen();
  };

  return (
    <div className="account-document-modal-wrap">
      <div className="account-document-backdrop" onClick={onClose} />
      <div
        ref={modalRef}
        className={`account-document-modal ${fullscreen ? "fullscreen" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={document.name}>
        <header className="account-document-modal-header">
          <div>
            <strong>{document.name}</strong>
            <small>
              {isImage ? "Image" : "PDF"} · {formatSize(document.byteSize)} ·{" "}
              {formatDate(document.createdAt)}
            </small>
          </div>
          <div className="account-document-modal-actions">
            {isImage && (
              <>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => setScale((current) => Math.min(3, current + 0.25))}
                  title="Zoom in">
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => setScale((current) => Math.max(0.5, current - 0.25))}
                  title="Zoom out">
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => setScale(1)}
                  title="Reset zoom">
                  <RotateCcw size={15} />
                </button>
              </>
            )}
            <button
              type="button"
              className="secondary compact"
              onClick={toggleFullscreen}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              className="ghost compact account-document-close"
              onClick={onClose}
              title="Close viewer">
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="account-document-viewer-body">
          {loading ? (
            <div className="account-document-viewer-state">
              <Loader2 className="spin" size={24} />
              <span>Opening document…</span>
            </div>
          ) : viewerError ? (
            <div className="account-document-viewer-state error">
              <p>{viewerError}</p>
            </div>
          ) : isImage ? (
            <div className="account-document-image-stage">
              <img
                src={source}
                alt={document.name}
                style={{ transform: `scale(${scale})` }}
              />
            </div>
          ) : (
            <iframe
              src={source}
              title={document.name}
              className="account-document-frame"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function documentBodyOverflow(): string {
  return window.document.body.style.overflow;
}

export function AccountDocuments({
  accountId,
}: {
  accountId: string;
}) {
  const [documents, setDocuments] = useState<AccountDocument[]>([]);
  const [selected, setSelected] = useState<AccountDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameName, setRenameName] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [reuploadingId, setReuploadingId] = useState("");
  const [reuploadTargetDoc, setReuploadTargetDoc] = useState<AccountDocument | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const triggerReupload = (item: AccountDocument) => {
    setReuploadTargetDoc(item);
    reuploadInputRef.current?.click();
  };

  const handleReupload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !reuploadTargetDoc) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("The replacement document must be 8 MB or smaller.");
      return;
    }
    const form = new FormData();
    form.append("document", file);
    setReuploadingId(reuploadTargetDoc.id);
    setError("");
    try {
      const updated = await api<AccountDocument>(
        `/accounts/${accountId}/documents/${reuploadTargetDoc.id}/reupload`,
        { method: "POST", body: form },
      );
      setDocuments((current) => current.map((d) => (d.id === updated.id ? updated : d)));
    } catch (reason) {
      setError(errorMessage(reason, "Could not reupload document file."));
    } finally {
      setReuploadingId("");
      setReuploadTargetDoc(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setError("");
      setDocuments(await api<AccountDocument[]>(`/accounts/${accountId}/documents`));
    } catch (reason) {
      setError(errorMessage(reason, "Could not load account documents."));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length > MAX_FILES) {
      setError(`Choose up to ${MAX_FILES} documents at a time.`);
      return;
    }
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      setError("Each document must be 8 MB or smaller.");
      return;
    }
    const form = new FormData();
    files.forEach((file) => form.append("documents", file));
    setUploading(true);
    setError("");
    try {
      await api<AccountDocument[]>(`/accounts/${accountId}/documents`, { method: "POST", body: form });
      await load();
    } catch (reason) {
      setError(errorMessage(reason, "Could not upload the selected documents."));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (item: AccountDocument) => {
    if (!window.confirm("Remove this document from the account? This cannot be undone.")) return;
    setDeletingId(item.id);
    setError("");
    try {
      await api<void>(`/accounts/${accountId}/documents/${item.id}`, { method: "DELETE" });
      if (selected?.id === item.id) setSelected(null);
      setDocuments((current) => current.filter((document) => document.id !== item.id));
    } catch (reason) {
      setError(errorMessage(reason, "Could not remove the document."));
    } finally {
      setDeletingId("");
    }
  };

  const download = async (item: AccountDocument) => {
    setDownloadingId(item.id);
    setError("");
    try {
      await downloadFile(
        `/accounts/${accountId}/documents/${item.id}/download`,
        item.name,
      );
    } catch (reason) {
      setError(errorMessage(reason, "Could not download the document."));
    } finally {
      setDownloadingId("");
    }
  };

  const startRename = (item: AccountDocument) => {
    setRenamingId(item.id);
    setRenameName(item.name);
    setError("");
  };

  const cancelRename = () => {
    setRenamingId("");
    setRenameName("");
  };

  const handleSaveRename = async (item: AccountDocument) => {
    if (!renameName.trim()) return setError("Document name cannot be empty.");
    setSavingRename(true);
    setError("");
    try {
      const updated = await api<AccountDocument>(`/accounts/${accountId}/documents/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameName.trim() }),
      });
      setDocuments((current) => current.map((d) => (d.id === item.id ? { ...d, name: updated.name } : d)));
      setRenamingId("");
      setRenameName("");
    } catch (reason) {
      setError(errorMessage(reason, "Could not rename document."));
    } finally {
      setSavingRename(false);
    }
  };

  return (
      <section className="panel account-documents-panel account-documents-page" aria-labelledby="account-documents-heading">
        <header>
          <div>
            <span className="eyebrow">Account files</span>
            <h2 id="account-documents-heading">Documents</h2>
            <p>Keep agreements, statements, and supporting images with this account.</p>
          </div>
          <div className="account-documents-header-actions">
            <button type="button" className="secondary compact" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="spin" size={15} /> : <Upload size={15} />}
              {uploading ? "Uploading…" : "Add documents"}
            </button>
            <input
              ref={inputRef}
              className="account-document-input"
              type="file"
              accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
              multiple
              onChange={(event) => void upload(event)}
              tabIndex={-1}
            />
            <input
              ref={reuploadInputRef}
              className="account-document-input"
              type="file"
              accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
              onChange={(event) => void handleReupload(event)}
              tabIndex={-1}
              style={{ display: "none" }}
            />
          </div>
        </header>
        {error && <p className="error account-documents-error" role="alert">{error}</p>}
        {loading ? (
          <div className="account-documents-empty"><Loader2 className="spin" size={22} /><span>Loading documents…</span></div>
        ) : documents.length ? (
          <div className="account-document-list" style={{ overflow: "visible" }}>
            {documents.map((item, index) => {
              const isImage = item.mimeType.startsWith("image/");
              const isRenaming = renamingId === item.id;
              const isMenuOpen = menuOpenId === item.id;
              const openUpward = index >= documents.length - 2;

              return (
                <article key={item.id} className="account-document-row" style={{ position: "relative", zIndex: isMenuOpen ? 50 : 1 }}>
                  <span className={`account-document-icon ${isImage ? "image" : "pdf"}`}>
                    {isImage ? <FileImage size={19} /> : <FileText size={19} />}
                  </span>
                  <div className="account-document-meta" style={{ flex: 1 }}>
                    {isRenaming ? (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input
                          type="text"
                          value={renameName}
                          onChange={(e) => setRenameName(e.target.value)}
                          style={{ fontSize: "13px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--background)", color: "var(--ink)", width: "100%", maxWidth: "300px" }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveRename(item);
                            if (e.key === "Escape") cancelRename();
                          }}
                        />
                        <button type="button" className="secondary compact" disabled={savingRename} onClick={() => void handleSaveRename(item)} title="Save name">
                          {savingRename ? <Loader2 className="spin" size={13} /> : <Check size={13} />}
                        </button>
                        <button type="button" className="ghost compact" disabled={savingRename} onClick={cancelRename} title="Cancel">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <strong title={item.name}>{item.name}</strong>
                        <small>{isImage ? "Image" : "PDF"} · {formatSize(item.byteSize)} · {formatDate(item.createdAt)}</small>
                      </>
                    )}
                  </div>
                  <div className="account-document-actions" style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px" }}>
                    <button type="button" className="secondary compact" onClick={() => setSelected(item)}>
                      <Eye size={14} /> View
                    </button>
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(isMenuOpen ? null : item.id);
                      }}
                      aria-label="More options"
                      style={{ padding: "6px 8px", borderRadius: "8px" }}>
                      <MoreVertical size={16} />
                    </button>
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: openUpward ? "auto" : "calc(100% + 4px)",
                          bottom: openUpward ? "calc(100% + 4px)" : "auto",
                          zIndex: 100,
                          background: "var(--card)",
                          border: "1px solid var(--line)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
                          padding: "6px",
                          minWidth: "160px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}>
                        <button
                          type="button"
                          className="ghost compact"
                          disabled={downloadingId === item.id}
                          onClick={() => {
                            setMenuOpenId(null);
                            void download(item);
                          }}
                          style={{ justifyContent: "flex-start", padding: "8px 12px", fontSize: "12px", width: "100%", gap: "8px", color: "var(--ink)" }}>
                          {downloadingId === item.id ? <Loader2 className="spin" size={14} /> : <Download size={14} />} Download
                        </button>
                        <button
                          type="button"
                          className="ghost compact"
                          onClick={() => {
                            setMenuOpenId(null);
                            startRename(item);
                          }}
                          style={{ justifyContent: "flex-start", padding: "8px 12px", fontSize: "12px", width: "100%", gap: "8px", color: "var(--ink)" }}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          className="ghost compact"
                          disabled={reuploadingId === item.id}
                          onClick={() => {
                            setMenuOpenId(null);
                            triggerReupload(item);
                          }}
                          style={{ justifyContent: "flex-start", padding: "8px 12px", fontSize: "12px", width: "100%", gap: "8px", color: "var(--ink)" }}>
                          {reuploadingId === item.id ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />} ReUpload
                        </button>
                        <div style={{ height: "1px", background: "var(--line)", margin: "3px 0" }} />
                        <button
                          type="button"
                          className="ghost compact"
                          disabled={deletingId === item.id}
                          onClick={() => {
                            setMenuOpenId(null);
                            void remove(item);
                          }}
                          style={{ justifyContent: "flex-start", padding: "8px 12px", fontSize: "12px", width: "100%", gap: "8px", color: "#ef4444" }}>
                          {deletingId === item.id ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="account-documents-empty">
            <FileText size={27} strokeWidth={1.5} />
            <div><strong>No documents yet</strong><span>Add PDFs or images without leaving the account.</span></div>
          </div>
        )}
        {selected && <DocumentViewer accountId={accountId} document={selected} onClose={() => setSelected(null)} />}
      </section>
  );
}
