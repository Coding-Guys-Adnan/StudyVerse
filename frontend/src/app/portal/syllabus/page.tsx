"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  FileText,
  BookOpen,
  Paperclip,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Download,
  Plus,
  Trash2,
  X,
  Upload,
} from "lucide-react";
import { portalApi, type Syllabus } from "@/lib/portal-api";
import { getFileUrl } from "@/lib/api";
import { SyllabusExportModal } from "@/components/student/syllabus-export-modal";

const TYPE_MAP: Record<string, { label: string; icon: string; bg: string; color: string; border: string }> = {
  story: { label: "Story", icon: "📖", bg: "rgba(16, 185, 129, 0.14)", color: "#10b981", border: "rgba(16, 185, 129, 0.35)" },
  poem: { label: "Poem", icon: "🎭", bg: "rgba(168, 85, 247, 0.14)", color: "#a855f7", border: "rgba(168, 85, 247, 0.35)" },
  chapter: { label: "Chapter", icon: "📘", bg: "rgba(59, 130, 246, 0.14)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.35)" },
  grammar: { label: "Grammar", icon: "✏️", bg: "rgba(245, 158, 11, 0.14)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.35)" },
  other: { label: "Other", icon: "📌", bg: "rgba(244, 63, 94, 0.14)", color: "#f43f5e", border: "rgba(244, 63, 94, 0.35)" },
};

