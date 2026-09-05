"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileSpreadsheet,
  Printer,
  X,
  CheckCircle2,
  ListFilter,
  Layers,
} from "lucide-react";
import { Syllabus } from "@/lib/academic-api";
import { exportSyllabusToCSV, exportSyllabusToPrintablePDF } from "@/lib/syllabus-export";

interface SyllabusExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  syllabusList: Syllabus[];
  studentName?: string;
}

export function SyllabusExportModal({
  isOpen,
  onClose,
  syllabusList,
  studentName,
}: SyllabusExportModalProps) {
  const [includeProgress, setIncludeProgress] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  if (!isOpen) return null;

  // Extract unique subjects
  const availableSubjects = Array.from(new Set(syllabusList.map((item) => item.subject)));

  const filteredCount =
    selectedSubject === "all"
      ? syllabusList.length
      : syllabusList.filter((s) => s.subject === selectedSubject).length;

  const handleExportCSV = () => {
    exportSyllabusToCSV(syllabusList, {
      includeProgress,
      studentName,
      subjectFilter: selectedSubject,
    });
    onClose();
  };

  const handleExportPDF = () => {
    exportSyllabusToPrintablePDF(syllabusList, {
      includeProgress,
      studentName,
      subjectFilter: selectedSubject,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg, 14px)",
          border: "1px solid var(--border-color)",
          width: "100%",
          maxWidth: 520,
          boxShadow: "var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.3))",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-tertiary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--brand-50, #eef2ff)",
                color: "var(--brand-600, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Download size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                Export Syllabus
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {studentName ? `For ${studentName}` : "Download curriculum report"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              padding: 6,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "22px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Progress Option Selector */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 10,
              }}
            >
              Progress Details
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {/* With Progress Card */}
              <div
                onClick={() => setIncludeProgress(true)}
                style={{
                  padding: "14px",
                  borderRadius: 10,
                  border: `2px solid ${includeProgress ? "var(--brand-500, #6366f1)" : "var(--border-color)"}`,
                  background: includeProgress ? "var(--brand-50, rgba(99, 102, 241, 0.08))" : "var(--bg-tertiary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: includeProgress ? "var(--brand-600, #4f46e5)" : "var(--text-primary)" }}>
                    With Progress %
                  </span>
                  {includeProgress && <CheckCircle2 size={16} style={{ color: "var(--brand-600, #4f46e5)" }} />}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  Includes status, progress bars, and completion percentages.
                </span>
              </div>

              {/* Without Progress Card */}
              <div
                onClick={() => setIncludeProgress(false)}
                style={{
                  padding: "14px",
                  borderRadius: 10,
                  border: `2px solid ${!includeProgress ? "var(--brand-500, #6366f1)" : "var(--border-color)"}`,
                  background: !includeProgress ? "var(--brand-50, rgba(99, 102, 241, 0.08))" : "var(--bg-tertiary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: !includeProgress ? "var(--brand-600, #4f46e5)" : "var(--text-primary)" }}>
                    Without Progress
                  </span>
                  {!includeProgress && <CheckCircle2 size={16} style={{ color: "var(--brand-600, #4f46e5)" }} />}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  Clean curriculum plan without any completion status.
                </span>
              </div>
            </div>
          </div>

          {/* Subject Filter */}
          {availableSubjects.length > 1 && (
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 8,
                }}
              >
                <ListFilter size={13} />
                Subject Filter
              </label>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1.5px solid var(--border-color)",
                  background: "var(--card-bg)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  fontWeight: 600,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Subjects ({syllabusList.length} chapters)</option>
                {availableSubjects.map((subj) => {
                  const cnt = syllabusList.filter((s) => s.subject === subj).length;
                  return (
                    <option key={subj} value={subj}>
                      {subj} ({cnt} chapters)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Chapters Count Badge */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--bg-tertiary)",
              borderRadius: 8,
              fontSize: 12.5,
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Layers size={15} style={{ color: "var(--brand-500)" }} />
            <span>
              Ready to export: <strong>{filteredCount} chapters</strong> across{" "}
              <strong>{selectedSubject === "all" ? availableSubjects.length : 1} subject(s)</strong>
            </span>
          </div>

          {/* Export Action Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            <button
              onClick={handleExportCSV}
              disabled={syllabusList.length === 0}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 8,
                border: "1.5px solid #059669",
                background: "#ecfdf5",
                color: "#047857",
                fontSize: 13,
                fontWeight: 700,
                cursor: syllabusList.length === 0 ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <FileSpreadsheet size={16} />
              Export as CSV
            </button>

            <button
              onClick={handleExportPDF}
              disabled={syllabusList.length === 0}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--brand-600, #4f46e5)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: syllabusList.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <Printer size={16} />
              Print / Save PDF
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
