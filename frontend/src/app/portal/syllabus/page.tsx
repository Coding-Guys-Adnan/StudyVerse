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
  ListPlus,
  Sparkles,
  AlertCircle,
  Check,
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

  // Modal & form states
  const [modalMode, setModalMode] = useState<"single" | "multiple">("single");
  const [multiInputMode, setMultiInputMode] = useState<"paste" | "rows">("paste");
  const [newSubject, setNewSubject] = useState("");
  const [newChapter, setNewChapter] = useState("");
  const [newChapterType, setNewChapterType] = useState("chapter");
  const [newTerm, setNewTerm] = useState("SEM1");
  const [bulkChaptersText, setBulkChaptersText] = useState("");
  const [dynamicChapterRows, setDynamicChapterRows] = useState<string[]>(["", "", ""]);
  const [formError, setFormError] = useState("");

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

  // Unique list of existing subjects for autocomplete & quick chips
  const existingSubjects = useMemo(() => {
    const list: string[] = [];
    syllabusList.forEach((s) => {
      if (s.subject && !list.includes(s.subject)) {
        list.push(s.subject);
      }
    });
    return list;
  }, [syllabusList]);

  // Parse chapters from paste text or dynamic rows
  const parsedMultipleChapters = useMemo(() => {
    if (multiInputMode === "paste") {
      const lines = bulkChaptersText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 1 && lines[0].includes(",")) {
        return lines[0].split(",").map((c) => c.trim()).filter(Boolean);
      }
      return lines;
    } else {
      return dynamicChapterRows.map((c) => c.trim()).filter(Boolean);
    }
  }, [bulkChaptersText, dynamicChapterRows, multiInputMode]);

  const openAddModal = (initialSubject: string = "", mode: "single" | "multiple" = "single") => {
    setNewSubject(initialSubject);
    setModalMode(mode);
    setFormError("");
    setShowAddModal(true);
  };

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
      setFormError("");
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || "Failed to add topic. Please try again.");
    },
  });

  const addBulkSyllabusMutation = useMutation({
    mutationFn: (items: { subject: string; chapter: string; chapter_type: string; term: string }[]) =>
      portalApi.createSyllabusBulk(
        items.map((item, idx) => ({
          subject: item.subject,
          chapter: item.chapter,
          chapter_type: item.chapter_type,
          term: item.term,
          status: "pending",
          progress: 0,
          sort_order: idx,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
      setShowAddModal(false);
      setNewSubject("");
      setNewChapter("");
      setBulkChaptersText("");
      setDynamicChapterRows(["", "", ""]);
      setFormError("");
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || "Failed to add multiple chapters. Please try again.");
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

  const updatePortalSyllabusCache = (updater: (prev: Syllabus[]) => Syllabus[]) => {
    queryClient.setQueryData(["portal-syllabus"], (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) return updater(old);
      if (old.data && Array.isArray(old.data)) {
        return { ...old, data: updater(old.data) };
      }
      return old;
    });
  };

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => portalApi.deleteChecklistItem(itemId),
    onMutate: (itemId) => {
      updatePortalSyllabusCache((prev) =>
        prev.map((s) => ({
          ...s,
          chapters: s.chapters?.map((ch) => ({
            ...ch,
            checklist_items: ch.checklist_items?.filter((it) => it.id !== itemId),
          })),
        }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
    },
  });

  const deleteSyllabusMutation = useMutation({
    mutationFn: (syllabusId: string) => portalApi.deleteSyllabus(syllabusId),
    onMutate: (syllabusId) => {
      updatePortalSyllabusCache((prev) => prev.filter((s) => s.id !== syllabusId));
    },
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

  const handleToggleItem = async (syllabusId: string, chapterId: string, itemId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    updatePortalSyllabusCache((prev) =>
      prev.map((s) => {
        if (s.id !== syllabusId) return s;
        const updatedChapters = s.chapters?.map((ch) => {
          if (chapterId && ch.id !== chapterId) return ch;
          const updatedItems = ch.checklist_items?.map((it) =>
            it.id === itemId ? { ...it, completed: nextStatus } : it
          ) || [];
          return { ...ch, checklist_items: updatedItems };
        }) || [];

        const allItems = updatedChapters.flatMap((c) => c.checklist_items || []);
        const total = allItems.length;
        const completed = allItems.filter((i) => i.completed).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : s.progress;
        const status = progress === 100 ? "completed" : progress > 0 ? "teaching" : "pending";

        return {
          ...s,
          progress,
          status,
          chapters: updatedChapters,
        };
      })
    );

    try {
      await portalApi.toggleChecklistItem(itemId, nextStatus);
    } catch (err) {
      console.error("Failed to toggle item", err);
      queryClient.invalidateQueries({ queryKey: ["portal-syllabus"] });
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => openAddModal("", "single")}
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
                id="student-add-topic-btn"
              >
                <Plus size={15} /> Add Topic
              </button>
              <button
                onClick={() => openAddModal("", "multiple")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm, 8px)",
                  background: "var(--card-bg, #fff)",
                  color: "var(--brand-600, #4f46e5)",
                  border: "1px solid var(--brand-300, #a5b4fc)",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(99, 102, 241, 0.08)",
                }}
                id="student-bulk-chapters-btn"
              >
                <ListPlus size={15} /> Add Multiple Chapters
              </button>
            </div>
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
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openAddModal(subj, "multiple")}
                      title={`Add multiple chapters to ${subj}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        borderRadius: 6,
                        background: "var(--card-bg, #fff)",
                        color: "var(--brand-600, #4f46e5)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Plus size={13} /> Add Chapters
                    </button>
                  )}
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
                                    onChange={() => handleToggleItem(syllabusItem.id, chapterObj?.id || "", cItem.id, cItem.completed)}
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

      {/* Add Topic / Multiple Chapters Modal */}
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
              maxWidth: modalMode === "multiple" ? 540 : 460,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
              transition: "max-width 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                  {modalMode === "multiple" ? "Add Multiple Chapters" : "Add Syllabus Topic"}
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
                  {modalMode === "multiple"
                    ? "Add multiple chapters or topics at once to your syllabus"
                    : "Add an individual chapter or study topic"}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div
              style={{
                display: "flex",
                background: "var(--bg-tertiary, #f8fafc)",
                borderRadius: 8,
                padding: 3,
                marginBottom: 16,
                border: "1px solid var(--border-color, #e2e8f0)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setModalMode("single");
                  setFormError("");
                }}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: modalMode === "single" ? "var(--card-bg, #fff)" : "transparent",
                  color: modalMode === "single" ? "var(--text-primary)" : "var(--text-secondary)",
                  boxShadow: modalMode === "single" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Single Topic
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode("multiple");
                  setFormError("");
                }}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: modalMode === "multiple" ? "var(--card-bg, #fff)" : "transparent",
                  color: modalMode === "multiple" ? "var(--brand-600, #4f46e5)" : "var(--text-secondary)",
                  boxShadow: modalMode === "multiple" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <ListPlus size={14} />
                <span>Multiple Chapters</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "rgba(99, 102, 241, 0.1)",
                    color: "var(--brand-600, #4f46e5)",
                    fontWeight: 700,
                  }}
                >
                  Bulk
                </span>
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#ef4444",
                  fontSize: 12.5,
                  marginBottom: 14,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{formError}</span>
              </div>
            )}

            {modalMode === "single" ? (
              /* Single Chapter Form */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError("");
                  if (!newSubject.trim()) {
                    setFormError("Please enter a subject name.");
                    return;
                  }
                  if (!newChapter.trim()) {
                    setFormError("Please enter a chapter title.");
                    return;
                  }
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Subject *
                    </label>
                    {existingSubjects.length > 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Select or type new</span>
                    )}
                  </div>
                  <input
                    required
                    list="syllabus-subject-options"
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
                  <datalist id="syllabus-subject-options">
                    {existingSubjects.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>

                  {existingSubjects.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {existingSubjects.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewSubject(s)}
                          style={{
                            background: newSubject === s ? "var(--brand-50, #eff6ff)" : "var(--bg-tertiary)",
                            border: newSubject === s ? "1px solid var(--brand-300, #93c5fd)" : "1px solid var(--border-color)",
                            color: newSubject === s ? "var(--brand-600, #2563eb)" : "var(--text-secondary)",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
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
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Tip: Want to add multiple chapters at once? Switch to <strong>Multiple Chapters</strong> above.
                  </span>
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
            ) : (
              /* Multiple Chapters Bulk Form */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError("");
                  if (!newSubject.trim()) {
                    setFormError("Please enter or select a subject name.");
                    return;
                  }
                  if (parsedMultipleChapters.length === 0) {
                    setFormError("Please enter at least one chapter name.");
                    return;
                  }
                  const items = parsedMultipleChapters.map((ch) => ({
                    subject: newSubject.trim(),
                    chapter: ch,
                    chapter_type: newChapterType,
                    term: newTerm,
                  }));
                  addBulkSyllabusMutation.mutate(items);
                }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {/* Subject Selector */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Subject *
                    </label>
                    {existingSubjects.length > 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Select or type new</span>
                    )}
                  </div>
                  <input
                    required
                    list="bulk-syllabus-subject-options"
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
                  <datalist id="bulk-syllabus-subject-options">
                    {existingSubjects.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>

                  {existingSubjects.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {existingSubjects.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewSubject(s)}
                          style={{
                            background: newSubject === s ? "var(--brand-50, #eff6ff)" : "var(--bg-tertiary)",
                            border: newSubject === s ? "1px solid var(--brand-300, #93c5fd)" : "1px solid var(--border-color)",
                            color: newSubject === s ? "var(--brand-600, #2563eb)" : "var(--text-secondary)",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sub-mode selector: Paste list vs Rows */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Chapters / Topics to Add *
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setMultiInputMode("paste")}
                        style={{
                          background: multiInputMode === "paste" ? "var(--card-bg)" : "transparent",
                          border: multiInputMode === "paste" ? "1px solid var(--border-color)" : "none",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          color: multiInputMode === "paste" ? "var(--brand-600, #4f46e5)" : "var(--text-tertiary)",
                          cursor: "pointer",
                        }}
                      >
                        Paste List
                      </button>
                      <button
                        type="button"
                        onClick={() => setMultiInputMode("rows")}
                        style={{
                          background: multiInputMode === "rows" ? "var(--card-bg)" : "transparent",
                          border: multiInputMode === "rows" ? "1px solid var(--border-color)" : "none",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          color: multiInputMode === "rows" ? "var(--brand-600, #4f46e5)" : "var(--text-tertiary)",
                          cursor: "pointer",
                        }}
                      >
                        Row by Row
                      </button>
                    </div>
                  </div>

                  {multiInputMode === "paste" ? (
                    <div>
                      <textarea
                        rows={5}
                        placeholder={`Chapter 1: Real Numbers\nChapter 2: Polynomials\nChapter 3: Linear Equations\nChapter 4: Quadratic Equations`}
                        value={bulkChaptersText}
                        onChange={(e) => setBulkChaptersText(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                          fontSize: 13,
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                          resize: "vertical",
                        }}
                      />
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                        Enter or paste chapters. One chapter per line (or separated by commas).
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {dynamicChapterRows.map((rowVal, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", minWidth: 20 }}>
                            {idx + 1}.
                          </span>
                          <input
                            placeholder={`e.g. Chapter ${idx + 1} title`}
                            value={rowVal}
                            onChange={(e) => {
                              const copy = [...dynamicChapterRows];
                              copy[idx] = e.target.value;
                              setDynamicChapterRows(copy);
                            }}
                            style={{
                              flex: 1,
                              padding: "7px 10px",
                              borderRadius: 6,
                              border: "1px solid var(--border-color)",
                              background: "var(--bg-tertiary)",
                              color: "var(--text-primary)",
                              fontSize: 13,
                              boxSizing: "border-box",
                            }}
                          />
                          {dynamicChapterRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDynamicChapterRows(dynamicChapterRows.filter((_, i) => i !== idx))}
                              title="Delete row"
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--text-tertiary)",
                                cursor: "pointer",
                                padding: 4,
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => setDynamicChapterRows([...dynamicChapterRows, ""])}
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "1px dashed var(--border-color)",
                            background: "transparent",
                            color: "var(--brand-600, #4f46e5)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Plus size={13} /> Add Row
                        </button>
                        <button
                          type="button"
                          onClick={() => setDynamicChapterRows([...dynamicChapterRows, "", "", ""])}
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid var(--border-color)",
                            background: "transparent",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                          }}
                        >
                          +3 Rows
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Common Category & Term for all new chapters */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                      Category (for all)
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
                      Term / Exam (for all)
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

                {/* Live Preview of parsed chapters */}
                {parsedMultipleChapters.length > 0 && (
                  <div
                    style={{
                      background: "rgba(99, 102, 241, 0.05)",
                      border: "1px solid rgba(99, 102, 241, 0.18)",
                      borderRadius: 8,
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--brand-600, #4f46e5)", marginBottom: 6 }}>
                      <Sparkles size={14} />
                      <span>{parsedMultipleChapters.length} chapter{parsedMultipleChapters.length === 1 ? "" : "s"} detected:</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {parsedMultipleChapters.slice(0, 5).map((ch, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "var(--card-bg, #fff)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {i + 1}. {ch}
                        </span>
                      ))}
                      {parsedMultipleChapters.length > 5 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "var(--bg-tertiary)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          +{parsedMultipleChapters.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Modal Actions */}
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
                    disabled={addBulkSyllabusMutation.isPending || parsedMultipleChapters.length === 0 || !newSubject.trim()}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        parsedMultipleChapters.length === 0 || !newSubject.trim()
                          ? "var(--border-color)"
                          : "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor:
                        parsedMultipleChapters.length === 0 || !newSubject.trim() || addBulkSyllabusMutation.isPending
                          ? "not-allowed"
                          : "pointer",
                      boxShadow:
                        parsedMultipleChapters.length > 0 && newSubject.trim()
                          ? "0 4px 12px rgba(79, 70, 229, 0.25)"
                          : "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ListPlus size={15} />
                    {addBulkSyllabusMutation.isPending
                      ? `Adding ${parsedMultipleChapters.length} Chapters...`
                      : `Add ${parsedMultipleChapters.length > 0 ? parsedMultipleChapters.length : ""} Chapter${parsedMultipleChapters.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