const TERM_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  "SEM1": { label: "SEM1", bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
  "SEM2": { label: "SEM2", bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd" },
  "UNIT TEST I": { label: "UT I", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  "UNIT TEST II": { label: "UT II", bg: "#fdf4ff", color: "#c026d3", border: "#f5d0fe" },
  "UNIT TEST III": { label: "UT III", bg: "#fdf2f8", color: "#db2777", border: "#fbcfe8" },
  "CLASS TEST": { label: "CLASS TEST", bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" },
};

export default function StudentSyllabusPage() {
  const queryClient = useQueryClient();
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [newSubject, setNewSubject] = useState("");
  const [newChapter, setNewChapter] = useState("");
  const [newChapterType, setNewChapterType] = useState("chapter");
  const [newTerm, setNewTerm] = useState("SEM1");

  // Inline items state
  const [addingItemChapterId, setAddingItemChapterId] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const { data: permData } = useQuery({
    queryKey: ["portal-permissions"],
    queryFn: () => portalApi.getPermissions(),
    select: (res) => res.data,
  });

  const canEdit = !!permData?.effective_permissions?.syllabus?.can_edit;
  const canImport = !!permData?.effective_permissions?.syllabus?.can_import;

  const { data: profile } = useQuery({
    queryKey: ["portal-profile"],
    queryFn: () => portalApi.getProfile(),
    select: (res) => res.data,
  });

  const { data: syllabusList = [], isLoading } = useQuery({
    queryKey: ["portal-syllabus"],
    queryFn: () => portalApi.getSyllabusList(),
    select: (res) => res.data,
  });

  const addSyllabusMutation = useMutation({
    mutationFn: (data: { subject: string; chapter: string; chapter_type: string; term: string }) =>
      portalApi.createSyllabus({
        subject: data.subject,
        chapter: data.chapter,
        chapter_type: data.chapter_type,
        term: data.term,
        status: "pending",
        progress: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
      setShowAddModal(false);
      setNewSubject("");
      setNewChapter("");
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ chapterId, text }: { chapterId: string; text: string }) =>
      portalApi.createChecklistItem(chapterId, { text, completed: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
      setAddingItemChapterId(null);
      setNewItemText("");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => portalApi.deleteChecklistItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
    },
  });

  const deleteSyllabusMutation = useMutation({
    mutationFn: (syllabusId: string) => portalApi.deleteSyllabus(syllabusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
    },
  });

  const toggleExpand = (syllabusId: string) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [syllabusId]: !prev[syllabusId],
    }));
  };

  const handleToggleItem = async (itemId: string, currentStatus: boolean) => {
    try {
      await portalApi.toggleChecklistItem(itemId, !currentStatus);
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
    } catch (err) {
      console.error("Failed to toggle item", err);
    }
  };

  // Group and calculate metrics
  const groupedSyllabus = useMemo(() => {
    const groups: Record<string, Syllabus[]> = {};
    syllabusList.forEach((item) => {
      groups[item.subject] = groups[item.subject] || [];
      groups[item.subject].push(item);
    });
    return groups;
  }, [syllabusList]);

  const subjectProgress = useMemo(() => {
    const progress: Record<string, number> = {};
    Object.entries(groupedSyllabus).forEach(([subj, items]) => {
      const total = items.reduce((acc, curr) => acc + curr.progress, 0);
      progress[subj] = Math.round(total / items.length);
    });
    return progress;
  }, [groupedSyllabus]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Syllabus Tracker</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Track study checklist, completion progress, teacher notes, and file attachments</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm, 8px)",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
              }}
            >
              <Plus size={15} /> Add Topic
            </button>
          )}

          {syllabusList.length > 0 && (
            <button
              onClick={() => setShowExportModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm, 8px)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              id="student-export-syllabus-btn"
            >
              <Download size={15} style={{ color: "var(--brand-600)" }} />
              Export Syllabus
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading syllabus tracker...
        </div>
      ) : Object.keys(groupedSyllabus).length > 0 ? (
        Object.entries(groupedSyllabus).map(([subj, items]) => {
          const overallProgress = subjectProgress[subj] || 0;
          return (
            <div
              key={subj}
              style={{
                background: "var(--card-bg)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border-color)",
                marginBottom: 24,
                overflow: "hidden",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "16px 20px",
                  background: "var(--bg-tertiary)",
                  borderBottom: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BookOpen size={16} style={{ color: "var(--brand-500)" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{subj}</h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  <span>Overall: {overallProgress}%</span>
                  <div style={{ width: 100, height: 6, background: "var(--border-color)", borderRadius: 100, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--brand-500)", width: `${overallProgress}%` }} />
                  </div>
                </div>
              </div>

              {/* Chapters List */}
              {items.map((syllabusItem) => {
                const chapterObj = syllabusItem.chapters && syllabusItem.chapters.length > 0 ? syllabusItem.chapters[0] : null;
                const chapterTitle = chapterObj?.title || syllabusItem.chapter;
                const checklistItems = chapterObj?.checklist_items || [];
                const notes = chapterObj?.notes || [];
                const isExpanded = !!expandedChapters[syllabusItem.id];

                return (
                  <div
                    key={syllabusItem.id}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    {/* Collapsible Chapter Row */}
                    <div
                      style={{
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => toggleExpand(syllabusItem.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 16 }}>📖</span>
                        <h4 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                          {chapterTitle}
                        </h4>

                        {/* Colorful Type Badge */}
                        {(() => {
                          const typeObj = syllabusItem.chapter_type ? TYPE_MAP[syllabusItem.chapter_type] : null;
                          if (!typeObj) return null;
                          return (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: typeObj.bg,
                                color: typeObj.color,
                                border: `1px solid ${typeObj.border}`,
                              }}
                            >
                              <span>{typeObj.icon}</span>
                              <span>{typeObj.label}</span>
                            </span>
                          );
                        })()}

                        {/* Colorful Term/SEM Badges */}
                        {(() => {
                          if (!syllabusItem.term) return null;
                          const terms = syllabusItem.term.split(", ").filter(Boolean);
                          return terms.map((tVal) => {
                            const termObj = TERM_MAP[tVal] || {
                              label: tVal,
                              bg: "var(--brand-50)",
                              color: "var(--brand-600)",
                              border: "var(--brand-200)",
                            };
                            return (
                              <span
                                key={tVal}
                                style={{
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  background: termObj.bg,
                                  color: termObj.color,
                                  border: `1px solid ${termObj.border}`,
                                  letterSpacing: "0.02em",
                                }}
                              >
                                {termObj.label}
                              </span>
                            );
                          });
                        })()}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            textTransform: "capitalize",
                            background:
                              syllabusItem.status === "completed"
                                ? "var(--success-light)"
                                : syllabusItem.status === "teaching"
                                ? "var(--info-light)"
                                : syllabusItem.status === "revision"
                                ? "var(--warning-light)"
                                : "var(--bg-tertiary)",
                            color:
                              syllabusItem.status === "completed"
                                ? "var(--success)"
                                : syllabusItem.status === "teaching"
                                ? "var(--info)"
                                : "var(--warning)",
                          }}
                        >
                          {syllabusItem.status}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", minWidth: 32 }}>
                          {syllabusItem.progress}%
                        </span>
                        <div style={{ color: "var(--text-tertiary)", display: "flex", alignItems: "center" }}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{ padding: "0 20px 20px 20px", borderTop: "1px dashed var(--border-color)", background: "var(--bg-secondary)" }}>
                        {/* Checklist Items */}
                        {checklistItems.length > 0 && (
                          <div
                            style={{
                              background: "var(--card-bg)",
                              borderRadius: 8,
                              padding: "14px 16px",
                              border: "1px solid var(--border-color)",
                              marginTop: 16,
                            }}
                          >
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 10 }}>
                              Study Checklist ({checklistItems.filter((i) => i.completed).length}/{checklistItems.length})
                            </div>
                            {checklistItems.map((cItem) => (
                              <div
                                key={cItem.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  padding: "8px 0",
                                  borderBottom: "1px dashed var(--border-color)",
                                  minHeight: 44,
                                }}
                              >
                                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={cItem.completed}
                                    onChange={() => handleToggleItem(cItem.id, cItem.completed)}
                                    style={{ accentColor: "var(--brand-500)", width: 18, height: 18, cursor: "pointer" }}
                                  />
                                  <span
                                    style={{
                                      fontSize: 13.5,
                                      fontWeight: 500,
                                      color: cItem.completed ? "var(--text-tertiary)" : "var(--text-primary)",
                                      textDecoration: cItem.completed ? "line-through" : "none",
                                    }}
                                  >
                                    {cItem.text}
                                  </span>
                                </label>

                                {cItem.attachments && cItem.attachments.map((att) => (
                                  <a
                                    key={att.id}
                                    href={getFileUrl(att.stored_path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      background: "var(--brand-50)",
                                      color: "var(--brand-600)",
                                      border: "1px solid var(--brand-200)",
                                      padding: "4px 10px",
                                      borderRadius: 6,
                                      textDecoration: "none",
                                      minHeight: 32,
                                    }}
                                  >
                                    <Paperclip size={11} /> {att.filename}
                                  </a>
                                ))}

                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm("Delete this checklist item?")) {
                                        deleteItemMutation.mutate(cItem.id);
                                      }
                                    }}
                                    title="Delete checklist item"
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#ef4444",
                                      cursor: "pointer",
                                      padding: "4px 6px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            ))}

                            {canEdit && chapterObj && (
                              <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px dashed var(--border-color)" }}>
                                {addingItemChapterId === chapterObj.id ? (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      if (newItemText.trim()) {
                                        addItemMutation.mutate({ chapterId: chapterObj.id, text: newItemText.trim() });
                                      }
                                    }}
                                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                                  >
                                    <input
                                      autoFocus
                                      placeholder="New checklist item..."
                                      value={newItemText}
                                      onChange={(e) => setNewItemText(e.target.value)}
                                      style={{
                                        flex: 1,
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid var(--border-color)",
                                        background: "var(--bg-tertiary)",
                                        fontSize: 12.5,
                                        color: "var(--text-primary)",
                                      }}
                                    />
                                    <button
                                      type="submit"
                                      disabled={addItemMutation.isPending}
                                      style={{
                                        padding: "6px 12px",
                                        borderRadius: 6,
                                        border: "none",
                                        background: "var(--brand-500)",
                                        color: "#fff",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingItemChapterId(null);
                                        setNewItemText("");
                                      }}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid var(--border-color)",
                                        background: "transparent",
                                        color: "var(--text-secondary)",
                                        fontSize: 12,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddingItemChapterId(chapterObj.id);
                                      setNewItemText("");
                                    }}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "5px 10px",
                                      borderRadius: 6,
                                      border: "1px dashed var(--border-color)",
                                      background: "transparent",
                                      color: "var(--brand-600)",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Plus size={13} /> Add Checklist Item
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Teacher Notes */}
                        {notes.length > 0 && (
                          <div
                            style={{
                              marginTop: 16,
                              background: "var(--card-bg)",
                              border: "1px solid var(--border-color)",
                              borderRadius: 8,
                              padding: "14px 16px",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                              <MessageSquare size={13} style={{ color: "var(--brand-600)" }} /> Teacher Note
                            </div>
                            {notes.map((n) => (
                              <div key={n.id} style={{ background: "var(--bg-tertiary)", padding: 10, borderRadius: 6, border: "1px solid var(--border-color)", marginBottom: 8 }}>
                                <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text-primary)", fontStyle: "italic", fontSize: 13 }}>
                                  &ldquo;{n.text}&rdquo;
                                </p>
                                {n.attachments && n.attachments.length > 0 && (
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                    {n.attachments.map((att) => (
                                      <a
                                        key={att.id}
                                        href={getFileUrl(att.stored_path)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          fontSize: 11.5,
                                          fontWeight: 600,
                                          background: "var(--brand-50)",
                                          color: "var(--brand-600)",
                                          border: "1px solid var(--brand-200)",
                                          padding: "4px 10px",
                                          borderRadius: 6,
                                          textDecoration: "none",
                                          minHeight: 32,
                                        }}
                                      >
                                        <Paperclip size={11} /> {att.filename}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
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
            <FileText size={24} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
            No syllabus chapters logged
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto" }}>
            Your tutor has not configured your syllabus checklists yet.
          </p>
        </div>
      )}

      {/* Export Syllabus Modal */}
      <SyllabusExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        syllabusList={syllabusList}
        studentName={profile?.name || "Student"}
      />

      {/* Add Topic Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: "var(--card-bg, #fff)",
              borderRadius: "var(--radius, 12px)",
              border: "1px solid var(--border-color, #e2e8f0)",
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Add Syllabus Topic</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSubject.trim() || !newChapter.trim()) return;
                addSyllabusMutation.mutate({
                  subject: newSubject.trim(),
                  chapter: newChapter.trim(),
                  chapter_type: newChapterType,
                  term: newTerm,
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Subject *
                </label>
                <input
                  required
                  placeholder="e.g. Mathematics, Science"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Chapter / Topic Title *
                </label>
                <input
                  required
                  placeholder="e.g. Quadratic Equations"
                  value={newChapter}
                  onChange={(e) => setNewChapter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                    Category
                  </label>
                  <select
                    value={newChapterType}
                    onChange={(e) => setNewChapterType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="chapter">Chapter</option>
                    <option value="story">Story</option>
                    <option value="poem">Poem</option>
                    <option value="grammar">Grammar</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                    Term / Exam
                  </label>
                  <select
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="SEM1">SEM1</option>
                    <option value="SEM2">SEM2</option>
                    <option value="UNIT TEST I">UT I</option>
                    <option value="UNIT TEST II">UT II</option>
                    <option value="UNIT TEST III">UT III</option>
                    <option value="CLASS TEST">Class Test</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSyllabusMutation.isPending}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--brand-500, #4f46e5)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {addSyllabusMutation.isPending ? "Adding..." : "Add Topic"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
