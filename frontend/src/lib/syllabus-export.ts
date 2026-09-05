import { Syllabus } from "./academic-api";

export interface ExportOptions {
  includeProgress: boolean;
  studentName?: string;
  subjectFilter?: string; // "all" or specific subject
}

/**
 * Escapes a string for CSV formatting.
 */
function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes("\"") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports syllabus to CSV with or without progress.
 */
export function exportSyllabusToCSV(
  syllabusList: Syllabus[],
  options: ExportOptions
) {
  const { includeProgress, studentName, subjectFilter } = options;

  let items = syllabusList;
  if (subjectFilter && subjectFilter !== "all") {
    items = items.filter((item) => item.subject.toLowerCase() === subjectFilter.toLowerCase());
  }

  // Define headers
  const headers = includeProgress
    ? ["Subject", "Chapter Name", "Chapter Type", "Term / Exam", "Status", "Progress (%)"]
    : ["Subject", "Chapter Name", "Chapter Type", "Term / Exam"];

  const rows: string[] = [];
  rows.push(headers.join(","));

  for (const item of items) {
    const row = [
      escapeCSV(item.subject),
      escapeCSV(item.chapter),
      escapeCSV(item.chapter_type || ""),
      escapeCSV(item.term || ""),
    ];

    if (includeProgress) {
      row.push(escapeCSV(item.status));
      row.push(escapeCSV(`${item.progress}%`));
    }

    rows.push(row.join(","));
  }

  const csvContent = rows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const cleanName = (studentName || "student").replace(/[^a-zA-Z0-9_-]/g, "_");
  const progressTag = includeProgress ? "with_progress" : "curriculum_plan";
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `syllabus_${cleanName}_${progressTag}_${dateStr}.csv`;

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print-ready formatted document for saving as PDF or printing.
 */
export function exportSyllabusToPrintablePDF(
  syllabusList: Syllabus[],
  options: ExportOptions
) {
  const { includeProgress, studentName, subjectFilter } = options;

  let items = syllabusList;
  if (subjectFilter && subjectFilter !== "all") {
    items = items.filter((item) => item.subject.toLowerCase() === subjectFilter.toLowerCase());
  }

  // Group by subject
  const grouped: Record<string, Syllabus[]> = {};
  for (const item of items) {
    grouped[item.subject] = grouped[item.subject] || [];
    grouped[item.subject].push(item);
  }

  const subjects = Object.keys(grouped);
  const totalChapters = items.length;
  const completedChapters = items.filter((i) => i.status === "completed").length;
  const overallProgress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups to print or save the syllabus as PDF.");
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>StudyVerse Syllabus - ${studentName || "Curriculum"}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      padding: 32px 40px;
      color: #1e293b;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #6366f1;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .meta-info {
      text-align: right;
      font-size: 12px;
      color: #64748b;
    }
    .meta-info strong {
      color: #1e293b;
      font-size: 13px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
    }
    .summary-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }
    .summary-val {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .subject-section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .subject-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #eef2ff;
      border-left: 4px solid #6366f1;
      padding: 8px 14px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 10px;
    }
    .subject-title {
      font-size: 15px;
      font-weight: 700;
      color: #312e81;
    }
    .subject-progress {
      font-size: 12px;
      font-weight: 700;
      color: #4f46e5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1.5px solid #cbd5e1;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12.5px;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: capitalize;
    }
    .badge-story { background: #d1fae5; color: #065f46; }
    .badge-poem { background: #f3e8ff; color: #6b21a8; }
    .badge-chapter { background: #dbeafe; color: #1e40af; }
    .badge-grammar { background: #fef3c7; color: #92400e; }
    .badge-other { background: #ffe4e6; color: #9f1239; }

    .status-completed { color: #059669; font-weight: 700; }
    .status-teaching { color: #2563eb; font-weight: 600; }
    .status-revision { color: #d97706; font-weight: 600; }
    .status-pending { color: #64748b; }

    .footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body {
        padding: 16px 20px;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">StudyVerse</div>
      <div class="brand-subtitle">Curriculum & Syllabus Report</div>
    </div>
    <div class="meta-info">
      <div>Student: <strong>${studentName || "All Students"}</strong></div>
      <div>Date: <strong>${exportDate}</strong></div>
      ${subjectFilter && subjectFilter !== "all" ? `<div>Subject: <strong>${subjectFilter}</strong></div>` : ""}
    </div>
  </div>

  ${includeProgress ? `
    <div class="summary-card">
      <div class="summary-item">
        <span class="summary-label">Total Subjects</span>
        <span class="summary-val">${subjects.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Chapters</span>
        <span class="summary-val">${totalChapters}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Completed</span>
        <span class="summary-val">${completedChapters} / ${totalChapters}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Overall Completion</span>
        <span class="summary-val" style="color: #4f46e5;">${overallProgress}%</span>
      </div>
    </div>
  ` : `
    <div class="summary-card">
      <div class="summary-item">
        <span class="summary-label">Total Subjects</span>
        <span class="summary-val">${subjects.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Chapters</span>
        <span class="summary-val">${totalChapters}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Scope</span>
        <span class="summary-val">Curriculum Outline</span>
      </div>
    </div>
  `}

  ${subjects.map((subj) => {
    const chapList = grouped[subj];
    const subjCompleted = chapList.filter((c) => c.status === "completed").length;
    const subjProgress = chapList.length > 0 ? Math.round((subjCompleted / chapList.length) * 100) : 0;

    return `
      <div class="subject-section">
        <div class="subject-header">
          <span class="subject-title">${subj}</span>
          ${includeProgress ? `<span class="subject-progress">${subjProgress}% Complete (${subjCompleted}/${chapList.length})</span>` : `<span class="subject-progress">${chapList.length} Chapters</span>`}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Chapter / Topic</th>
              <th style="width: 110px;">Type</th>
              <th style="width: 140px;">Term / Exam</th>
              ${includeProgress ? `
                <th style="width: 100px;">Status</th>
                <th style="width: 90px; text-align: right;">Progress</th>
              ` : ""}
            </tr>
          </thead>
          <tbody>
            ${chapList.map((chap, idx) => {
              const typeClass = chap.chapter_type ? `badge-${chap.chapter_type.toLowerCase()}` : "badge-chapter";
              return `
                <tr>
                  <td style="color: #94a3b8; font-weight: 600;">${idx + 1}</td>
                  <td style="font-weight: 600; color: #1e293b;">${chap.chapter}</td>
                  <td>
                    ${chap.chapter_type ? `<span class="badge ${typeClass}">${chap.chapter_type}</span>` : "—"}
                  </td>
                  <td>${chap.term || "—"}</td>
                  ${includeProgress ? `
                    <td><span class="status-${chap.status}">${chap.status.toUpperCase()}</span></td>
                    <td style="text-align: right; font-weight: 700; color: #4f46e5;">${chap.progress}%</td>
                  ` : ""}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }).join("")}

  <div class="footer">
    <span>Generated by StudyVerse Academic Portal</span>
    <span>Page 1 of 1</span>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
