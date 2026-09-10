"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Printer,
  Download,
  X,
  Sparkles,
  Calendar,
  User,
  Info,
} from "lucide-react";
import {
  markdownToHtml,
  exportPlanToPrintablePDF,
  downloadPlanAsMarkdown,
} from "@/lib/plan-pdf-export";
import { AIPlan } from "@/lib/academic-api";

interface PlanPDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: AIPlan | null;
  studentName?: string;
}

export function PlanPDFPreviewModal({
  isOpen,
  onClose,
  plan,
  studentName,
}: PlanPDFPreviewModalProps) {
  const planText = plan?.edited_plan || plan?.generated_plan || "";

  const renderedHtml = useMemo(() => {
    return markdownToHtml(planText);
  }, [planText]);

  if (!isOpen || !plan) return null;

  const handlePrint = () => {
    exportPlanToPrintablePDF({
      planText,
      planDate: plan.plan_date,
      studentName,
      createdAt: plan.created_at,
    });
  };

  const handleDownloadMarkdown = () => {
    downloadPlanAsMarkdown(planText, studentName, plan.plan_date);
  };

  return (
    <div
      key="plan-pdf-preview-backdrop"
      style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(6px)",
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
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "900px",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-subtle)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface-hover)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={20} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Lesson Plan PDF Preview
                </h3>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {studentName && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <User size={12} /> {studentName}
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} /> Target: {plan.plan_date}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={handlePrint}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "var(--brand-600, #6366f1)",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(99, 102, 241, 0.2)",
                  transition: "all 0.15s ease",
                }}
                id="modal-print-pdf-btn"
              >
                <Printer size={15} /> Save as PDF / Print
              </button>

              <button
                onClick={handleDownloadMarkdown}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: "var(--surface)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                title="Download raw Markdown file"
              >
                <Download size={14} /> .md
              </button>

              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Preview Body */}
          <div
            style={{
              padding: "24px",
              overflowY: "auto",
              flex: 1,
              backgroundColor: "var(--bg-app, #f8fafc)",
            }}
          >
            {/* Paper Container */}
            <div
              style={{
                maxWidth: "760px",
                margin: "0 auto",
                backgroundColor: "#ffffff",
                color: "#1e293b",
                padding: "36px 44px",
                borderRadius: "8px",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.06)",
                border: "1px solid #e2e8f0",
              }}
            >
              {/* Document Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "2px solid #6366f1",
                  paddingBottom: 14,
                  marginBottom: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#4f46e5",
                      letterSpacing: -0.5,
                    }}
                  >
                    StudyVerse
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginTop: 2,
                    }}
                  >
                    AI Personal Study Plan & Pedagogical Guide
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: 12,
                    color: "#475569",
                  }}
                >
                  <div>
                    Student: <strong>{studentName || "Student Plan"}</strong>
                  </div>
                  <div>
                    Target Date: <strong>{plan.plan_date}</strong>
                  </div>
                </div>
              </div>

              {/* Rendered HTML content */}
              <div
                className="plan-html-preview"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          </div>

          {/* Modal Footer Banner */}
          <div
            style={{
              padding: "12px 24px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface)",
              fontSize: 12,
              color: "var(--text-tertiary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Info size={14} style={{ color: "var(--brand-600)" }} />
              <span>
                To download as PDF, click <strong>Save as PDF / Print</strong> and choose <em>Save as PDF</em> in the printer destination.
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: 12,
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              Close Preview
            </button>
          </div>
        </motion.div>

        <style jsx global>{`
        .plan-html-preview .pdf-h1 {
          font-size: 19px;
          font-weight: 800;
          color: #1e1b4b;
          margin: 18px 0 10px;
          border-bottom: 1.5px solid #e0e7ff;
          padding-bottom: 6px;
        }
        .plan-html-preview .pdf-h2 {
          font-size: 15px;
          font-weight: 700;
          color: #312e81;
          margin: 18px 0 8px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
        .plan-html-preview .pdf-h3 {
          font-size: 13.5px;
          font-weight: 700;
          color: #4338ca;
          margin: 14px 0 6px;
        }
        .plan-html-preview .pdf-h3-day {
          font-size: 13.5px;
          font-weight: 700;
          color: #1e1b4b;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .plan-html-preview .pdf-day-pill {
          background: #6366f1;
          color: white;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .plan-html-preview .pdf-day-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #6366f1;
          border-radius: 0 6px 6px 0;
          padding: 12px 14px;
          margin: 12px 0 16px;
        }
        .plan-html-preview .pdf-p {
          font-size: 12.5px;
          color: #334155;
          margin-bottom: 8px;
          line-height: 1.6;
        }
        .plan-html-preview .pdf-quote {
          border-left: 3px solid #cbd5e1;
          padding-left: 10px;
          margin: 8px 0;
          font-style: italic;
          color: #64748b;
        }
        .plan-html-preview .pdf-hr {
          border: 0;
          border-top: 1px solid #e2e8f0;
          margin: 16px 0;
        }
        .plan-html-preview .pdf-ul,
        .plan-html-preview .pdf-ol {
          margin-left: 18px;
          margin-bottom: 8px;
          font-size: 12.5px;
          color: #334155;
        }
        .plan-html-preview .pdf-ul li,
        .plan-html-preview .pdf-ol li {
          margin-bottom: 4px;
        }
        .plan-html-preview .pdf-table-wrapper {
          margin: 12px 0;
          overflow-x: auto;
        }
        .plan-html-preview .pdf-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .plan-html-preview .pdf-table th {
          background: #f1f5f9;
          color: #1e293b;
          font-weight: 700;
          text-align: left;
          padding: 7px 10px;
          border: 1px solid #cbd5e1;
        }
        .plan-html-preview .pdf-table td {
          padding: 7px 10px;
          border: 1px solid #e2e8f0;
          color: #334155;
        }
        .plan-html-preview .pdf-table tr:nth-child(even) {
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}
