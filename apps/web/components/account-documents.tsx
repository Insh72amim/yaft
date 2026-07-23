"use client";

import {
  Download,
  Eye,
  FileImage,
  FileText,
  Loader2,
  Maximize,
  Minimize,
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
    <div className="modal-wrap account-document-viewer-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close document viewer" />
      <div
        ref={modalRef}
        className={`modal account-document-viewer ${fullscreen ? "fullscreen" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-document-viewer-title">
        <header className="account-document-viewer-header">
          <div className="account-document-viewer-title">
            <span>{isImage ? <FileImage size={18} /> : <FileText size={18} />}</span>
            <div>
              <strong id="account-document-viewer-title">{document.name}</strong>
              <small>{formatSize(document.byteSize)} · Added {formatDate(document.createdAt)}</small>
            </div>
          </div>
          <div className="account-document-viewer-controls">
            <button type="button" onClick={() => setScale((value) => Math.max(0.5, value - 0.25))} disabled={scale <= 0.5} aria-label="Zoom out">
              <ZoomOut size={16} />
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button type="button" onClick={() => setScale((value) => Math.min(2.5, value + 0.25))} disabled={scale >= 2.5} aria-label="Zoom in">
              <ZoomIn size={16} />
            </button>
            <button type="button" onClick={() => setScale(1)} disabled={scale === 1} aria-label="Reset zoom">
              <RotateCcw size={15} />
            </button>
            <i />
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Open fullscreen"}>
              {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button ref={closeButtonRef} type="button" className="viewer-close" onClick={onClose} aria-label="Close document viewer">
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="account-document-viewer-body">
          {loading && (
            <div className="account-document-viewer-status">
              <Loader2 className="spin" size={30} />
              <span>Opening document…</span>
            </div>
          )}
          {viewerError && (
            <div className="account-document-viewer-status error-state" role="alert">
              <FileText size={30} />
              <strong>Unable to open this document</strong>
              <span>{viewerError}</span>
            </div>
          )}
          {source && (
            <div className="account-document-viewport">
              {isImage ? (
                <img
                  src={source}
                  alt={document.name}
                  style={{ width: `${scale * 100}%` }}
                />
              ) : (
                <div
                  className="account-document-pdf-scale"
                  style={{
                    width: `${scale * 100}%`,
                    height: `${scale * 100}%`,
                    margin: scale <= 1 ? "0 auto" : 0,
                  }}>
                  <iframe
                    src={`${source}#toolbar=0`}
                    title={document.name}
                    style={{
                      width: `${100 / scale}%`,
                      height: `${100 / scale}%`,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function documentBodyOverflow() {
  return typeof window === "undefined" ? "" : window.document.body.style.overflow;
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
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
          </div>
        </header>
        {error && <p className="error account-documents-error" role="alert">{error}</p>}
        {loading ? (
          <div className="account-documents-empty"><Loader2 className="spin" size={22} /><span>Loading documents…</span></div>
        ) : documents.length ? (
          <div className="account-document-list">
            {documents.map((item) => {
              const isImage = item.mimeType.startsWith("image/");
              return (
                <article key={item.id} className="account-document-row">
                  <span className={`account-document-icon ${isImage ? "image" : "pdf"}`}>
                    {isImage ? <FileImage size={19} /> : <FileText size={19} />}
                  </span>
                  <div className="account-document-meta">
                    <strong title={item.name}>{item.name}</strong>
                    <small>{isImage ? "Image" : "PDF"} · {formatSize(item.byteSize)} · {formatDate(item.createdAt)}</small>
                  </div>
                  <div className="account-document-actions">
                    <button type="button" className="secondary compact" onClick={() => setSelected(item)}>
                      <Eye size={14} /> View
                    </button>
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => void download(item)}
                      disabled={downloadingId === item.id}>
                      {downloadingId === item.id ? <Loader2 className="spin" size={14} /> : <Download size={14} />}
                      Download
                    </button>
                    <button
                      type="button"
                      className="account-document-delete"
                      onClick={() => void remove(item)}
                      disabled={deletingId === item.id}
                      aria-label={`Remove ${item.name}`}>
                      {deletingId === item.id ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
                    </button>
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
