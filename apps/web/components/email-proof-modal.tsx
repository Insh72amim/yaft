"use client";

import { Mail, X, ExternalLink } from "lucide-react";
import { money } from "@/lib/api";

export interface EmailProofData {
  accountName: string;
  accountType?: string;
  cardLast4?: string | null;
  amount: number;
  emailReference: {
    messageId?: string | null;
    subject?: string | null;
    sender?: string | null;
    date?: string | null;
    snippet?: string | null;
  };
}

export function EmailProofModal({
  data,
  onClose,
}: {
  data: EmailProofData | null;
  onClose: () => void;
}) {
  if (!data || !data.emailReference) return null;

  const { accountName, cardLast4, amount, emailReference } = data;
  const isDebit = amount < 0;

  return (
    <div
      className="modal-wrap"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        type="button"
        className="backdrop"
        onClick={onClose}
        aria-label="Close modal"
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      />
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          zIndex: 1,
          width: "min(560px, 92vw)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          background: "var(--card)",
          border: "1px solid var(--line)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--background-alt)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mail style={{ width: "18px", height: "18px" }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
                Source Email Proof
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Gmail Alert Ingestion Details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div
              style={{
                background: "var(--background-alt)",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--line)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  display: "block",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "2px",
                  fontWeight: 600,
                }}
              >
                Account
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                {accountName} {cardLast4 ? `(••••${cardLast4})` : ""}
              </span>
            </div>
            <div
              style={{
                background: "var(--background-alt)",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--line)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  display: "block",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "2px",
                  fontWeight: 600,
                }}
              >
                Amount
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: isDebit ? "#ef4444" : "#10b981",
                }}
              >
                {isDebit ? money(amount) : `+${money(amount)}`}
              </span>
            </div>
          </div>

          {emailReference.sender && (
            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "3px",
                  fontWeight: 600,
                }}
              >
                Sender
              </span>
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 500,
                  background: "var(--background-alt)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              >
                {emailReference.sender}
              </div>
            </div>
          )}

          {emailReference.subject && (
            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "3px",
                  fontWeight: 600,
                }}
              >
                Subject
              </span>
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  background: "var(--background-alt)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              >
                {emailReference.subject}
              </div>
            </div>
          )}

          {emailReference.date && (
            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "3px",
                  fontWeight: 600,
                }}
              >
                Received At
              </span>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {new Date(emailReference.date).toLocaleString("en-IN", {
                  dateStyle: "full",
                  timeStyle: "medium",
                })}
              </div>
            </div>
          )}

          {emailReference.snippet && (
            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "3px",
                  fontWeight: 600,
                }}
              >
                Parsed Email Content
              </span>
              <div
                style={{
                  fontSize: "12px",
                  lineHeight: "1.6",
                  color: "var(--ink)",
                  background: "var(--background-alt)",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "180px",
                  overflowY: "auto",
                }}
              >
                {emailReference.snippet}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--background-alt)",
          }}
        >
          {emailReference.messageId ? (
            <a
              href={`https://mail.google.com/mail/u/0/#all/${emailReference.messageId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "12px",
                color: "#3b82f6",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontWeight: 600,
              }}
            >
              Open in Gmail <ExternalLink style={{ width: "13px", height: "13px" }} />
            </a>
          ) : (
            <span />
          )}

          <button
            type="button"
            className="secondary compact"
            onClick={onClose}
            style={{
              padding: "6px 16px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "8px",
            }}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
