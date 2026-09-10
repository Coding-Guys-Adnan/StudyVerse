/**
 * StudyVerse AI Lesson Plan PDF Exporter
 * Converts Markdown plans into print-ready, high-resolution PDFs
 * supporting full UTF-8, tables, lists, Devanagari/Hindi fonts, and brand styling.
 */

export interface PlanPDFOptions {
  planText: string;
  planDate: string;
  studentName?: string;
  createdAt?: string;
}

/**
 * Parses markdown table rows into an HTML table string.
 */
function convertMarkdownTable(rows: string[]): string {
  if (rows.length < 2) return rows.join("\n");
  const parseRow = (r: string) =>
    r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headerCells = parseRow(rows[0]);
  const isSeparator = (r: string) => /^[|\s-:]+$/.test(r);

  let dataStart = 1;
  if (rows.length > 1 && isSeparator(rows[1])) {
    dataStart = 2;
  }

  let html = '<div class="pdf-table-wrapper"><table class="pdf-table"><thead><tr>';
  for (const c of headerCells) {
    html += `<th>${c}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (let i = dataStart; i < rows.length; i++) {
    const cells = parseRow(rows[i]);
    html += "<tr>";
    for (const c of cells) {
      html += `<td>${c}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  return html;
}

/**
 * Converts Markdown text into semantic, beautifully styled HTML.
 */
export function markdownToHtml(md: string): string {
  if (!md) return "";

  // Normalize line breaks
  let text = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Escape HTML entities to prevent malformed tags while preserving intentional quotes
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Process markdown tables
  const lines = text.split("\n");
  const processedLines: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
    } else {
      if (inTable) {
        processedLines.push(convertMarkdownTable(tableRows));
        inTable = false;
        tableRows = [];
      }
      processedLines.push(lines[i]);
    }
  }
  if (inTable) {
    processedLines.push(convertMarkdownTable(tableRows));
  }

  text = processedLines.join("\n");

  // Horizontal rules
  text = text.replace(/^(\s*[-*_]{3,}\s*)$/gm, '<hr class="pdf-hr" />');

  // Headings
  text = text.replace(/^#### (.*?)$/gm, '<h4 class="pdf-h4">$1</h4>');
  text = text.replace(/^### (.*?)$/gm, (match, title) => {
    // Highlight Day headings with special styling
    if (/day\s+\d+/i.test(title)) {
      return `<div class="pdf-day-card"><h3 class="pdf-h3-day"><span class="pdf-day-pill">Session</span> ${title}</h3>`;
    }
    return `<h3 class="pdf-h3">${title}</h3>`;
  });
  text = text.replace(/^## (.*?)$/gm, '<h2 class="pdf-h2">$1</h2>');
  text = text.replace(/^# (.*?)$/gm, '<h1 class="pdf-h1">$1</h1>');

  // Bold and Italics
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Blockquotes
  text = text.replace(/^&gt; (.*?)$/gm, '<blockquote class="pdf-quote">$1</blockquote>');

  // Lists and paragraphs
  const outputLines: string[] = [];
  let inUl = false;
  let inOl = false;
  let openDayCard = false;

  for (const l of text.split("\n")) {
    const trimmed = l.trim();
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);

    if (trimmed.startsWith('<div class="pdf-day-card">')) {
      if (openDayCard) {
        outputLines.push("</div>");
      }
      openDayCard = true;
    } else if (trimmed.startsWith("<hr") || trimmed.startsWith("<h2") || trimmed.startsWith("<h1")) {
      if (openDayCard) {
        outputLines.push("</div>");
        openDayCard = false;
      }
    }

    if (ulMatch) {
      if (inOl) {
        outputLines.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        outputLines.push('<ul class="pdf-ul">');
        inUl = true;
      }
      outputLines.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) {
        outputLines.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        outputLines.push('<ol class="pdf-ol">');
        inOl = true;
      }
      outputLines.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) {
        outputLines.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        outputLines.push("</ol>");
        inOl = false;
      }
      if (
        trimmed.length > 0 &&
        !trimmed.startsWith("<h") &&
        !trimmed.startsWith("<hr") &&
        !trimmed.startsWith("<div") &&
        !trimmed.startsWith("</div") &&
        !trimmed.startsWith("<table") &&
        !trimmed.startsWith("<blockquote")
      ) {
        outputLines.push(`<p class="pdf-p">${trimmed}</p>`);
      } else {
        outputLines.push(trimmed);
      }
    }
  }
  if (inUl) outputLines.push("</ul>");
  if (inOl) outputLines.push("</ol>");
  if (openDayCard) outputLines.push("</div>");

  return outputLines.join("\n");
}

/**
 * Opens a dedicated, professionally formatted print dialog window
 * that can be directly saved as PDF or printed.
 */
