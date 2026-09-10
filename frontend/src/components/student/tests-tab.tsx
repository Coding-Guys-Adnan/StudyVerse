"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  Award,
  BookOpen,
  X,
  FileText,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Eye,
  Pencil,
  Filter,
  ChevronDown,
} from "lucide-react";
import { academicApi, Test } from "@/lib/academic-api";
import { getFileUrl } from "@/lib/api";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

const PREDEFINED_TERMS = [
  { id: "SEM1", label: "SEM1", color: "#818cf8", bg: "rgba(99, 102, 241, 0.12)", border: "rgba(99, 102, 241, 0.4)" },
  { id: "SEM2", label: "SEM2", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.4)" },
  { id: "UNIT TEST I", label: "UNIT TEST I", color: "#fb923c", bg: "rgba(251, 146, 60, 0.12)", border: "rgba(251, 146, 60, 0.4)" },
  { id: "UNIT TEST II", label: "UNIT TEST II", color: "#c084fc", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.4)" },
  { id: "UNIT TEST III", label: "UNIT TEST III", color: "#f472b6", bg: "rgba(244, 114, 182, 0.12)", border: "rgba(244, 114, 182, 0.4)" },
  { id: "CLASS TEST", label: "CLASS TEST", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.4)" },
];

interface TestsTabProps {
  studentId: string;
}

