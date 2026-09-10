"use client";

import { useState, useEffect } from "react";
import { X, Eye, Edit3, Save, BookOpen, CheckCircle, FileText, Sparkles } from "lucide-react";
import { formatDisplayDate } from "@/lib/date-utils";

export interface PlanTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  field: "topics" | "actuallyTaught" | "notes" | "all";
  dateStr: string;
  initialValue: string;
  onSave?: (val: string) => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

export function PlanTextModal({
  isOpen,
  onClose,
  title,
  field,
  dateStr,
  initialValue,
  onSave,
  isSaving = false,
  readOnly = false,
}: PlanTextModalProps) {
  const isReadOnly = readOnly || !onSave;
  const [text, setText] = useState(initialValue);
  const [mode, setMode] = useState<"read" | "edit">(() => (isReadOnly ? "read" : (initialValue.trim() ? "read" : "edit")));

  useEffect(() => {
    setText(initialValue);
    setMode(isReadOnly ? "read" : (initialValue.trim() ? "read" : "edit"));
  }, [isOpen, initialValue, isReadOnly]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (onSave) {
      onSave(text);
    }
    onClose();
  };

  const getFieldIcon = () => {
    switch (field) {
      case "topics":
        return <BookOpen size={20} />;
      case "actuallyTaught":
        return <CheckCircle size={20} />;
      case "notes":
        return <FileText size={20} />;
      default:
        return <Sparkles size={20} />;
    }
  };

  return (
    <div
      className="plan-text-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="plan-text-modal-content">
        {/* Header */}
        <div className="plan-text-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="plan-text-modal-icon">{getFieldIcon()}</div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {title}
              </h3>
              <p style={{ fontSize: 12, margin: "2px 0 0", color: "var(--text-secondary)" }}>
                {formatDisplayDate(dateStr)} • Daily Academic Record
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* View Mode Toggle */}
            {!isReadOnly ? (
              <div className="modal-view-toggle">
                <button
                  type="button"
                  className={`modal-toggle-btn ${mode === "read" ? "active" : ""}`}
                  onClick={() => setMode("read")}
                >
                  <Eye size={13} />
                  <span>Reading View</span>
                </button>
                <button
                  type="button"
                  className={`modal-toggle-btn ${mode === "edit" ? "active" : ""}`}
                  onClick={() => setMode("edit")}
                >
                  <Edit3 size={13} />
                  <span>Edit View</span>
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "var(--brand-50, #e0e7ff)",
                  color: "var(--brand-700, #4338ca)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Eye size={13} />
                <span>Reading View</span>
              </div>
            )}

            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              id="plan-text-modal-close-btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="plan-text-modal-body">
          {mode === "read" ? (
            <div className="modal-reader-view">
              {text.trim() ? (
                <RenderFormattedText text={text} />
              ) : (
                <div
                  style={{
                    color: "var(--text-tertiary)",
                    fontStyle: "italic",
                    textAlign: "center",
                    padding: "36px 0",
                  }}
                >
                  <p style={{ fontSize: 14, marginBottom: 8 }}>No text recorded for this section yet.</p>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--brand-600, #4f46e5)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Click here to write details
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <textarea
              className="modal-editor-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Enter full details for ${title.toLowerCase()} here...`}
              autoFocus
              id="plan-text-modal-textarea"
            />
          )}
        </div>

        {/* Footer */}
        <div className="plan-text-modal-footer">
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 10 }}>
            <span>{text.length} characters</span>
            {!isReadOnly && mode === "edit" && <span style={{ color: "var(--brand-600)" }}>• Editing Mode</span>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                background: "var(--bg-tertiary)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Close
            </button>
            {!isReadOnly && typeof onSave === "function" && (
              <button
                type="button"
                className="btn-primary"
                disabled={isSaving}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
                }}
                onClick={handleSave}
                id="plan-text-modal-save-btn"
              >
                <Save size={14} />
                <span>{isSaving ? "Saving..." : "Save Daily Plan & Log"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenderFormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: 6 }} />;
        }
        if (trimmed === "---") {
          return (
            <hr
              key={idx}
              style={{
                border: "none",
                borderTop: "1.5px solid var(--border-color)",
                margin: "12px 0",
              }}
            />
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={idx}
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--brand-700, #4338ca)",
                margin: "10px 0 2px",
              }}
            >
              {trimmed.replace(/^###\s+/, "")}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={idx}
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: "12px 0 4px",
              }}
            >
              {trimmed.replace(/^##\s+/, "")}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1
              key={idx}
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: "14px 0 6px",
              }}
            >
              {trimmed.replace(/^#\s+/, "")}
            </h1>
          );
        }

        // Numbered lists e.g. "1. Teach Math Topic Addition"
        const isNumbered = /^\d+\.\s+/.test(trimmed);
        if (isNumbered) {
          const match = trimmed.match(/^(\d+)\.\s+(.*)/);
          const num = match ? match[1] : "•";
          const rest = match ? match[2] : trimmed;
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "8px 12px",
                background: "var(--card-bg, #ffffff)",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--brand-100, #e0e7ff)",
                  color: "var(--brand-700, #4338ca)",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {num}
              </span>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-primary)", flex: 1 }}>
                <InlineFormatting text={rest} />
              </div>
            </div>
          );
        }

        // Bullet lists e.g. "* 00-10 min: Concept"
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                paddingLeft: 6,
              }}
            >
              <span
                style={{
                  color: "var(--brand-500, #6366f1)",
                  fontSize: 18,
                  lineHeight: "18px",
                  marginTop: 2,
                }}
              >
                •
              </span>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-primary)", flex: 1 }}>
                <InlineFormatting text={trimmed.replace(/^[\*\-]\s+/, "")} />
              </div>
            </div>
          );
        }

        return (
          <p
            key={idx}
            style={{
              fontSize: 14.5,
              lineHeight: 1.65,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            <InlineFormatting text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function InlineFormatting({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} style={{ color: "var(--brand-700, #3730a3)", fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} style={{ color: "var(--text-secondary)" }}>
              {part.slice(1, -1)}
            </em>
          );
        }
        return part;
      })}
    </>
  );
}
