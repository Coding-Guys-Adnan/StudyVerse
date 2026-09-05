"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { FileText, BookOpen, Paperclip, MessageSquare, ChevronRight, ChevronDown, Download } from "lucide-react";
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
                              </div>
                            ))}
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
    </div>
  );
}
