"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Trash2,
  Calendar,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Eye,
} from "lucide-react";
import { academicApi } from "@/lib/academic-api";
import { getFileUrl } from "@/lib/api";
import { formatDisplayDate } from "@/lib/date-utils";

interface HomeworkTabProps {
  studentId: string;
}

export function HomeworkTab({ studentId }: HomeworkTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  // File Attachment State
  const [attachmentName, setAttachmentName] = useState<string>("");
  const [attachmentUrl, setAttachmentUrl] = useState<string>("");
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // ─── Query ──────────────────────────────────────────────
  const { data: homeworkList = [], isLoading } = useQuery({
    queryKey: ["homework", studentId],
    queryFn: () => academicApi.getHomeworkList(studentId),
    select: (res) => res.data,
  });

  // ─── Mutations ──────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: () =>
      academicApi.addHomework(studentId, {
        subject,
        title,
        description: description || undefined,
        due_date: dueDate || undefined,
        status: "assigned",
        attachment_name: attachmentName || undefined,
        attachment_url: attachmentUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setShowAddForm(false);
      resetForm();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ hwId, status }: { hwId: string; status: "assigned" | "completed" | "incomplete" }) =>
      academicApi.updateHomework(studentId, hwId, { status }),
    onMutate: async ({ hwId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["homework", studentId] });
      const previous = queryClient.getQueryData(["homework", studentId]);
      queryClient.setQueryData(["homework", studentId], (old: any) => {
        if (!old) return old;
        const updater = (items: any[]) => items.map((h) => (h.id === hwId ? { ...h, status } : h));
        if (Array.isArray(old)) return updater(old);
        if (old.data && Array.isArray(old.data)) return { ...old, data: updater(old.data) };
        return old;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["homework", studentId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["homework", studentId] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (hwId: string) => academicApi.deleteHomework(studentId, hwId),
    onMutate: async (hwId) => {
      await queryClient.cancelQueries({ queryKey: ["homework", studentId] });
      const previous = queryClient.getQueryData(["homework", studentId]);
      queryClient.setQueryData(["homework", studentId], (old: any) => {
        if (!old) return old;
        const updater = (items: any[]) => items.filter((h) => h.id !== hwId);
        if (Array.isArray(old)) return updater(old);
        if (old.data && Array.isArray(old.data)) return { ...old, data: updater(old.data) };
        return old;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["homework", studentId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["homework", studentId] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const resetForm = () => {
    setSubject("");
    setTitle("");
    setDescription("");
    setDueDate("");
    setAttachmentName("");
    setAttachmentUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File is too large! Please select a file smaller than 15MB.");
      return;
    }

    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAttachmentUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

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

  const handleOpenDocument = (url: string, name?: string | null) => {
    let rawUrl = url?.trim() || "";
    if (rawUrl.includes("data:")) {
      rawUrl = rawUrl.substring(rawUrl.indexOf("data:"));
      try {
        const parts = rawUrl.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "application/pdf";
        const b64Data = (parts[1] || parts[0]).replace(/[\r\n\s]/g, "");
        const binaryStr = atob(b64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        return;
      } catch {
        // Fallback
      }
    }
    window.open(getFileUrl(rawUrl), "_blank");
  };

  return (
    <div className="homework-tab">
      <style>{`
        .homework-tab {
          width: 100%;
        }

        .tab-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .tab-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .hw-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .hw-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          padding: 18px 22px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          transition: all 0.15s ease;
          flex-wrap: wrap;
        }

        .hw-card:hover {
          box-shadow: var(--shadow-sm);
          border-color: var(--brand-300);
        }

        .hw-info {
          flex: 1;
          min-width: 240px;
        }

        .hw-subject-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--brand-600);
          background: var(--brand-50);
          padding: 3px 10px;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .hw-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px;
          line-height: 1.4;
        }

        .hw-desc {
          font-size: 13.5px;
          color: var(--text-secondary);
          margin-bottom: 12px;
          white-space: pre-wrap;
          line-height: 1.5;
        }

        .hw-due-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: var(--text-tertiary);
          margin-bottom: 10px;
        }

        .attachment-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          margin-top: 6px;
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

        .hw-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-toggle {
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
          min-height: 38px;
        }

        .status-toggle.completed {
          background: var(--success-light);
          color: var(--success);
        }

        .status-toggle.assigned {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .status-toggle.incomplete {
          background: var(--danger-light);
          color: var(--danger);
        }

        .card-action-btn {
          padding: 8px;
          background: none;
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-tertiary);
          transition: all 0.15s ease;
          min-width: 36px;
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-action-btn.danger:hover {
          color: var(--danger);
          background: var(--danger-light);
        }

        .add-hw-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1.5px solid var(--border-color);
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-sm);
        }

        @media (max-width: 480px) {
          .add-hw-card {
            padding: 16px;
          }
        }

        .add-hw-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .add-hw-header h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .file-upload-container {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-sm);
          padding: 14px 16px;
          background: var(--bg-tertiary);
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .file-upload-btn-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: var(--card-bg);
          border: 1.5px solid var(--border-color);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 38px;
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

      <div className="tab-header">
        <h2>Homework Assignments</h2>
        {!showAddForm && (
          <button className="add-btn" onClick={() => setShowAddForm(true)} id="add-homework-btn">
            <Plus size={16} />
            Assign Homework
          </button>
        )}
      </div>

      {/* ─── Add Homework Form ─── */}
      {showAddForm && (
        <div className="add-hw-card">
          <div className="add-hw-header">
            <h3>Assign New Homework</h3>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
            >
              <X size={20} />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
          >
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="hw-subject">
                  Subject *
                </label>
                <input
                  id="hw-subject"
                  className="form-input"
                  placeholder="e.g. Mathematics, Science, English"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="hw-due-date">
                  Due Date
                </label>
                <input
                  id="hw-due-date"
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hw-title">
                Topic / Title *
              </label>
              <input
                id="hw-title"
                className="form-input"
                placeholder="e.g. Solve Exercise 4.2 Problems 1 to 5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hw-desc">
                Instructions / Details
              </label>
              <textarea
                id="hw-desc"
                className="notes-textarea"
                placeholder="List problems, guidelines, or instructions for the student..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* ─── File Attachment Section ─── */}
            <div className="form-group">
              <label className="form-label">
                Attachment (PDF, JPG, or PNG Image)
              </label>
              <div className="file-upload-container">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Paperclip size={18} style={{ color: "var(--brand-600)" }} />
                  {attachmentName ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)" }}>
                      {isImageAttachment(attachmentUrl, attachmentName) ? (
                        <ImageIcon size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                      <span>{attachmentName}</span>
                      <button
                        type="button"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--danger)",
                          display: "inline-flex",
                          marginLeft: 4,
                        }}
                        onClick={() => {
                          setAttachmentName("");
                          setAttachmentUrl("");
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        title="Remove attachment"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Attach a worksheet, question paper, or photo (PDF, JPG, PNG)
                    </span>
                  )}
                </div>

                <label className="file-upload-btn-label" htmlFor="hw-file-input">
                  <Paperclip size={14} />
                  {attachmentName ? "Change File" : "Choose File"}
                </label>
                <input
                  id="hw-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf, .png, .jpg, .jpeg, image/png, image/jpeg, application/pdf"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={addMutation.isPending || !subject || !title}
                id="submit-homework-btn"
              >
                {addMutation.isPending ? "Assigning..." : "Assign Homework"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Homework List ─── */}
      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading homework assignments...
        </div>
      ) : homeworkList.length > 0 ? (
        <div className="hw-list">
          {homeworkList.map((hw) => (
            <div key={hw.id} className="hw-card" id={`hw-card-${hw.id}`}>
              <div className="hw-info">
                <span className="hw-subject-badge">{hw.subject}</span>
                <h3 className="hw-title">{hw.title}</h3>
                {hw.description && <p className="hw-desc">{hw.description}</p>}

                {hw.due_date && (
                  <div className="hw-due-row">
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
                          onClick={() => setPreviewModalImage(getFileUrl(hw.attachment_url!) || null)}
                          title="Click to view full image"
                        >
                          <img
                            src={getFileUrl(hw.attachment_url)}
                            alt={hw.attachment_name || "Homework attachment"}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="attachment-badge">
                        <FileText size={16} style={{ color: "var(--danger)" }} />
                        <span className="attachment-name">
                          {hw.attachment_name || "Attached Document (PDF)"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(hw.attachment_url!, hw.attachment_name)}
                          className="attachment-link"
                          style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <ExternalLink size={13} />
                          View Document
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="hw-actions">
                <button
                  className={`status-toggle ${hw.status}`}
                  onClick={() => {
                    const nextStatus =
                      hw.status === "assigned"
                        ? "completed"
                        : hw.status === "completed"
                        ? "incomplete"
                        : "assigned";
                    toggleStatusMutation.mutate({ hwId: hw.id, status: nextStatus });
                  }}
                  title="Toggle Completion Status"
                  id={`hw-status-${hw.id}`}
                  type="button"
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
                </button>
                <button
                  className="card-action-btn danger"
                  onClick={() => deleteMutation.mutate(hw.id)}
                  title="Delete Homework"
                  id={`hw-delete-${hw.id}`}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
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
            Assign worksheets, PDF documents, or photo exercises. Students can access them in their portal.
          </p>
        </div>
      )}

      {/* Image Modal Lightbox */}
      {previewModalImage && (
        <div className="image-modal-overlay" onClick={() => setPreviewModalImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-color)",
                background: "var(--bg-tertiary)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Attachment Preview
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={previewModalImage}
                  download="homework_attachment"
                  className="attachment-link"
                  style={{ fontSize: 12 }}
                >
                  <Download size={13} />
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
                  onClick={() => setPreviewModalImage(null)}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: 16, display: "flex", justifyContent: "center", background: "#0b1020" }}>
              <img src={previewModalImage} alt="Full preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