export function TestsTab({ studentId }: TestsTabProps) {
  const queryClient = useQueryClient();
  const qPaperInputRef = useRef<HTMLInputElement | null>(null);
  const aPaperInputRef = useRef<HTMLInputElement | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [examName, setExamName] = useState("");
  const [examType, setExamType] = useState<"school" | "tuition">("tuition");
  const [maxMarks, setMaxMarks] = useState("");
  const [obtainedMarks, setObtainedMarks] = useState("");
  const [remarks, setRemarks] = useState("");
  const [examDate, setExamDate] = useState("");

  // Question Paper & Answer Paper State
  const [questionPaperName, setQuestionPaperName] = useState("");
  const [questionPaperUrl, setQuestionPaperUrl] = useState("");
  const [answerPaperName, setAnswerPaperName] = useState("");
  const [answerPaperUrl, setAnswerPaperUrl] = useState("");

  // Paper Lightbox Modal Preview
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

    if (rawUrl.includes("data:")) {
      rawUrl = rawUrl.substring(rawUrl.indexOf("data:"));
    } else if (rawUrl.startsWith("JVBERi")) {
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
      setPdfBlobUrl(getFileUrl(rawUrl));
    }
  }, [previewModalFile]);

  const handleDownloadFile = () => {
    if (!previewModalFile) return;
    let downloadUrl = pdfBlobUrl;
    if (!downloadUrl) {
      let rawUrl = previewModalFile.url?.trim() || "";
      if (rawUrl.includes("data:")) {
        rawUrl = rawUrl.substring(rawUrl.indexOf("data:"));
        try {
          const parts = rawUrl.split(",");
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
          const b64Data = (parts[1] || parts[0]).replace(/[\r\n\s]/g, "");
          const binaryStr = atob(b64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mimeType });
          downloadUrl = URL.createObjectURL(blob);
        } catch {
          downloadUrl = rawUrl;
        }
      } else {
        downloadUrl = getFileUrl(rawUrl);
      }
    }
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = previewModalFile.name || "document.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ─── Query ──────────────────────────────────────────────
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["tests", studentId],
    queryFn: () => academicApi.getTests(studentId),
    select: (res) => res.data,
  });

  // ─── Mutations ──────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: () =>
      academicApi.addTest(studentId, {
        subject,
        exam_name: examName,
        exam_type: examType,
        max_marks: parseFloat(maxMarks),
        obtained_marks: parseFloat(obtainedMarks),
        remarks: remarks || undefined,
        exam_date: examDate || undefined,
        question_paper_name: questionPaperName || undefined,
        question_paper_url: questionPaperUrl || undefined,
        answer_paper_name: answerPaperName || undefined,
        answer_paper_url: answerPaperUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setShowAddForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      academicApi.updateTest(studentId, editingTestId!, {
        subject,
        exam_name: examName,
        exam_type: examType,
        max_marks: parseFloat(maxMarks),
        obtained_marks: parseFloat(obtainedMarks),
        remarks: remarks || null,
        exam_date: examDate || null,
        question_paper_name: questionPaperName || null,
        question_paper_url: questionPaperUrl || null,
        answer_paper_name: answerPaperName || null,
        answer_paper_url: answerPaperUrl || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setShowAddForm(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (testId: string) => academicApi.deleteTest(studentId, testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const resetForm = () => {
    setEditingTestId(null);
    setSubject("");
    setExamName("");
    setMaxMarks("");
    setObtainedMarks("");
    setRemarks("");
    setExamDate("");
    setQuestionPaperName("");
    setQuestionPaperUrl("");
    setAnswerPaperName("");
    setAnswerPaperUrl("");
    if (qPaperInputRef.current) qPaperInputRef.current.value = "";
    if (aPaperInputRef.current) aPaperInputRef.current.value = "";
  };

  const handleStartEdit = (test: Test) => {
    setEditingTestId(test.id);
    setSubject(test.subject);
    setExamName(test.exam_name);
    setExamType((test.exam_type as "school" | "tuition") || "tuition");
    setMaxMarks(test.max_marks.toString());
    setObtainedMarks(test.obtained_marks.toString());
    setRemarks(test.remarks || "");
    setExamDate(test.exam_date || "");
    setQuestionPaperName(test.question_paper_name || "");
    setQuestionPaperUrl(test.question_paper_url || "");
    setAnswerPaperName(test.answer_paper_name || "");
    setAnswerPaperUrl(test.answer_paper_url || "");
    setShowAddForm(true);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setName: (n: string) => void,
    setUrl: (u: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File is too large! Please select a file smaller than 15MB.");
      return;
    }

    setName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        let dataUrl = event.target.result as string;
        if (file.name.toLowerCase().endsWith(".pdf") && dataUrl.startsWith("data:")) {
          dataUrl = dataUrl.replace(/^data:[^;]+;base64,/, "data:application/pdf;base64,");
        }
        setUrl(dataUrl);
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
    if (clean.includes("data:")) {
      clean = clean.substring(clean.indexOf("data:"));
    } else if (clean.startsWith("JVBERi")) {
      clean = `data:application/pdf;base64,${clean}`;
    } else if (clean.startsWith("data:")) {
      clean = clean.replace(/^data:[^;]+;base64,/, "data:application/pdf;base64,");
    } else {
      clean = getFileUrl(clean);
    }
    return clean;
  };

  // Filter State
  const [selectedExamFilters, setSelectedExamFilters] = useState<string[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const availableFilterOptions = useMemo(() => {
    const list = [...PREDEFINED_TERMS];
    const existingSet = new Set(list.map((t) => t.id.toLowerCase()));

    tests.forEach((t) => {
      const name = (t.exam_name || "").trim();
      if (name && !existingSet.has(name.toLowerCase())) {
        existingSet.add(name.toLowerCase());
        list.push({
          id: name,
          label: name.toUpperCase(),
          color: "#06b6d4",
          bg: "rgba(6, 182, 212, 0.12)",
          border: "rgba(6, 182, 212, 0.4)",
        });
      }
    });
    return list;
  }, [tests]);

  const toggleFilter = (id: string) => {
    setSelectedExamFilters((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredTests = useMemo(() => {
    if (selectedExamFilters.length === 0) return tests;
    return tests.filter((t) => {
      const testName = (t.exam_name || "").toLowerCase().trim();
      return selectedExamFilters.some((filterId) => {
        const f = filterId.toLowerCase().trim();
        return testName === f || testName.includes(f) || f.includes(testName);
      });
    });
  }, [tests, selectedExamFilters]);

  const averagePercentage = useMemo(() => {
    if (filteredTests.length === 0) return 0;
    const totalMax = filteredTests.reduce((acc, curr) => acc + curr.max_marks, 0);
    const totalObtained = filteredTests.reduce((acc, curr) => acc + curr.obtained_marks, 0);
    return totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
  }, [filteredTests]);

  const trendData = useMemo(() => {
    return [...filteredTests]
      .filter((t) => t.exam_date)
      .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())
      .map((t) => ({
        date: formatDisplayDate(t.exam_date, { day: "numeric", month: "short" }),
        accuracy: Math.round((t.obtained_marks / t.max_marks) * 100),
        name: t.exam_name,
      }));
  }, [filteredTests]);

  const subjectData = useMemo(() => {
    const subjectsMap: Record<string, { totalObtained: number; totalMax: number }> = {};
    filteredTests.forEach((t) => {
      subjectsMap[t.subject] = subjectsMap[t.subject] || { totalObtained: 0, totalMax: 0 };
      subjectsMap[t.subject].totalObtained += t.obtained_marks;
      subjectsMap[t.subject].totalMax += t.max_marks;
    });
    return Object.entries(subjectsMap).map(([subj, data]) => ({
      subject: subj,
      accuracy: data.totalMax > 0 ? Math.round((data.totalObtained / data.totalMax) * 100) : 0,
    }));
  }, [filteredTests]);

  return (
    <div className="tests-tab">
      <style>{`
        .tests-tab {
          width: 100%;
        }

        .tab-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .tab-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .summary-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .summary-label {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .summary-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .add-test-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1.5px solid var(--border-color);
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-sm);
        }

        @media (max-width: 480px) {
          .add-test-card {
            padding: 16px;
          }
        }

        .add-test-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .add-test-header h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .file-upload-box {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-sm);
          padding: 12px 14px;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          transition: all 0.15s ease;
          flex-wrap: wrap;
        }

        .file-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--brand-600);
        }

        .test-th {
          background: var(--bg-tertiary);
          padding: 12px 18px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: left;
        }

        .test-tr {
          border-bottom: 1px solid var(--border-color);
          transition: background 0.15s ease;
        }

        .test-tr:last-child {
          border-bottom: none;
        }

        .test-tr:hover {
          background: var(--bg-tertiary);
        }

        .test-td {
          padding: 14px 18px;
          font-size: 13px;
          color: var(--text-primary);
          vertical-align: middle;
        }

        .test-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .test-badge.school {
          background: var(--info-light);
          color: var(--info);
        }

        .test-badge.tuition {
          background: var(--brand-50);
          color: var(--brand-600);
        }

        .score-display {
          font-weight: 700;
          color: var(--text-primary);
        }

        .percentage-display {
          font-size: 11px;
          color: var(--text-tertiary);
          margin-top: 2px;
        }

        .paper-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          color: var(--brand-600);
          background: var(--brand-50);
          padding: 4px 8px;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.15s ease;
          border: none;
          cursor: pointer;
        }

        .paper-link-btn:hover {
          background: var(--brand-100);
        }

        .paper-link-btn.answer {
          color: var(--success);
          background: var(--success-light);
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

      <div className="tab-header" style={{ position: "relative" }}>
        <div>
          <h2>Exam Marks & Progress</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Track scores, compare performance across terms, and manage exam papers
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="filter-toggle-btn"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 600,
                background: selectedExamFilters.length > 0 ? "var(--brand-500)" : "var(--card-bg)",
                color: selectedExamFilters.length > 0 ? "#ffffff" : "var(--text-primary)",
                border: "1.5px solid",
                borderColor: selectedExamFilters.length > 0 ? "var(--brand-600)" : "var(--border-color)",
                cursor: "pointer",
                boxShadow: "var(--shadow-xs)",
                transition: "all 0.15s ease",
              }}
            >
              <Filter size={15} />
              SELECT TERM / EXAM {selectedExamFilters.length > 0 && `(${selectedExamFilters.length})`}
              <ChevronDown size={14} style={{ transform: showFilterPanel ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {/* Click-outside backdrop */}
            {showFilterPanel && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 99,
                }}
                onClick={() => setShowFilterPanel(false)}
              />
            )}

            {/* ─── Multi-Select Filter Floating Popover ─── */}
            {showFilterPanel && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 100,
                  width: 300,
                  background: "var(--card-bg)",
                  border: "1.5px solid var(--border-color)",
                  borderRadius: "var(--radius)",
                  padding: "16px",
                  boxShadow: "var(--shadow-xl)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border-color)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                    SELECT TERM / EXAM
                  </span>
                  {selectedExamFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedExamFilters([])}
                      style={{ fontSize: 11, color: "var(--brand-500)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                  {availableFilterOptions.map((term) => {
                    const isSelected = selectedExamFilters.includes(term.id);
                    return (
                      <div
                        key={term.id}
                        onClick={() => toggleFilter(term.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: isSelected ? term.bg : "var(--bg-tertiary)",
                          border: `1.5px solid ${isSelected ? term.border : "transparent"}`,
                          cursor: "pointer",
                          userSelect: "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: term.color,
                            cursor: "pointer",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: term.color,
                            letterSpacing: 0.3,
                          }}
                        >
                          {term.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {!showAddForm && (
            <button className="add-btn" onClick={() => setShowAddForm(true)} id="add-test-btn">
              <Plus size={16} />
              Log Test Marks
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {selectedExamFilters.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>Active Filters:</span>
          {selectedExamFilters.map((id) => {
            const item = availableFilterOptions.find((o) => o.id === id);
            return (
              <span
                key={id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  color: item?.color || "var(--brand-500)",
                  background: item?.bg || "var(--brand-50)",
                  border: `1px solid ${item?.border || "var(--border-color)"}`,
                }}
              >
                {item?.label || id}
                <X
                  size={12}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleFilter(id)}
                />
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedExamFilters([])}
            style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      {filteredTests.length > 0 && (
        <div className="stats-row">
          <div className="summary-card">
            <div>
              <div className="summary-value">{filteredTests.length}</div>
              <div className="summary-label">
                {selectedExamFilters.length > 0 ? "Filtered Tests" : "Total Tests Logged"}
              </div>
            </div>
            <div className="summary-icon" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}>
              <BookOpen size={18} />
            </div>
          </div>

          <div className="summary-card">
            <div>
              <div className="summary-value">{averagePercentage}%</div>
              <div className="summary-label">Average Accuracy / Score</div>
            </div>
            <div className="summary-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}>
              <TrendingUp size={18} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Progress Charts ─── */}
      {filteredTests.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
          {/* Score Trend Line Chart */}
          <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius)", border: "1px solid var(--border-color)", padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Score Trend Over Time (%)</h3>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ left: -20, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any, name: any, props: any) => [`${value}% Accuracy`, props.payload.name]}
                  />
                  <Line type="monotone" dataKey="accuracy" stroke="var(--brand-500)" strokeWidth={2.5} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Average Bar Chart */}
          <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius)", border: "1px solid var(--border-color)", padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Subject Performance Breakdown (%)</h3>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} margin={{ left: -20, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="subject" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any) => [`${value}% Avg Accuracy`]}
                  />
                  <Bar dataKey="accuracy" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Test Form ─── */}
      {showAddForm && (
        <div className="add-test-card">
          <div className="add-test-header">
            <h3>{editingTestId ? "Edit Exam / Test Score" : "Log Exam Score"}</h3>
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
              if (editingTestId) {
                updateMutation.mutate();
              } else {
                addMutation.mutate();
              }
            }}
          >
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="test-subj">Subject *</label>
                <input
                  id="test-subj"
                  className="form-input"
                  placeholder="e.g. Mathematics, Science"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="test-date">Exam Date</label>
                <input
                  id="test-date"
                  type="date"
                  className="form-input"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="test-name">Exam Name *</label>
                <input
                  id="test-name"
                  className="form-input"
                  placeholder="e.g. Mid-Term Exam, Mock Test 3"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="test-type">Exam Type</label>
                <select
                  id="test-type"
                  className="filter-select"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as any)}
                >
                  <option value="tuition">Tuition Center Test</option>
                  <option value="school">School / Board Exam</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="test-obtained">Obtained Marks *</label>
                <input
                  id="test-obtained"
                  type="number"
                  step="0.5"
                  className="form-input"
                  placeholder="e.g. 42.5"
                  value={obtainedMarks}
                  onChange={(e) => setObtainedMarks(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="test-max">Max Marks *</label>
                <input
                  id="test-max"
                  type="number"
                  step="1"
                  className="form-input"
                  placeholder="e.g. 50"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* ─── Question Paper & Answer Paper Uploads ─── */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  📄 Upload Question Paper (PDF, JPG, PNG)
                </label>
                <div className="file-upload-box">
                  {questionPaperName ? (
                    <div className="file-chip">
                      {isImageAttachment(questionPaperUrl, questionPaperName) ? <ImageIcon size={14} /> : <FileText size={14} />}
                      <span>{questionPaperName}</span>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                        onClick={() => {
                          setQuestionPaperName("");
                          setQuestionPaperUrl("");
                          if (qPaperInputRef.current) qPaperInputRef.current.value = "";
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Select question paper file</span>
                  )}
                  <label htmlFor="q-paper-input" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-600)", cursor: "pointer", padding: "6px 10px", background: "var(--card-bg)", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                    {questionPaperName ? "Change" : "Browse File"}
                  </label>
                  <input
                    id="q-paper-input"
                    ref={qPaperInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileUpload(e, setQuestionPaperName, setQuestionPaperUrl)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  📝 Upload Answer Sheet / Script (PDF, JPG, PNG)
                </label>
                <div className="file-upload-box">
                  {answerPaperName ? (
                    <div className="file-chip" style={{ color: "var(--success)", borderColor: "var(--border-color)" }}>
                      {isImageAttachment(answerPaperUrl, answerPaperName) ? <ImageIcon size={14} /> : <FileText size={14} />}
                      <span>{answerPaperName}</span>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                        onClick={() => {
                          setAnswerPaperName("");
                          setAnswerPaperUrl("");
                          if (aPaperInputRef.current) aPaperInputRef.current.value = "";
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Select evaluated answer sheet</span>
                  )}
                  <label htmlFor="a-paper-input" style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", cursor: "pointer", padding: "6px 10px", background: "var(--card-bg)", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                    {answerPaperName ? "Change" : "Browse File"}
                  </label>
                  <input
                    id="a-paper-input"
                    ref={aPaperInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileUpload(e, setAnswerPaperName, setAnswerPaperUrl)}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="test-remarks">Remarks / Suggestions</label>
              <textarea
                id="test-remarks"
                className="notes-textarea"
                placeholder="Write recommendations, focus areas, or student performance notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
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
                disabled={
                  addMutation.isPending ||
                  updateMutation.isPending ||
                  !subject ||
                  !examName ||
                  !obtainedMarks ||
                  !maxMarks
                }
                id="submit-test-btn"
              >
                {editingTestId
                  ? updateMutation.isPending
                    ? "Saving..."
                    : "Save Changes"
                  : addMutation.isPending
                  ? "Logging..."
                  : "Log Score"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Table ─── */}
      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading exams and test marks...
        </div>
      ) : filteredTests.length > 0 ? (
        <div className="table-responsive">
          <table className="tests-table">
            <thead>
              <tr>
                <th className="test-th">Exam details</th>
                <th className="test-th">Subject</th>
                <th className="test-th">Type</th>
                <th className="test-th">Marks</th>
                <th className="test-th">Uploaded Papers</th>
                <th className="test-th">Date</th>
                <th className="test-th" style={{ textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.map((test) => {
                const pct = Math.round((test.obtained_marks / test.max_marks) * 100);
                return (
                  <tr key={test.id} className="test-tr" id={`test-row-${test.id}`}>
                    <td className="test-td" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {test.exam_name}
                      {test.remarks && (
                        <p style={{ fontStyle: "italic", fontWeight: 400, color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
                          &ldquo;{test.remarks}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="test-td">{test.subject}</td>
                    <td className="test-td">
                      <span className={`test-badge ${test.exam_type}`}>
                        {test.exam_type}
                      </span>
                    </td>
                    <td className="test-td">
                      <div className="score-display">
                        {test.obtained_marks} / {test.max_marks}
                      </div>
                      <div className="percentage-display">{pct}% Accuracy</div>
                    </td>

                    <td className="test-td">
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {test.question_paper_url ? (
                          <button
                            type="button"
                            className="paper-link-btn"
                            onClick={() => {
                              setPreviewModalFile({
                                url: test.question_paper_url!,
                                name: test.question_paper_name || "question_paper.pdf",
                                title: `Question Paper: ${test.exam_name} (${test.subject})`,
                              });
                            }}
                          >
                            <Eye size={12} />
                            Question Paper {isPdfFile(test.question_paper_url, test.question_paper_name) ? "(PDF)" : ""}
                          </button>
                        ) : null}

                        {test.answer_paper_url ? (
                          <button
                            type="button"
                            className="paper-link-btn answer"
                            onClick={() => {
                              setPreviewModalFile({
                                url: test.answer_paper_url!,
                                name: test.answer_paper_name || "answer_sheet.pdf",
                                title: `Answer Sheet: ${test.exam_name} (${test.subject})`,
                              });
                            }}
                          >
                            <Eye size={12} />
                            Answer Sheet {isPdfFile(test.answer_paper_url, test.answer_paper_name) ? "(PDF)" : ""}
                          </button>
                        ) : null}

                        {!test.question_paper_url && !test.answer_paper_url && (
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>None</span>
                        )}
                      </div>
                    </td>

                    <td className="test-td">
                      {test.exam_date ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={13} style={{ color: "var(--text-tertiary)" }} />
                          <span>
                            {formatDisplayDate(test.exam_date, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="test-td" style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="card-action-btn"
                          onClick={() => handleStartEdit(test)}
                          title="Edit test record"
                          id={`test-edit-${test.id}`}
                          type="button"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="card-action-btn danger"
                          onClick={() => deleteMutation.mutate(test.id)}
                          title="Delete test record"
                          id={`test-delete-${test.id}`}
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
            <Award size={24} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
            No test scores logged
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto" }}>
            Log mock tests, board exams, upload question papers and answer sheets to track student accuracy.
          </p>
        </div>
      )}

      {/* Paper Preview Modal */}
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
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="paper-link-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "none",
                    background: "var(--brand-500)",
                    color: "#ffffff",
                  }}
                >
                  <Download size={14} />
                  Download
                </button>
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
                  src={getFileUrl(previewModalFile.url)}
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
