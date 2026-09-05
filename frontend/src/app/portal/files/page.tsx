"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  Download,
  Eye,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { portalApi, PortalFile } from "@/lib/portal-api";
import { formatDisplayDate } from "@/lib/date-utils";

export default function StudentFilesPage() {
  const [activeFolderCategory, setActiveFolderCategory] = useState<string | null>(null);
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

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["portal-files"],
    queryFn: () => portalApi.getFiles(),
    select: (res) => res.data,
  });

  const homeworkCount = files.filter((f) => f.category === "homework").length;
  const syllabusCount = files.filter((f) => f.category === "syllabus").length;
  const examsCount = files.filter((f) => f.category === "exams").length;
  const recommendationsCount = files.filter((f) => f.category === "recommendations").length;

  const folders = [
    {
      id: "homework",
      name: "Homework Sheets",
      count: homeworkCount,
      desc: "Assigned worksheets and tasks files",
    },
    {
      id: "syllabus",
      name: "Syllabus Documents",
      count: syllabusCount,
      desc: "Center syllabus breakdown and chapter files",
    },
    {
      id: "exams",
      name: "Exams & Papers",
      count: examsCount,
      desc: "Past mock tests, question papers and answer keys",
    },
    {
      id: "recommendations",
      name: "Counselor Recommendations",
      count: recommendationsCount,
      desc: "Weekly counselor guidelines and reports",
    },
  ];

  const filteredFiles = activeFolderCategory
    ? files.filter((f) => f.category === activeFolderCategory)
    : files;

  const isImageFile = (file: PortalFile) => {
    const lowerUrl = (file.url || "").toLowerCase();
    const lowerName = (file.name || "").toLowerCase();
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
      (!isImageFile({ url, name } as PortalFile) && !!url)
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

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <style>{`
        .folder-card {
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          border: 1.5px solid var(--border-color);
          padding: 24px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .folder-card:hover {
          border-color: var(--brand-400);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
        }

        .folder-card.active {
          border-color: var(--brand-500);
          background: var(--brand-50);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
        }

        .file-row-item {
          background: var(--card-bg);
          border-radius: 12px;
          border: 1px solid var(--border-color);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: all 0.15s ease;
        }

        .file-row-item:hover {
          border-color: var(--brand-300);
          box-shadow: var(--shadow-sm);
        }

        .paper-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--brand-600);
          background: var(--brand-50);
          border: 1px solid var(--brand-200);
          padding: 6px 12px;
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 36px;
        }

        .paper-action-btn:hover {
          background: var(--brand-100);
          color: var(--brand-700);
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

        .image-modal-content img {
          max-width: 100%;
          max-height: 80vh;
          display: block;
          object-fit: contain;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
          Resource & Files Hub
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Access all question papers, homework sheets, syllabus resources, and shared documents
        </p>
      </div>

      {/* Folder Categories Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 18,
          marginBottom: 32,
        }}
      >
        {folders.map((folder) => {
          const isSelected = activeFolderCategory === folder.id;
          return (
            <div
              key={folder.id}
              className={`folder-card ${isSelected ? "active" : ""}`}
              onClick={() =>
                setActiveFolderCategory(isSelected ? null : folder.id)
              }
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: isSelected ? "var(--brand-500)" : "var(--bg-tertiary)",
                  color: isSelected ? "white" : "var(--brand-600)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  transition: "all 0.2s ease",
                  boxShadow: isSelected ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none",
                }}
              >
                {isSelected ? <FolderOpen size={24} /> : <Folder size={24} />}
              </div>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 4,
                }}
              >
                {folder.name}
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}
              >
                {folder.desc}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: isSelected ? "var(--brand-600)" : "var(--text-tertiary)",
                }}
              >
                <span>{folder.count} files available</span>
                <ChevronRight size={16} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Toolbar / Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
            {activeFolderCategory
              ? folders.find((f) => f.id === activeFolderCategory)?.name
              : "All Shared Resources"}
          </h2>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 100,
              background: "var(--brand-50)",
              color: "var(--brand-600)",
            }}
          >
            {filteredFiles.length} {filteredFiles.length === 1 ? "File" : "Files"}
          </span>
        </div>

        {activeFolderCategory && (
          <button
            onClick={() => setActiveFolderCategory(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--brand-600)",
            }}
            type="button"
          >
            Show All Files
          </button>
        )}
      </div>

      {/* Files List Container */}
      {isLoading ? (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "48px 0",
            textAlign: "center",
            color: "var(--text-tertiary)",
          }}
        >
          Loading your study files...
        </div>
      ) : filteredFiles.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredFiles.map((file) => {
            const isImg = isImageFile(file);
            return (
              <div key={file.id} className="file-row-item">
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: isImg ? "var(--warning-light)" : "var(--brand-50)",
                      color: isImg ? "var(--warning)" : "var(--brand-600)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isImg ? <ImageIcon size={20} /> : <FileText size={20} />}
                  </div>

                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {file.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          background: "var(--bg-tertiary)",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {file.source_label}
                      </span>
                      {file.file_size && (
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          • {formatBytes(file.file_size)}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        • Shared {formatDisplayDate(file.created_at, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="paper-action-btn"
                    onClick={() => {
                      setPreviewModalFile({
                        url: file.url,
                        name: file.name,
                        title: file.name,
                      });
                    }}
                  >
                    <Eye size={14} />
                    Preview
                  </button>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={file.name}
                    className="paper-action-btn"
                    style={{ textDecoration: "none" }}
                  >
                    <Download size={14} />
                    Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
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
            <FolderOpen size={26} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            No files found in this category
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 380, margin: "0 auto" }}>
            When your teacher uploads question papers, homework worksheets, or syllabus documents, they will automatically appear here for instant download.
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
                  className="paper-action-btn"
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