export function exportPlanToPrintablePDF({
  planText,
  planDate,
  studentName,
  createdAt,
}: PlanPDFOptions) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups for this site to preview or download the PDF.");
    return;
  }

  const renderedContent = markdownToHtml(planText);

  const formattedCreatedDate = createdAt
    ? new Date(
        createdAt.includes("Z") || createdAt.includes("+")
          ? createdAt
          : createdAt + "Z"
      ).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : new Date().toLocaleDateString();

  const formattedPlanDate = new Date(planDate).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const studentDisplay = studentName || "Student Study Plan";

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyVerse Plan - ${studentDisplay} (${formattedPlanDate})</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans Devanagari", sans-serif;
    }
    body {
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.6;
      font-size: 13px;
      padding: 0;
    }
    .pdf-container {
      max-width: 820px;
      margin: 24px auto;
      background: #ffffff;
      padding: 40px 48px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border-radius: 8px;
    }
    
    /* Top Action Bar (hidden when printing) */
    .top-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #1e1b4b;
      color: white;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .toolbar-title {
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.2px;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-print {
      background: #6366f1;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-print:hover {
      background: #4f46e5;
    }
    .btn-close {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-close:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Document Header */
    .brand-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #6366f1;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-logo {
      font-size: 24px;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: -0.5px;
    }
    .brand-tagline {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 12px;
      color: #475569;
    }
    .meta-box strong {
      color: #0f172a;
    }

    /* Content Styling */
    .pdf-h1 {
      font-size: 20px;
      font-weight: 800;
      color: #1e1b4b;
      margin: 20px 0 12px;
      letter-spacing: -0.3px;
    }
    .pdf-h2 {
      font-size: 16px;
      font-weight: 700;
      color: #312e81;
      margin: 22px 0 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pdf-h3 {
      font-size: 14px;
      font-weight: 700;
      color: #4338ca;
      margin: 14px 0 6px;
    }
    .pdf-h3-day {
      font-size: 14px;
      font-weight: 700;
      color: #1e1b4b;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pdf-day-pill {
      background: #6366f1;
      color: white;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .pdf-day-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #6366f1;
      border-radius: 0 6px 6px 0;
      padding: 14px 16px;
      margin: 14px 0 18px;
      page-break-inside: avoid;
    }
    .pdf-p {
      font-size: 12.5px;
      color: #334155;
      margin-bottom: 8px;
      line-height: 1.6;
    }
    .pdf-quote {
      border-left: 3px solid #cbd5e1;
      padding-left: 12px;
      margin: 10px 0;
      font-style: italic;
      color: #64748b;
    }
    .pdf-hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 18px 0;
    }
    .pdf-ul, .pdf-ol {
      margin-left: 20px;
      margin-bottom: 10px;
      font-size: 12.5px;
      color: #334155;
    }
    .pdf-ul li, .pdf-ol li {
      margin-bottom: 4px;
      line-height: 1.5;
    }
    
    /* Tables */
    .pdf-table-wrapper {
      margin: 14px 0;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    .pdf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .pdf-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      text-align: left;
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
    }
    .pdf-table td {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    .pdf-table tr:nth-child(even) {
      background: #fafafa;
    }

    /* Footer */
    .pdf-footer {
      margin-top: 36px;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }

    /* Print Specific Rules */
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        font-size: 11.5pt;
      }
      .no-print {
        display: none !important;
      }
      .pdf-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .pdf-day-card {
        page-break-inside: avoid;
        border: 1px solid #d1d5db;
        border-left: 4px solid #4f46e5;
      }
      .pdf-table-wrapper {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <!-- Screen Toolbar -->
  <div class="top-toolbar no-print">
    <div class="toolbar-title">
      <span>📚 StudyVerse AI Lesson Plan Export</span>
    </div>
    <div class="toolbar-actions">
      <button class="btn-print" onclick="window.print()">
        🖨️ Save as PDF / Print
      </button>
      <button class="btn-close" onclick="window.close()">
        Close
      </button>
    </div>
  </div>

  <div class="pdf-container">
    <!-- Brand Header -->
    <div class="brand-header">
      <div>
        <div class="brand-logo">StudyVerse</div>
        <div class="brand-tagline">AI Personal Study Plan & Pedagogical Guide</div>
      </div>
      <div class="meta-box">
        <div>Student: <strong>${studentDisplay}</strong></div>
        <div>Target Date: <strong>${formattedPlanDate}</strong></div>
        <div>Generated: <strong>${formattedCreatedDate}</strong></div>
      </div>
    </div>

    <!-- Document Content -->
    <div class="plan-content">
      ${renderedContent}
    </div>

    <!-- Footer -->
    <div class="pdf-footer">
      <span>StudyVerse AI Academic Management Platform</span>
      <span>Confidential Tutor & Student Pedagogical Guide</span>
    </div>
  </div>

  <script>
    // Prompt print dialog after assets load
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Downloads the plan text as a clean markdown file.
 */
export function downloadPlanAsMarkdown(
  planText: string,
  studentName?: string,
  planDate?: string
) {
  const cleanName = (studentName || "student").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStr = planDate || new Date().toISOString().split("T")[0];
  const filename = `StudyVerse_Plan_${cleanName}_${dateStr}.md`;

  const blob = new Blob([planText], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
