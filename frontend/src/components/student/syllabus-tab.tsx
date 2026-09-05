"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Trash2,
  BookOpen,
  Upload,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Pencil,
  Paperclip,
  Check,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Download,
} from "lucide-react";
import { getFileUrl } from "@/lib/api";
import {
  academicApi,
  type Syllabus,
  type SyllabusChapter,
  type ChecklistItem,
  type ChapterNote,
  type SyllabusAttachment,
} from "@/lib/academic-api";
import { SyllabusExportModal } from "./syllabus-export-modal";

interface SyllabusTabProps {
  studentId: string;
  studentName?: string;
}

export interface TypeOption {
  id: string;
  label: string;
  icon: string;
  colorClass: string;
}

export interface TermOption {
  id: string;
  label: string;
  shortLabel: string;
  colorClass: string;
}

export const TYPE_OPTIONS: TypeOption[] = [
  { id: "story", label: "Story", icon: "📖", colorClass: "type-story" },
  { id: "poem", label: "Poem", icon: "🎭", colorClass: "type-poem" },
  { id: "chapter", label: "Chapter", icon: "📘", colorClass: "type-chapter" },
  { id: "grammar", label: "Grammar", icon: "✏️", colorClass: "type-grammar" },
  { id: "other", label: "Other", icon: "📌", colorClass: "type-other" },
];

export const TERM_OPTIONS_CONFIG: TermOption[] = [
  { id: "SEM1", label: "SEM1", shortLabel: "SEM1", colorClass: "term-sem1" },
  { id: "SEM2", label: "SEM2", shortLabel: "SEM2", colorClass: "term-sem2" },
  { id: "UNIT TEST I", label: "UNIT TEST I", shortLabel: "UT I", colorClass: "term-ut1" },
  { id: "UNIT TEST II", label: "UNIT TEST II", shortLabel: "UT II", colorClass: "term-ut2" },
  { id: "UNIT TEST III", label: "UNIT TEST III", shortLabel: "UT III", colorClass: "term-ut3" },
  { id: "CLASS TEST", label: "CLASS TEST", shortLabel: "CT", colorClass: "term-classtest" },
];

const TERM_OPTIONS = TERM_OPTIONS_CONFIG.map((t) => t.id);

function getTermDisplayText(term: string | null | undefined): string {
  if (!term || !term.trim()) return "— Term —";
  const parts = term.split(", ").filter(Boolean);
  if (parts.length === 0) return "— Term —";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;
  return `${parts[0]} (+${parts.length - 1})`;
}

