"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
  Download,
  Eye,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { portalApi } from "@/lib/portal-api";
import { formatDisplayDate } from "@/lib/date-utils";

export default function StudentHomeworkPage() {
  const [previewModalFile, setPreviewModalFile] = useState<{
    url: string;
    name: string;
    title: string;
  } | null>(null);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewModalFile) {
      setPdfBlobUrl(null);
      return;
    }

    let rawUrl = previewModalFile.url?.trim() || "";
    if (!rawUrl) return;

    if (rawUrl.startsWith("JVBERi")) {
      rawUrl = `data:application/pdf;base64,${rawUrl}`;
    }

    if (rawUrl.startsWith("data:")) {
      try {
        const parts = rawUrl.split(",");
        const base64Data = (parts[1] || parts[0]).replace(/[\r\n\s]/g, "");
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const createdBlobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(createdBlobUrl);

        return () => {
          URL.revokeObjectURL(createdBlobUrl);
        };
      } catch (err) {
        console.error("Failed to convert PDF base64 to Blob URL:", err);
        setPdfBlobUrl(rawUrl);
      }
    } else {
      setPdfBlobUrl(rawUrl);
    }
  }, [previewModalFile]);

  const { data: homeworkList = [], isLoading } = useQuery({
    queryKey: ["portal-homework"],
    queryFn: () => portalApi.getHomeworkList(),
    select: (res) => res.data,
  });

  const isImageAttachment = (url?: string | null, name?: string | null) => {
    if (!url && !name) return false;
    const lowerName = (name || "").toLowerCase();
    const lowerUrl = (url || "").toLowerCase();
    return (
      lowerUrl.startsWith("data:image/") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".webp")
    );
  };

  const isPdfFile = (url?: string | null, name?: string | null) => {
    if (!url && !name) return false;
    const lowerName = (name || "").toLowerCase();
    const lowerUrl = (url || "").toLowerCase();
    return (
      lowerUrl.includes("application/pdf") ||
      lowerUrl.endsWith(".pdf") ||
      lowerName.endsWith(".pdf") ||
      (!isImageAttachment(url, name) && !!url)
    );
  };

  const getSanitizedPdfUrl = (url?: string | null) => {
    if (!url) return "";
    let clean = url.trim();
    if (clean.startsWith("JVBERi")) {
      clean = `data:application/pdf;base64,${clean}`;
    } else if (clean.startsWith("data:")) {
      clean = clean.replace(/^data:[^;]+;base64,/, "data:application/pdf;base64,");
    }
    return clean;
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <style>{`
        .attachment-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          margin-top: 8px;
          max-width: 100%;
          flex-wrap: wrap;
        }

        .attachment-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          max-width: 240px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .attachment-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          color: var(--brand-600);
          text-decoration: none;
          padding: 4px 8px;
          background: var(--brand-50);
          border-radius: 6px;
          transition: background 0.15s ease;
        }

        .hw-image-preview-box {
          margin-top: 10px;
          position: relative;
          display: inline-block;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border-color);
          max-width: 280px;
          cursor: pointer;
        }

        .hw-image-preview-box img {
          width: 100%;
          max-height: 160px;
          object-fit: cover;
          display: block;
        }

        .image-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .image-modal-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          background: var(--card-bg);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow-xl);
          border: 1px solid var(--border-color);
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Homework Assignments</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>View tasks assigned to you by your tutor</p>
      </div>

      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading homework assignments...
        </div>
      ) : homeworkList.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {homeworkList.map((hw) => (
            <div
              key={hw.id}
              style={{
                background: "var(--card-bg)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border-color)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--brand-600)",
                    background: "var(--brand-50)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    marginBottom: 6,
                  }}
                >
                  {hw.subject}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  {hw.title}
                </h3>
                {hw.description && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, whiteSpace: "pre-wrap" }}>
                    {hw.description}
                  </p>
                )}
                {hw.due_date && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)" }}>
                    <Calendar size={13} />
                    <span>
                      Due:{" "}
                      {formatDisplayDate(hw.due_date, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}

                {hw.attachment_url && (
                  <div style={{ marginTop: 10 }}>
                    {isImageAttachment(hw.attachment_url, hw.attachment_name) ? (
                      <div>
                        <div
                          className="hw-image-preview-box"
                          onClick={() => {
                            setPreviewModalFile({
                              url: hw.attachment_url!,
                              name: hw.attachment_name || "homework_image.png",
                              title: `Homework: ${hw.title}`,
                            });
                          }}
                          title="Click to view full image"
                        >
                          <img
                            src={hw.attachment_url}
                            alt={hw.attachment_name || "Homework attachment"}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="attachment-badge">
                        <FileText size={16} style={{ color: "var(--brand-500)" }} />
                        <span className="attachment-name">
                          {hw.attachment_name || "Attached Document (PDF)"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewModalFile({
                              url: hw.attachment_url!,
                              name: hw.attachment_name || "homework_document.pdf",
                              title: `Homework: ${hw.title}`,
                            });
                          }}
                          className="attachment-link"
                          style={{ background: "none", border: "none", cursor: "pointer" }}
                        >
                          <Eye size={13} />
                          Preview PDF
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background:
                    hw.status === "completed"
                      ? "var(--success-light)"
                      : hw.status === "incomplete"
                      ? "var(--danger-light)"
                      : "var(--bg-tertiary)",
                  color:
                    hw.status === "completed"
                      ? "var(--success)"
                      : hw.status === "incomplete"
                      ? "var(--danger)"
                      : "var(--text-secondary)",
                }}
              >
                {hw.status === "completed" ? (
                  <>
                    <CheckCircle2 size={14} />
                    Completed
                  </>
                ) : hw.status === "incomplete" ? (
                  <>
                    <AlertCircle size={14} />
                    Incomplete
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    Assigned
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius)",
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "var(--bg-tertiary)",
              color: "var(--text-tertiary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <BookOpen size={24} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
            No homework assigned
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto" }}>
            Hooray! There are no homework assignments on your task board right now.
          </p>
        </div>
      )}

      {/* Document / Paper Lightbox Modal Preview */}
      {previewModalFile && (
        <div className="image-modal-overlay" onClick={() => setPreviewModalFile(null)}>
          <div
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "90vw", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid var(--border-color)",
                background: "var(--bg-tertiary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isPdfFile(previewModalFile.url, previewModalFile.name) ? (
                  <FileText size={18} style={{ color: "var(--brand-500)" }} />
                ) : (
                  <ImageIcon size={18} style={{ color: "var(--brand-500)" }} />
                )}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    {previewModalFile.title}
                  </h4>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                    {previewModalFile.name}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <a
                  href={previewModalFile.url}
                  download={previewModalFile.name}
                  className="attachment-link"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 6,
                    textDecoration: "none",
                    background: "var(--brand-500)",
                    color: "#ffffff",
                  }}
                >
                  <Download size={14} />
                  Download
                </a>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: 4,
                  }}
                  onClick={() => setPreviewModalFile(null)}
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#0b1020",
                overflow: "hidden",
                minHeight: 500,
              }}
            >
              {isPdfFile(previewModalFile.url, previewModalFile.name) ? (
                <iframe
                  src={pdfBlobUrl || getSanitizedPdfUrl(previewModalFile.url)}
                  title={previewModalFile.title}
                  style={{
                    width: "100%",
                    height: "65vh",
                    border: "none",
                    borderRadius: 6,
                    background: "#ffffff",
                  }}
                />
              ) : (
                <img
                  src={previewModalFile.url}
                  alt={previewModalFile.name}
                  style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 6 }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
