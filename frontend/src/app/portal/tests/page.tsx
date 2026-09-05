"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Calendar,
  TrendingUp,
  BookOpen,
  ExternalLink,
  Download,
  Eye,
  X,
  Filter,
  ChevronDown,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
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
import { portalApi } from "@/lib/portal-api";
import { formatDisplayDate } from "@/lib/date-utils";

const PREDEFINED_TERMS = [
  { id: "SEM1", label: "SEM1", color: "#818cf8", bg: "rgba(99, 102, 241, 0.12)", border: "rgba(99, 102, 241, 0.4)" },
  { id: "SEM2", label: "SEM2", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.4)" },
  { id: "UNIT TEST I", label: "UNIT TEST I", color: "#fb923c", bg: "rgba(251, 146, 60, 0.12)", border: "rgba(251, 146, 60, 0.4)" },
  { id: "UNIT TEST II", label: "UNIT TEST II", color: "#c084fc", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.4)" },
  { id: "UNIT TEST III", label: "UNIT TEST III", color: "#f472b6", bg: "rgba(244, 114, 182, 0.12)", border: "rgba(244, 114, 182, 0.4)" },
  { id: "CLASS TEST", label: "CLASS TEST", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.4)" },
];

export default function StudentTestsPage() {
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

  // Filter State
  const [selectedExamFilters, setSelectedExamFilters] = useState<string[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["portal-tests"],
    queryFn: () => portalApi.getTests(),
    select: (res) => res.data,
  });

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
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <style>{`
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

      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "relative" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Exams & Test Marks</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>View your exam score card logs, averages, and learning curves</p>
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
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

      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading exam logs...
        </div>
      ) : filteredTests.length > 0 ? (
        <>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius)", border: "1px solid var(--border-color)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{filteredTests.length}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                  {selectedExamFilters.length > 0 ? "Filtered Tests" : "Total Tests Recorded"}
                </div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--brand-50)", color: "var(--brand-600)" }}>
                <BookOpen size={18} />
              </div>
            </div>

            <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius)", border: "1px solid var(--border-color)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{averagePercentage}%</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Average Accuracy</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--success-light)", color: "var(--success)" }}>
                <TrendingUp size={18} />
              </div>
            </div>
          </div>

          {/* Recharts Graphs */}
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

          {/* Marks Table */}
          <div className="table-responsive">
            <table style={{ width: "100%", minWidth: 750, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>Exam details</th>
                  <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>Subject</th>
                  <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>Type</th>
                  <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>Marks</th>
                  <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>Uploaded Papers</th>
                  <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test) => {
                  const pct = Math.round((test.obtained_marks / test.max_marks) * 100);
                  return (
                    <tr key={test.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s ease" }}>
                      <td style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                        {test.exam_name}
                        {test.remarks && (
                          <p style={{ fontStyle: "italic", fontWeight: 400, color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
                            &ldquo;{test.remarks}&rdquo;
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-primary)" }}>{test.subject}</td>
                      <td style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-primary)" }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 4,
                          textTransform: "uppercase",
                          background: test.exam_type === "school" ? "var(--info-light)" : "var(--brand-50)",
                          color: test.exam_type === "school" ? "var(--info)" : "var(--brand-600)"
                        }}>
                          {test.exam_type}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-primary)" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{test.obtained_marks} / {test.max_marks}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{pct}% Accuracy</div>
                      </td>

                      <td style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-primary)" }}>
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

                      <td style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-primary)" }}>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
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
            No test scores recorded
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto" }}>
            When your tutor logs your center test scores or board exams, they will show up here.
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
                <a
                  href={previewModalFile.url}
                  download={previewModalFile.name}
                  className="paper-link-btn"
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