export function SyllabusTab({ studentId, studentName }: SyllabusTabProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [addMode, setAddMode] = useState<"textarea" | "dynamic">("textarea");

  // Form State
  const [subject, setSubject] = useState("");
  const [chaptersText, setChaptersText] = useState("");
  const [dynamicChapters, setDynamicChapters] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);

  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");

  // Collapsible Chapters State (collapsed by default)
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Type & Term Popover States
  const [openTypePopoverId, setOpenTypePopoverId] = useState<string | null>(null);
  const [openTermPopoverId, setOpenTermPopoverId] = useState<string | null>(null);

  // Inline Editing States
  const [editingSubject, setEditingSubject] = useState<{ original: string; current: string } | null>(null);
  const [editingSyllabusId, setEditingSyllabusId] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // New Item / New Note inline forms visibility & input values
  const [showAddItemForm, setShowAddItemForm] = useState<Record<string, boolean>>({});
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});

  const [showAddNoteForm, setShowAddNoteForm] = useState<Record<string, boolean>>({});
  const [newNoteText, setNewNoteText] = useState<Record<string, string>>({});

  // ─── Query ──────────────────────────────────────────────
  const { data: syllabusList = [], isLoading, refetch } = useQuery({
    queryKey: ["syllabus", studentId],
    queryFn: () => academicApi.getSyllabusList(studentId),
    select: (res) => res.data,
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: ["syllabus-documents", studentId],
    queryFn: () => academicApi.getSyllabusDocuments(studentId),
    select: (res) => res.data,
  });

  const invalidateSyllabus = async () => {
    await queryClient.invalidateQueries({ queryKey: ["syllabus", studentId] });
    await refetch();
  };

  const toggleExpand = (syllabusId: string) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [syllabusId]: !prev[syllabusId],
    }));
  };

  const resetForm = () => {
    setSubject("");
    setChaptersText("");
    setDynamicChapters(["", ""]);
  };

  // ─── Demo Template Download ─────────────────────────────
  const handleDownloadDemoTemplate = () => {
    const csvContent = `Subject,Chapter Name,Chapter Type
Mathematics,Real Numbers & Polynomials,chapter
Mathematics,Pair of Linear Equations,chapter
Mathematics,Quadratic Equations,chapter
English Literature,The Haunted House,story
English Literature,When Great Trees Fall,poem
English Literature,Tenses and Modals,grammar
Science,Chemical Reactions and Equations,chapter
Science,Light Reflection and Refraction,chapter`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "syllabus_demo_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Import Syllabus File ──────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");
    setUploadSuccessMsg("");

    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

        const chaptersToAdd: { subject: string; chapter: string; chapter_type?: string }[] = [];
        let defaultSubject = "General";
        const validTypes = ["story", "poem", "chapter", "grammar", "other"];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (
            i === 0 &&
            (line.toLowerCase().includes("subject") || line.toLowerCase().includes("chapter"))
          ) {
            continue;
          }

          if (line.includes(",")) {
            const parts = line.split(",").map((p) => p.trim());
            const subj = parts[0];
            const chap = parts[1] || "";
            const chType = parts[2]?.toLowerCase() || "";
            if (chap) {
              chaptersToAdd.push({
                subject: subj || defaultSubject,
                chapter: chap,
                chapter_type: validTypes.includes(chType) ? chType : undefined,
              });
            }
          } else if (line.includes(":")) {
            const parts = line.split(":");
            const subj = parts[0].trim();
            const chap = parts.slice(1).join(":").trim();
            if (chap) {
              chaptersToAdd.push({ subject: subj || defaultSubject, chapter: chap });
            }
          } else {
            chaptersToAdd.push({ subject: defaultSubject, chapter: line });
          }
        }

        if (chaptersToAdd.length === 0) {
          setUploadError("No valid chapters found in the selected file.");
          setUploading(false);
          return;
        }

        for (let i = 0; i < chaptersToAdd.length; i++) {
          const item = chaptersToAdd[i];
          await academicApi.addSyllabus(studentId, {
            subject: item.subject,
            chapter: item.chapter,
            chapter_type: item.chapter_type || null,
            status: "pending",
            progress: 0,
            sort_order: i,
          });
        }

        invalidateSyllabus();
        setUploadSuccessMsg(`Successfully imported ${chaptersToAdd.length} chapters from ${file.name}!`);
      } else {
        const res = await academicApi.uploadSyllabusDocument(studentId, file);
        refetchDocs();
        const extracted = res.data.extracted_chapters;
        if (extracted && extracted.length > 0) {
          for (let i = 0; i < extracted.length; i++) {
            const ch = extracted[i];
            await academicApi.addSyllabus(studentId, {
              subject: ch.subject,
              chapter: ch.chapter,
              status: "pending",
              progress: 0,
              sort_order: i,
            });
          }
          invalidateSyllabus();
          setUploadSuccessMsg(`Extracted & added ${extracted.length} chapters from ${file.name}!`);
        } else {
          setUploadSuccessMsg(`Uploaded document ${file.name}.`);
        }
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || "Failed to parse syllabus file.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ─── Bulk Manual Chapter Addition ───────────────────────
  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    let chaptersList: string[] = [];

    if (addMode === "textarea") {
      chaptersList = chaptersText
        .split(/\r?\n/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
    } else {
      chaptersList = dynamicChapters.map((c) => c.trim()).filter((c) => c.length > 0);
    }

    if (chaptersList.length === 0) {
      alert("Please enter at least one chapter name!");
      return;
    }

    setSubmitting(true);
    try {
      for (let i = 0; i < chaptersList.length; i++) {
        await academicApi.addSyllabus(studentId, {
          subject: subject.trim(),
          chapter: chaptersList[i],
          status: "pending",
          progress: 0,
          sort_order: i,
        });
      }
      invalidateSyllabus();
      setShowAddForm(false);
      resetForm();
    } catch (err) {
      alert("Failed to add chapters.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Update Subject Heading ─────────────────────────────
  const handleSaveSubject = async () => {
    if (!editingSubject || !editingSubject.current.trim()) {
      setEditingSubject(null);
      return;
    }
    const { original, current } = editingSubject;
    if (original === current) {
      setEditingSubject(null);
      return;
    }

    const itemsToUpdate = syllabusList.filter((s) => s.subject === original);
    try {
      await Promise.all(
        itemsToUpdate.map((s) =>
          academicApi.updateSyllabus(studentId, s.id, { subject: current.trim() })
        )
      );
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to update subject name.");
    } finally {
      setEditingSubject(null);
    }
  };

  // ─── Update Chapter Title ───────────────────────────────
  const handleSaveChapterTitle = async (syllabusId: string, chapterObj?: SyllabusChapter | null) => {
    if (!editingChapterTitle.trim()) {
      setEditingSyllabusId(null);
      return;
    }
    try {
      if (chapterObj) {
        await academicApi.updateSyllabusChapter(studentId, chapterObj.id, {
          title: editingChapterTitle.trim(),
        });
      }
      await academicApi.updateSyllabus(studentId, syllabusId, {
        chapter: editingChapterTitle.trim(),
      });
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to update chapter title.");
    } finally {
      setEditingSyllabusId(null);
    }
  };

  // ─── Checklist Item Mutations & Actions ────────────────
  const handleAddChecklistItem = async (targetId: string) => {
    const text = newItemText[targetId]?.trim();
    if (!text) return;

    try {
      await academicApi.createChecklistItem(studentId, targetId, { text, completed: false });
      setNewItemText((prev) => ({ ...prev, [targetId]: "" }));
      setShowAddItemForm((prev) => ({ ...prev, [targetId]: false }));
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to add checklist item.");
    }
  };

  const handleToggleChecklistItem = async (item: ChecklistItem, allItemsInChapter: ChecklistItem[], syllabusId: string) => {
    try {
      const newStatus = !item.completed;
      await academicApi.updateChecklistItem(studentId, item.id, { completed: newStatus });

      const total = allItemsInChapter.length;
      const completedCount = allItemsInChapter.filter((i) => (i.id === item.id ? newStatus : i.completed)).length;
      const calcProgress = Math.round((completedCount / total) * 100);
      let statusStr = "teaching";
      if (calcProgress === 100) statusStr = "completed";
      else if (calcProgress === 0) statusStr = "pending";

      await academicApi.updateSyllabus(studentId, syllabusId, {
        progress: calcProgress,
        status: statusStr as any,
      });

      invalidateSyllabus();
    } catch (err) {
      alert("Failed to update checklist item.");
    }
  };

  const handleSaveChecklistItemText = async (itemId: string) => {
    if (!editingItemText.trim()) {
      setEditingItemId(null);
      return;
    }
    try {
      await academicApi.updateChecklistItem(studentId, itemId, { text: editingItemText.trim() });
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to update item text.");
    } finally {
      setEditingItemId(null);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    try {
      await academicApi.deleteChecklistItem(studentId, itemId);
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to delete checklist item.");
    }
  };

  // ─── Chapter Note Mutations & Actions ───────────────────
  const handleAddChapterNote = async (targetId: string) => {
    const text = newNoteText[targetId]?.trim();
    if (!text) return;

    try {
      await academicApi.createChapterNote(studentId, targetId, { text });
      setNewNoteText((prev) => ({ ...prev, [targetId]: "" }));
      setShowAddNoteForm((prev) => ({ ...prev, [targetId]: false }));
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to add note.");
    }
  };

  const handleSaveChapterNoteText = async (noteId: string) => {
    if (!editingNoteText.trim()) {
      setEditingNoteId(null);
      return;
    }
    try {
      await academicApi.updateChapterNote(studentId, noteId, { text: editingNoteText.trim() });
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to update note.");
    } finally {
      setEditingNoteId(null);
    }
  };

  const handleDeleteChapterNote = async (noteId: string) => {
    try {
      await academicApi.deleteChapterNote(studentId, noteId);
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to delete note.");
    }
  };

  // ─── File Attachment Upload ──────────────────────────────
  const handleUploadAttachment = async (
    e: React.ChangeEvent<HTMLInputElement>,
    params: { checklist_item_id?: string; chapter_note_id?: string }
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await academicApi.uploadSyllabusAttachment(studentId, file, params);
      invalidateSyllabus();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to upload attachment.");
    } finally {
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await academicApi.deleteSyllabusAttachment(studentId, attachmentId);
      invalidateSyllabus();
    } catch (err) {
      alert("Failed to delete attachment.");
    }
  };

  const updateSyllabusMutation = useMutation({
    mutationFn: ({ syllabusId, data }: { syllabusId: string; data: Partial<Syllabus> }) =>
      academicApi.updateSyllabus(studentId, syllabusId, data),
    onSuccess: () => invalidateSyllabus(),
  });

  const deleteSyllabusMutation = useMutation({
    mutationFn: (syllabusId: string) => academicApi.deleteSyllabus(studentId, syllabusId),
    onSuccess: () => invalidateSyllabus(),
  });

  // ─── Grouping and Metrics ────────────────────────────────
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

  const totalChaptersCount = useMemo(() => syllabusList.length, [syllabusList]);
  const completedChaptersCount = useMemo(
    () => syllabusList.filter((s) => s.status === "completed" || s.progress === 100).length,
    [syllabusList]
  );

  return (
    <div className="syllabus-tab">
      <style>{`
        .syllabus-tab {
          width: 100%;
        }

        .tab-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .subject-section {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          margin-bottom: 24px;
          overflow: visible;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .subject-header {
          padding: 16px 20px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .subject-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .subject-title-row h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.02em;
        }

        .chapter-card {
          border-bottom: 1px solid var(--border-color);
          background: var(--card-bg);
          transition: background 0.15s ease;
        }

        .chapter-card:last-child {
          border-bottom: none;
        }

        .chapter-header-row {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          cursor: pointer;
          user-select: none;
        }

        .chapter-header-row:hover {
          background: var(--bg-tertiary);
        }

        .chapter-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 220px;
        }

        .chapter-title-text {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .edit-icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-tertiary);
          padding: 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          min-width: 32px;
          min-height: 32px;
        }

        .edit-icon-btn:hover {
          color: var(--brand-500);
          background: var(--brand-50);
        }

        .inline-edit-input {
          font-size: 14px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1.5px solid var(--brand-400);
          outline: none;
          width: 100%;
          max-width: 320px;
          background: var(--card-bg);
          color: var(--text-primary);
        }

        .expanded-content {
          padding: 0 20px 20px 20px;
          border-top: 1px dashed var(--border-color);
          background: var(--bg-secondary);
        }

        @media (max-width: 480px) {
          .expanded-content {
            padding: 0 12px 16px 12px;
          }
          .chapter-header-row {
            padding: 12px 14px;
          }
        }

        .checklist-container {
          background: var(--card-bg);
          border-radius: 8px;
          padding: 14px 16px;
          margin-top: 16px;
          border: 1px solid var(--border-color);
        }

        .checklist-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .checklist-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px dashed var(--border-color);
          min-height: 44px;
        }

        .checklist-item-row:last-child {
          border-bottom: none;
        }

        .checklist-checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          flex: 1;
        }

        .checklist-checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--brand-500);
          cursor: pointer;
        }

        .checklist-item-text {
          font-size: 13.5px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .checklist-item-text.completed {
          text-decoration: line-through;
          color: var(--text-tertiary);
        }

        .file-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 600;
          background: var(--brand-50);
          color: var(--brand-600);
          border: 1px solid var(--brand-200);
          padding: 4px 10px;
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s ease;
          min-height: 32px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-badge:hover {
          background: var(--brand-100);
        }

        .notes-box {
          margin-top: 16px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 14px 16px;
          font-size: 13px;
          color: var(--text-primary);
        }

        .notes-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-secondary);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Dynamic Colorful Type Select Button & Popover */
        .type-select-btn {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          background: var(--card-bg);
          border: 1.5px solid var(--border-color);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-primary);
          height: 32px;
          transition: all 0.15s ease;
          user-select: none;
        }

        .type-select-btn:hover {
          border-color: var(--brand-400);
          background: var(--bg-tertiary);
        }

        .type-select-btn.type-story {
          background: rgba(16, 185, 129, 0.14);
          border-color: rgba(16, 185, 129, 0.45);
          color: #10b981;
        }
        .type-select-btn.type-poem {
          background: rgba(168, 85, 247, 0.14);
          border-color: rgba(168, 85, 247, 0.45);
          color: #a855f7;
        }
        .type-select-btn.type-chapter {
          background: rgba(59, 130, 246, 0.14);
          border-color: rgba(59, 130, 246, 0.45);
          color: #3b82f6;
        }
        .type-select-btn.type-grammar {
          background: rgba(245, 158, 11, 0.14);
          border-color: rgba(245, 158, 11, 0.45);
          color: #f59e0b;
        }
        .type-select-btn.type-other {
          background: rgba(244, 63, 94, 0.14);
          border-color: rgba(244, 63, 94, 0.45);
          color: #f43f5e;
        }

        .type-badge-inner {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 600;
        }

        .type-popover {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          z-index: 50;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
          padding: 6px;
          min-width: 145px;
          white-space: nowrap;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .type-popover.drop-up {
          top: auto;
          bottom: calc(100% + 4px);
        }

        .popover-header {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 4px 8px 6px 8px;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 2px;
        }

        .type-popover-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid transparent;
          background: transparent;
          text-align: left;
          width: 100%;
          transition: all 0.12s ease;
          user-select: none;
        }

        .type-popover-item.type-story { color: #10b981; }
        .type-popover-item.type-story:hover, .type-popover-item.type-story.is-selected {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.4);
        }

        .type-popover-item.type-poem { color: #a855f7; }
        .type-popover-item.type-poem:hover, .type-popover-item.type-poem.is-selected {
          background: rgba(168, 85, 247, 0.15);
          border-color: rgba(168, 85, 247, 0.4);
        }

        .type-popover-item.type-chapter { color: #3b82f6; }
        .type-popover-item.type-chapter:hover, .type-popover-item.type-chapter.is-selected {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .type-popover-item.type-grammar { color: #f59e0b; }
        .type-popover-item.type-grammar:hover, .type-popover-item.type-grammar.is-selected {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.4);
        }

        .type-popover-item.type-other { color: #f43f5e; }
        .type-popover-item.type-other:hover, .type-popover-item.type-other.is-selected {
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.4);
        }

        .type-clear-item {
          color: var(--text-tertiary);
          margin-top: 4px;
          border-top: 1px solid var(--border-color);
          padding-top: 6px;
        }

        .type-clear-item:hover {
          background: var(--bg-tertiary);
          color: var(--danger);
        }

        .check-icon {
          margin-left: auto;
        }

        /* Term/SEM Select Button & Popover */
        .term-select-btn {
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          position: relative;
          user-select: none;
          transition: all 0.15s ease;
          height: 32px;
          background: var(--card-bg);
          border: 1.5px solid var(--border-color);
          color: var(--text-secondary);
        }

        .term-select-btn:hover {
          border-color: var(--brand-400);
        }

        .term-select-btn.has-single-value {
          padding: 4px 10px;
          height: 32px;
          font-size: 12px;
        }

        .term-select-btn.has-single-value.term-sem1 {
          background: #eef2ff;
          color: #4f46e5;
          border-color: #c7d2fe;
        }
        .term-select-btn.has-single-value.term-sem2 {
          background: #f0f9ff;
          color: #0284c7;
          border-color: #bae6fd;
        }
        .term-select-btn.has-single-value.term-ut1 {
          background: #fff7ed;
          color: #ea580c;
          border-color: #fed7aa;
        }
        .term-select-btn.has-single-value.term-ut2 {
          background: #fdf4ff;
          color: #c026d3;
          border-color: #f5d0fe;
        }
        .term-select-btn.has-single-value.term-ut3 {
          background: #fdf2f8;
          color: #db2777;
          border-color: #fbcfe8;
        }
        .term-select-btn.has-single-value.term-classtest {
          background: #ecfdf5;
          color: #059669;
          border-color: #a7f3d0;
        }

        .term-select-btn.has-multi-value {
          background: transparent;
          border-color: transparent;
          padding: 3px 4px;
        }

        .term-select-btn.has-multi-value:hover {
          background: var(--bg-tertiary);
          border-color: var(--border-color);
        }

        .term-pills-container {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .term-pill-badge {
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          display: inline-block;
          letter-spacing: 0.02em;
        }

        .term-pill-badge.term-sem1 {
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid #c7d2fe;
        }

        .term-pill-badge.term-sem2 {
          background: #f0f9ff;
          color: #0284c7;
          border: 1px solid #bae6fd;
        }

        .term-pill-badge.term-ut1 {
          background: #fff7ed;
          color: #ea580c;
          border: 1px solid #fed7aa;
        }

        .term-pill-badge.term-ut2 {
          background: #fdf4ff;
          color: #c026d3;
          border: 1px solid #f5d0fe;
        }

        .term-pill-badge.term-ut3 {
          background: #fdf2f8;
          color: #db2777;
          border: 1px solid #fbcfe8;
        }

        .term-pill-badge.term-classtest {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .term-popover {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          z-index: 50;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
          padding: 6px;
          min-width: 160px;
          white-space: nowrap;
          max-height: 250px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .term-popover.drop-up {
          top: auto;
          bottom: calc(100% + 4px);
        }

        .term-popover-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11.5px;
          font-weight: 600;
          transition: all 0.12s ease;
          user-select: none;
          min-height: 32px;
          border: 1px solid transparent;
        }

        .term-popover-item.term-sem1 {
          color: #4f46e5;
        }
        .term-popover-item.term-sem1 input { accent-color: #4f46e5; }
        .term-popover-item.term-sem1:hover, .term-popover-item.term-sem1.is-checked {
          background: #eef2ff;
          border-color: #c7d2fe;
        }

        .term-popover-item.term-sem2 {
          color: #0284c7;
        }
        .term-popover-item.term-sem2 input { accent-color: #0284c7; }
        .term-popover-item.term-sem2:hover, .term-popover-item.term-sem2.is-checked {
          background: #f0f9ff;
          border-color: #bae6fd;
        }

        .term-popover-item.term-ut1 {
          color: #ea580c;
        }
        .term-popover-item.term-ut1 input { accent-color: #ea580c; }
        .term-popover-item.term-ut1:hover, .term-popover-item.term-ut1.is-checked {
          background: #fff7ed;
          border-color: #fed7aa;
        }

        .term-popover-item.term-ut2 {
          color: #c026d3;
        }
        .term-popover-item.term-ut2 input { accent-color: #c026d3; }
        .term-popover-item.term-ut2:hover, .term-popover-item.term-ut2.is-checked {
          background: #fdf4ff;
          border-color: #f5d0fe;
        }

        .term-popover-item.term-ut3 {
          color: #db2777;
        }
        .term-popover-item.term-ut3 input { accent-color: #db2777; }
        .term-popover-item.term-ut3:hover, .term-popover-item.term-ut3.is-checked {
          background: #fdf2f8;
          border-color: #fbcfe8;
        }

        .term-popover-item.term-classtest {
          color: #059669;
        }
        .term-popover-item.term-classtest input { accent-color: #059669; }
        .term-popover-item.term-classtest:hover, .term-popover-item.term-classtest.is-checked {
          background: #ecfdf5;
          border-color: #a7f3d0;
        }

        .status-select {
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          background: var(--card-bg);
          color: var(--text-primary);
          border: 1.5px solid var(--border-color);
          cursor: pointer;
          height: 32px;
        }

        .status-select.completed { background: var(--success-light); color: var(--success); }
        .status-select.teaching { background: var(--info-light); color: var(--info); }
        .status-select.revision { background: var(--warning-light); color: var(--warning); }
        .status-select.pending { background: var(--bg-tertiary); color: var(--text-tertiary); }

        .chapter-header-controls {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .progress-slider-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .progress-slider {
          width: 75px;
          height: 6px;
          accent-color: var(--brand-500);
          cursor: pointer;
          flex-shrink: 0;
        }

        .progress-percent-badge {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          min-width: 44px;
          text-align: right;
          flex-shrink: 0;
          padding-right: 4px;
        }

        .chapter-control-divider {
          width: 1px;
          height: 18px;
          background: var(--border-color);
          margin: 0 2px;
          flex-shrink: 0;
        }

        .delete-chapter-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--text-tertiary);
          padding: 6px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
          min-width: 34px;
          min-height: 34px;
        }

        .delete-chapter-btn:hover {
          color: var(--danger);
          background: var(--danger-light);
        }

        .action-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--brand-600);
          background: var(--brand-50);
          border: 1px dashed var(--brand-300);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 36px;
        }

        .action-add-btn:hover {
          background: var(--brand-100);
        }

        .add-syllabus-card {
          background: var(--card-bg);
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
          margin-bottom: 24px;
        }

        .add-syllabus-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .add-syllabus-header h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .mode-tab-btn {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .mode-tab-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .mode-tab-btn.active {
          background: var(--brand-500);
          color: white;
          border-color: var(--brand-500);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
        }
      `}</style>

      {/* Header */}
      <div className="tab-header" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2>Syllabus Tracker</h2>
            {totalChaptersCount > 0 && (
              <span style={{ fontSize: 12, color: "var(--gray-500)", fontWeight: 500 }}>
                {completedChaptersCount} of {totalChaptersCount} chapters completed
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn-secondary"
              onClick={() => setShowExportModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}
              id="export-syllabus-btn"
            >
              <Download size={15} style={{ color: "var(--brand-600)" }} />
              Export Syllabus
            </button>

            <button
              className="btn-secondary"
              onClick={handleDownloadDemoTemplate}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}
              id="download-demo-syllabus-btn"
            >
              <FileSpreadsheet size={15} style={{ color: "#059669" }} />
              Demo Template (CSV)
            </button>

            <label
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: uploading ? "not-allowed" : "pointer",
                padding: "8px 12px",
                fontSize: 12.5,
                fontWeight: 600,
              }}
              id="import-syllabus-file-btn"
            >
              <Upload size={15} style={{ color: "var(--brand-600)" }} />
              {uploading ? "Importing..." : "Import Syllabus File"}
              <input
                type="file"
                accept=".csv,.txt,.pdf,.docx"
                onChange={handleImportFile}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>

            {!showAddForm && (
              <button
                className="add-btn"
                onClick={() => setShowAddForm(true)}
                id="add-syllabus-btn"
              >
                <Plus size={16} />
                Add Subject / Chapters
              </button>
            )}
          </div>
        </div>

        {uploadError && (
          <div style={{ color: "var(--danger)", fontSize: 13, padding: "10px 14px", background: "var(--danger-light)", borderRadius: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{uploadError}</span>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }} onClick={() => setUploadError("")}>
              <X size={14} />
            </button>
          </div>
        )}

        {uploadSuccessMsg && (
          <div style={{ color: "#047857", fontSize: 13, padding: "10px 14px", background: "#d1fae5", borderRadius: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={16} />
              <span>{uploadSuccessMsg}</span>
            </div>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#047857" }} onClick={() => setUploadSuccessMsg("")}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ─── Bulk Add Chapters Form ─── */}
      {showAddForm && (
        <div className="add-syllabus-card animate-fade-in">
          <div className="add-syllabus-header">
            <h3>Add Chapters to Syllabus</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className={`mode-tab-btn ${addMode === "textarea" ? "active" : ""}`}
                onClick={() => setAddMode("textarea")}
                type="button"
              >
                Paste Multi-Line List
              </button>
              <button
                className={`mode-tab-btn ${addMode === "dynamic" ? "active" : ""}`}
                onClick={() => setAddMode("dynamic")}
                type="button"
              >
                Multiple Input Rows
              </button>
            </div>
          </div>

          <form onSubmit={handleBulkAdd}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="syll-subject">
                Subject *
              </label>
              <input
                id="syll-subject"
                className="form-input"
                placeholder="e.g. Mathematics, Science, English"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {addMode === "textarea" ? (
              <div className="form-group">
                <label className="form-label" htmlFor="syll-chapters-text">
                  Enter Chapters / Topics (One chapter per line) *
                </label>
                <textarea
                  id="syll-chapters-text"
                  className="notes-textarea"
                  style={{ minHeight: 120, fontFamily: "inherit" }}
                  placeholder={`CHAPTER 1: ADDITION\nCHAPTER 2: SUBTRACTION\nRevision for Unit Test`}
                  value={chaptersText}
                  onChange={(e) => setChaptersText(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">
                  Chapter Titles *
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dynamicChapters.map((chapName, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        className="form-input"
                        placeholder={`Chapter ${idx + 1} title`}
                        value={chapName}
                        onChange={(e) => {
                          const updated = [...dynamicChapters];
                          updated[idx] = e.target.value;
                          setDynamicChapters(updated);
                        }}
                        required={idx === 0}
                      />
                      {dynamicChapters.length > 1 && (
                        <button
                          type="button"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                          onClick={() => setDynamicChapters(dynamicChapters.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => setDynamicChapters([...dynamicChapters, ""])}
                  >
                    <Plus size={14} /> Add Chapter Row
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => { setShowAddForm(false); resetForm(); }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting || !subject.trim()}>
                {submitting ? "Adding Chapters..." : "Add All Chapters"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Syllabus Lists ─── */}
      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--gray-400)" }}>
          Loading syllabus progress...
        </div>
      ) : Object.keys(groupedSyllabus).length > 0 ? (
        Object.entries(groupedSyllabus).map(([subj, items]) => {
          const overallProgress = subjectProgress[subj] || 0;
          const isEditingSubject = editingSubject?.original === subj;

          return (
            <div key={subj} className="subject-section" id={`syllabus-subject-${subj}`}>
              <div className="subject-header">
                <div className="subject-title-row">
                  <BookOpen size={16} style={{ color: "var(--brand-500)" }} />
                  {isEditingSubject ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        className="inline-edit-input"
                        value={editingSubject.current}
                        onChange={(e) => setEditingSubject({ ...editingSubject, current: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveSubject()}
                        autoFocus
                      />
                      <button className="edit-icon-btn" onClick={handleSaveSubject} title="Save Subject Name">
                        <Check size={16} style={{ color: "#059669" }} />
                      </button>
                      <button className="edit-icon-btn" onClick={() => setEditingSubject(null)} title="Cancel">
                        <X size={16} style={{ color: "var(--danger)" }} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <h3>{subj}</h3>
                      <button
                        className="edit-icon-btn"
                        onClick={() => setEditingSubject({ original: subj, current: subj })}
                        title="Edit Subject Name"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="subject-progress-container" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, fontWeight: 600, color: "var(--gray-600)" }}>
                  <span>Overall: {overallProgress}%</span>
                  <div style={{ width: 100, height: 6, background: "var(--gray-200)", borderRadius: 100, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--brand-500)", width: `${overallProgress}%` }} />
                  </div>
                </div>
              </div>

              {/* Chapters in Subject */}
              {items.map((syllabusItem, chapIdx) => {
                const isDropUp = items.length > 1 && chapIdx >= items.length - 2;
                const chapterObj = syllabusItem.chapters && syllabusItem.chapters.length > 0 ? syllabusItem.chapters[0] : null;
                const chapterTargetId = chapterObj?.id || syllabusItem.id;
                const chapterTitle = chapterObj?.title || syllabusItem.chapter;
                const checklistItems = chapterObj?.checklist_items || [];
                const notes = chapterObj?.notes || [];
                const isEditingChapter = editingSyllabusId === syllabusItem.id;
                const isExpanded = !!expandedChapters[syllabusItem.id];

                return (
                  <div key={syllabusItem.id} className="chapter-card" id={`syllabus-card-${syllabusItem.id}`}>
                    {/* Compact Chapter Header Row */}
                    <div
                      className="chapter-header-row"
                      onClick={() => toggleExpand(syllabusItem.id)}
                    >
                      <div className="chapter-title-group">
                        <span style={{ fontSize: 16, marginRight: 4 }}>📖</span>
                        {isEditingChapter ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }} onClick={(e) => e.stopPropagation()}>
                            <input
                              className="inline-edit-input"
                              value={editingChapterTitle}
                              onChange={(e) => setEditingChapterTitle(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSaveChapterTitle(syllabusItem.id, chapterObj)}
                              autoFocus
                            />
                            <button
                              className="edit-icon-btn"
                              onClick={() => handleSaveChapterTitle(syllabusItem.id, chapterObj)}
                              title="Save Title"
                            >
                              <Check size={16} style={{ color: "#059669" }} />
                            </button>
                            <button className="edit-icon-btn" onClick={() => setEditingSyllabusId(null)} title="Cancel">
                              <X size={16} style={{ color: "var(--danger)" }} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="chapter-title-text">
                              {chapterTitle}
                            </span>
                            <button
                              className="edit-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSyllabusId(syllabusItem.id);
                                setEditingChapterTitle(chapterTitle);
                              }}
                              title="Edit Chapter Title"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right Controls & Chevron */}
                      <div className="chapter-header-controls" onClick={(e) => e.stopPropagation()}>
                        {/* Dynamic Colorful Type Popover */}
                        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const selectedTypeObj = TYPE_OPTIONS.find((t) => t.id === syllabusItem.chapter_type);
                            return (
                              <button
                                type="button"
                                className={`type-select-btn ${selectedTypeObj ? selectedTypeObj.colorClass : ""}`}
                                onClick={() => {
                                  setOpenTermPopoverId(null);
                                  setOpenTypePopoverId(openTypePopoverId === syllabusItem.id ? null : syllabusItem.id);
                                }}
                                title={selectedTypeObj ? selectedTypeObj.label : "Select Type"}
                              >
                                {selectedTypeObj ? (
                                  <span className="type-badge-inner">
                                    <span>{selectedTypeObj.icon}</span>
                                    <span>{selectedTypeObj.label}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-tertiary)" }}>— Type —</span>
                                )}
                                <ChevronDown size={12} style={{ opacity: 0.7 }} />
                              </button>
                            );
                          })()}

                          {openTypePopoverId === syllabusItem.id && (
                            <>
                              <div
                                style={{ position: "fixed", inset: 0, zIndex: 45 }}
                                onClick={() => setOpenTypePopoverId(null)}
                              />
                              <div className={`type-popover animate-fade-in ${isDropUp ? "drop-up" : ""}`} onClick={(e) => e.stopPropagation()}>
                                <div className="popover-header">Select Type</div>
                                {TYPE_OPTIONS.map((tOpt) => {
                                  const isSelected = syllabusItem.chapter_type === tOpt.id;
                                  return (
                                    <button
                                      key={tOpt.id}
                                      type="button"
                                      className={`type-popover-item ${tOpt.colorClass} ${isSelected ? "is-selected" : ""}`}
                                      onClick={() => {
                                        updateSyllabusMutation.mutate({
                                          syllabusId: syllabusItem.id,
                                          data: { chapter_type: tOpt.id },
                                        });
                                        setOpenTypePopoverId(null);
                                      }}
                                    >
                                      <span style={{ fontSize: 13 }}>{tOpt.icon}</span>
                                      <span className="type-item-label">{tOpt.label}</span>
                                      {isSelected && <Check size={13} className="check-icon" />}
                                    </button>
                                  );
                                })}
                                {syllabusItem.chapter_type && (
                                  <button
                                    type="button"
                                    className="type-popover-item type-clear-item"
                                    onClick={() => {
                                      updateSyllabusMutation.mutate({
                                        syllabusId: syllabusItem.id,
                                        data: { chapter_type: null },
                                      });
                                      setOpenTypePopoverId(null);
                                    }}
                                  >
                                    <X size={12} />
                                    <span>Clear Type</span>
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Dynamic Colorful Term/SEM Multi-Select Popover */}
                        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const selectedArr = syllabusItem.term
                              ? syllabusItem.term.split(", ").filter(Boolean)
                              : [];
                            const firstCfg = selectedArr.length > 0
                              ? TERM_OPTIONS_CONFIG.find((t) => t.id === selectedArr[0])
                              : null;

                            const btnClass = selectedArr.length === 0
                              ? "term-select-btn"
                              : selectedArr.length === 1
                                ? `term-select-btn has-single-value ${firstCfg ? firstCfg.colorClass : ""}`
                                : "term-select-btn has-multi-value";

                            return (
                              <button
                                type="button"
                                className={btnClass}
                                onClick={() => {
                                  setOpenTypePopoverId(null);
                                  setOpenTermPopoverId(
                                    openTermPopoverId === syllabusItem.id ? null : syllabusItem.id
                                  );
                                }}
                                title={syllabusItem.term || "Select Term / Exam"}
                              >
                                {selectedArr.length === 0 ? (
                                  <span style={{ color: "var(--text-tertiary)" }}>— Term —</span>
                                ) : selectedArr.length === 1 ? (
                                  <span>{firstCfg ? firstCfg.shortLabel : selectedArr[0]}</span>
                                ) : (
                                  <span className="term-pills-container">
                                    {selectedArr.map((termVal) => {
                                      const cfg = TERM_OPTIONS_CONFIG.find((t) => t.id === termVal);
                                      return (
                                        <span key={termVal} className={`term-pill-badge ${cfg ? cfg.colorClass : ""}`}>
                                          {cfg ? cfg.shortLabel : termVal}
                                        </span>
                                      );
                                    })}
                                  </span>
                                )}
                                <ChevronDown size={12} style={{ opacity: 0.7 }} />
                              </button>
                            );
                          })()}

                          {openTermPopoverId === syllabusItem.id && (
                            <>
                              <div
                                style={{ position: "fixed", inset: 0, zIndex: 45 }}
                                onClick={() => setOpenTermPopoverId(null)}
                              />
                              <div className={`term-popover animate-fade-in ${isDropUp ? "drop-up" : ""}`} onClick={(e) => e.stopPropagation()}>
                                <div className="popover-header">Select Term / Exam</div>
                                {TERM_OPTIONS_CONFIG.map((optCfg) => {
                                  const selectedArr = syllabusItem.term
                                    ? syllabusItem.term.split(", ").filter(Boolean)
                                    : [];
                                  const isChecked = selectedArr.includes(optCfg.id);
                                  return (
                                    <label
                                      key={optCfg.id}
                                      className={`term-popover-item ${optCfg.colorClass} ${isChecked ? "is-checked" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          let updated: string[];
                                          if (isChecked) {
                                            updated = selectedArr.filter((t) => t !== optCfg.id);
                                          } else {
                                            updated = [...selectedArr, optCfg.id];
                                          }
                                          const newTermVal =
                                            updated.length > 0 ? updated.join(", ") : null;
                                          updateSyllabusMutation.mutate({
                                            syllabusId: syllabusItem.id,
                                            data: { term: newTermVal },
                                          });
                                        }}
                                        style={{
                                          width: 14,
                                          height: 14,
                                          cursor: "pointer",
                                        }}
                                      />
                                      <span className="term-badge-tag">{optCfg.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>

                        <select
                          className={`status-select ${syllabusItem.status}`}
                          value={syllabusItem.status}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            const isCompleted = val === "completed";
                            updateSyllabusMutation.mutate({
                              syllabusId: syllabusItem.id,
                              data: {
                                status: val,
                                progress: isCompleted ? 100 : syllabusItem.progress,
                              },
                            });
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="teaching">Teaching</option>
                          <option value="revision">Revision</option>
                          <option value="completed">Completed</option>
                        </select>

                        <div className="progress-slider-wrapper">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            className="progress-slider"
                            value={syllabusItem.progress}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              let stat = syllabusItem.status;
                              if (val === 100) stat = "completed";
                              else if (val > 0 && syllabusItem.status === "pending") stat = "teaching";
                              else if (val === 0) stat = "pending";

                              updateSyllabusMutation.mutate({
                                syllabusId: syllabusItem.id,
                                data: { progress: val, status: stat as any },
                              });
                            }}
                          />
                          <span className="progress-percent-badge">
                            {syllabusItem.progress}%
                          </span>
                        </div>

                        <div className="chapter-control-divider" />

                        <button
                          className="delete-chapter-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSyllabusMutation.mutate(syllabusItem.id);
                          }}
                          title="Delete Chapter"
                        >
                          <Trash2 size={15} />
                        </button>

                        <div style={{ color: "var(--gray-500)", cursor: "pointer", display: "flex", alignItems: "center", marginLeft: 2 }} onClick={() => toggleExpand(syllabusItem.id)}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Expanded Content */}
                    {isExpanded && (
                      <div className="expanded-content">
                        {/* Checklist Container */}
                        <div className="checklist-container">
                          <div className="checklist-title">
                            <span>Study Checklist ({checklistItems.filter((i) => i.completed).length}/{checklistItems.length})</span>
                          </div>

                          {/* Checklist Item Rows */}
                          {checklistItems.map((cItem) => {
                            const isEditingThisItem = editingItemId === cItem.id;
                            return (
                              <div key={cItem.id} className="checklist-item-row">
                                {isEditingThisItem ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                                    <input
                                      className="inline-edit-input"
                                      style={{ fontSize: 13, padding: "3px 8px" }}
                                      value={editingItemText}
                                      onChange={(e) => setEditingItemText(e.target.value)}
                                      onKeyDown={(e) => e.key === "Enter" && handleSaveChecklistItemText(cItem.id)}
                                      autoFocus
                                    />
                                    <button className="edit-icon-btn" onClick={() => handleSaveChecklistItemText(cItem.id)}>
                                      <Check size={14} style={{ color: "#059669" }} />
                                    </button>
                                    <button className="edit-icon-btn" onClick={() => setEditingItemId(null)}>
                                      <X size={14} style={{ color: "var(--danger)" }} />
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
                                    <label className="checklist-checkbox-label">
                                      <input
                                        type="checkbox"
                                        checked={cItem.completed}
                                        onChange={() => handleToggleChecklistItem(cItem, checklistItems, syllabusItem.id)}
                                        style={{ accentColor: "var(--brand-600)", width: 15, height: 15, cursor: "pointer" }}
                                      />
                                      <span className={`checklist-item-text ${cItem.completed ? "completed" : ""}`}>
                                        {cItem.text}
                                      </span>
                                    </label>

                                    <button
                                      className="edit-icon-btn"
                                      onClick={() => {
                                        setEditingItemId(cItem.id);
                                        setEditingItemText(cItem.text);
                                      }}
                                      title="Edit item text"
                                    >
                                      <Pencil size={12} />
                                    </button>

                                    {/* Item Attachments */}
                                    {cItem.attachments && cItem.attachments.map((att) => (
                                      <div key={att.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                        <a
                                          href={getFileUrl(att.stored_path)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="file-badge"
                                        >
                                          <Paperclip size={11} />
                                          {att.filename}
                                        </a>
                                        <button
                                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", padding: 2 }}
                                          onClick={() => handleDeleteAttachment(att.id)}
                                          title="Remove attachment"
                                        >
                                          <X size={11} />
                                        </button>
                                      </div>
                                    ))}

                                    {/* Compact Upload button */}
                                    <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--brand-600)" }} title="Attach PDF/JPG/PNG file to this checklist item">
                                      <Paperclip size={13} /> Attach
                                      <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        style={{ display: "none" }}
                                        onChange={(e) => handleUploadAttachment(e, { checklist_item_id: cItem.id })}
                                      />
                                    </label>
                                  </div>
                                )}

                                <button
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", padding: 4 }}
                                  onClick={() => handleDeleteChecklistItem(cItem.id)}
                                  title="Delete checklist item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })}

                          {/* Add Checklist Item Row */}
                          <div style={{ marginTop: 12 }}>
                            {showAddItemForm[chapterTargetId] ? (
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                  className="form-input"
                                  style={{ fontSize: 13, padding: "6px 10px" }}
                                  placeholder="Type custom checklist text (e.g. Ex 1, Complete questions 5–15)..."
                                  value={newItemText[chapterTargetId] || ""}
                                  onChange={(e) => setNewItemText({ ...newItemText, [chapterTargetId]: e.target.value })}
                                  onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem(chapterTargetId)}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                                  onClick={() => handleAddChecklistItem(chapterTargetId)}
                                >
                                  <Check size={14} /> Save Item
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: "6px 10px", fontSize: 12 }}
                                  onClick={() => setShowAddItemForm({ ...showAddItemForm, [chapterTargetId]: false })}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="action-add-btn"
                                onClick={() => setShowAddItemForm({ ...showAddItemForm, [chapterTargetId]: true })}
                              >
                                <Plus size={14} /> Add checklist item
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Teacher's Notes Section */}
                        <div className="notes-box">
                          <div className="notes-title">
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <MessageSquare size={13} style={{ color: "var(--brand-600)" }} /> Teacher&apos;s Note
                            </span>
                          </div>

                          {notes.length > 0 ? (
                            notes.map((n) => {
                              const isEditingThisNote = editingNoteId === n.id;
                              return (
                                <div key={n.id} style={{ marginBottom: 10 }}>
                                  {isEditingThisNote ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <textarea
                                        style={{ width: "100%", padding: 10, borderRadius: 6, border: "1.5px solid var(--brand-400)", fontSize: 13, fontFamily: "inherit" }}
                                        rows={3}
                                        value={editingNoteText}
                                        onChange={(e) => setEditingNoteText(e.target.value)}
                                      />
                                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                        <button className="btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEditingNoteId(null)}>Cancel</button>
                                        <button className="btn-primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleSaveChapterNoteText(n.id)}>Save Note</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ background: "var(--gray-50)", padding: 10, borderRadius: 6, border: "1px solid var(--gray-200)" }}>
                                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                        <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--gray-800)", fontStyle: "italic", fontSize: 13 }}>
                                          &ldquo;{n.text}&rdquo;
                                        </p>
                                        <div style={{ display: "flex", gap: 4 }}>
                                          <button className="edit-icon-btn" onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.text); }} title="Edit Note">
                                            <Pencil size={12} />
                                          </button>
                                          <button className="edit-icon-btn" onClick={() => handleDeleteChapterNote(n.id)} title="Delete Note">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Note Attachments */}
                                      {n.attachments && n.attachments.length > 0 && (
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                          {n.attachments.map((att) => (
                                            <div key={att.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                              <a href={getFileUrl(att.stored_path)} target="_blank" rel="noopener noreferrer" className="file-badge">
                                                <Paperclip size={11} /> {att.filename}
                                              </a>
                                              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)" }} onClick={() => handleDeleteAttachment(att.id)}>
                                                <X size={11} />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--brand-600)", marginTop: 6 }}>
                                        <Paperclip size={12} /> Attach File (PDF/JPG/PNG)
                                        <input
                                          type="file"
                                          accept=".pdf,.jpg,.jpeg,.png"
                                          style={{ display: "none" }}
                                          onChange={(e) => handleUploadAttachment(e, { chapter_note_id: n.id })}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : showAddNoteForm[chapterTargetId] ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <textarea
                                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1.5px solid var(--brand-400)", fontSize: 13, fontFamily: "inherit" }}
                                rows={3}
                                placeholder='Type custom note (e.g. "Practice questions 1–10 before Friday&apos;s test. Focus especially on carrying.")...'
                                value={newNoteText[chapterTargetId] || ""}
                                onChange={(e) => setNewNoteText({ ...newNoteText, [chapterTargetId]: e.target.value })}
                                autoFocus
                              />
                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: "5px 12px", fontSize: 12 }}
                                  onClick={() => setShowAddNoteForm({ ...showAddNoteForm, [chapterTargetId]: false })}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ padding: "5px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                                  onClick={() => handleAddChapterNote(chapterTargetId)}
                                >
                                  <Check size={14} /> Save Note
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="action-add-btn"
                              onClick={() => setShowAddNoteForm({ ...showAddNoteForm, [chapterTargetId]: true })}
                            >
                              <Plus size={14} /> Add Note
                            </button>
                          )}
                        </div>
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
            background: "white",
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
              background: "var(--gray-50)",
              color: "var(--gray-400)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <FileText size={24} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--gray-800)", marginBottom: 6 }}>
            No syllabus entries yet
          </h3>
          <p style={{ fontSize: 13, color: "var(--gray-500)", maxWidth: 360, margin: "0 auto" }}>
            Add custom chapters or import your syllabus file to get started.
          </p>
        </div>
      )}
      {/* Export Syllabus Modal */}
      <SyllabusExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        syllabusList={syllabusList}
        studentName={studentName}
      />
    </div>
  );
}
