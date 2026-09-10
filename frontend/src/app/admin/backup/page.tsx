"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  adminApi,
  BackupStats,
  RestorePreviewResponse,
  ExecuteRestoreResponse,
} from "@/lib/api";
import {
  Database,
  Download,
  Upload,
  HardDrive,
  Archive,
  FileArchive,
  RefreshCw,
  ShieldCheck,
  Server,
  Layers,
  Terminal,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Info,
  FolderArchive,
  Lock,
  ArrowRight,
  RotateCcw,
  XCircle,
  FileUp,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
} from "lucide-react";

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminBackupPage() {
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    title: string;
    description: string;
  } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<boolean>(false);

  // Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidatingUpload, setIsValidatingUpload] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<RestorePreviewResponse | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [replaceConfirmation, setReplaceConfirmation] = useState<string>("");
  const [isExecutingRestore, setIsExecutingRestore] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<ExecuteRestoreResponse | null>(null);
  const [showCliGuide, setShowCliGuide] = useState<boolean>(false);

  const {
    data: stats,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<BackupStats>({
    queryKey: ["admin-backup-stats"],
    queryFn: async () => {
      const res = await adminApi.getBackupStats();
      return res.data;
    },
  });

  const isLocalEnv = stats?.database_type === "sqlite" || stats?.environment === "local";

  const handleDownload = async (type: "full" | "database" | "files") => {
    try {
      setDownloadingType(type);
      setStatusMessage({
        type: "info",
        title: "Generating Archive",
        description: `Exporting and compressing ${type} data. Large archives may take a few seconds...`,
      });

      await adminApi.downloadBackup(type);

      setStatusMessage({
        type: "success",
        title: "Download Started",
        description: `Your ${type} backup archive was generated and downloaded successfully.`,
      });
      refetch();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to generate and download backup archive.";
      setStatusMessage({
        type: "error",
        title: "Backup Generation Failed",
        description: errMsg,
      });
    } finally {
      setDownloadingType(null);
    }
  };

  const copyToClipboard = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  // Restore Handlers
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isLocalEnv) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setStatusMessage({
        type: "error",
        title: "Invalid File Type",
        description: "Please upload a valid StudyVerse backup archive (.zip).",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewData(null);
    setRestoreResult(null);
    setReplaceConfirmation("");
    setRestoreMode("merge");
    setIsValidatingUpload(true);
    setStatusMessage(null);

    try {
      const res = await adminApi.uploadBackupPreview(file);
      setPreviewData(res.data);
      if (!res.data.is_valid) {
        setStatusMessage({
          type: "error",
          title: "Preflight Check Failed",
          description:
            res.data.errors.join("; ") || "Backup archive is incompatible or corrupt.",
        });
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to validate backup archive.";
      setStatusMessage({
        type: "error",
        title: "Preflight Inspection Failed",
        description: detail,
      });
      setSelectedFile(null);
    } finally {
      setIsValidatingUpload(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!previewData || !previewData.is_valid) return;

    if (restoreMode === "replace" && replaceConfirmation.trim() !== "REPLACE") {
      setStatusMessage({
        type: "error",
        title: "Confirmation Required",
        description: "Please type 'REPLACE' to confirm replacing all local database records.",
      });
      return;
    }

    setIsExecutingRestore(true);
    setStatusMessage({
      type: "info",
      title: "Restoring Data...",
      description: `Applying backup records in ${restoreMode.toUpperCase()} mode. This may take a few moments.`,
    });

    try {
      const res = await adminApi.executeRestore({
        session_id: previewData.session_id,
        mode: restoreMode,
        confirmation: restoreMode === "replace" ? "REPLACE" : undefined,
      });

      setRestoreResult(res.data);
      setStatusMessage({
        type: "success",
        title: "Restore Completed Successfully",
        description: res.data.message,
      });
      refetch();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to restore backup archive.";
      setStatusMessage({
        type: "error",
        title: "Restore Execution Failed",
        description: detail,
      });
    } finally {
      setIsExecutingRestore(false);
    }
  };

  const handleResetRestore = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setRestoreResult(null);
    setReplaceConfirmation("");
    setRestoreMode("merge");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Group table stats by logical functional categories
  const tablesSummary = stats?.tables_summary || {};
  const totalTables = Object.keys(tablesSummary).length;

  const getCategoryGroup = (tableName: string) => {
    const t = tableName.toLowerCase();
    if (t.includes("user") || t.includes("token") || t.includes("auth") || t.includes("audit")) {
      return "Identity & Authentication";
    }
    if (
      t.includes("subject") ||
      t.includes("chapter") ||
      t.includes("note") ||
      t.includes("syllabus") ||
      t.includes("class") ||
      t.includes("curriculum")
    ) {
      return "Academic & Course Content";
    }
    if (
      t.includes("assignment") ||
      t.includes("quiz") ||
      t.includes("test") ||
      t.includes("submission") ||
      t.includes("grading")
    ) {
      return "Assessments & Submissions";
    }
    if (
      t.includes("doubt") ||
      t.includes("chat") ||
      t.includes("message") ||
      t.includes("notice") ||
      t.includes("notification") ||
      t.includes("attendance")
    ) {
      return "Collaboration & Records";
    }
    return "Other Application Tables";
  };

  const categorizedTables = Object.entries(tablesSummary).reduce(
    (acc, [table, count]) => {
      const group = getCategoryGroup(table);
      if (!acc[group]) acc[group] = [];
      acc[group].push({ table, count });
      return acc;
    },
    {} as Record<string, Array<{ table: string; count: number }>>
  );

  return (
    <div className="admin-backup-page">
      <style>{`
        .admin-backup-page {
          max-width: 1140px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .header-title-area h1 {
          font-size: clamp(20px, 4vw, 26px);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-title-area p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm, 8px);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--border-hover);
          background: var(--bg-tertiary);
        }

        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 580px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius, 12px);
          padding: 20px;
          box-shadow: var(--shadow-sm);
          display: flex;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon-wrapper.records { background: var(--info-light); color: var(--info); }
        .stat-icon-wrapper.files { background: var(--success-light); color: var(--success); }
        .stat-icon-wrapper.size { background: var(--warning-light); color: var(--warning); }
        .stat-icon-wrapper.env { background: rgba(99, 102, 241, 0.15); color: #6366f1; }

        .stat-info {
          flex: 1;
          min-width: 0;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .stat-value {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
          margin-top: 2px;
        }

        .stat-subtext {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Banner Notifications */
        .status-banner {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 20px;
          border-radius: var(--radius, 12px);
          margin-bottom: 24px;
          animation: fadeIn 0.3s ease;
        }

        .status-banner.success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #065f46;
        }

        .status-banner.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #991b1b;
        }

        .status-banner.info {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #1e40af;
        }

        :root[data-theme="dark"] .status-banner.success,
        .dark .status-banner.success {
          color: #34d399;
        }

        :root[data-theme="dark"] .status-banner.error,
        .dark .status-banner.error {
          color: #f87171;
        }

        :root[data-theme="dark"] .status-banner.info,
        .dark .status-banner.info {
          color: #93c5fd;
        }

        .status-banner-content h4 {
          font-size: 14px;
          font-weight: 700;
        }

        .status-banner-content p {
          font-size: 13px;
          margin-top: 2px;
          opacity: 0.95;
        }

        /* Section Title */
        .section-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Restore Hub Panel */
        .restore-hub-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 16px);
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: var(--shadow-sm);
        }

        .restore-hub-card.active-preview {
          border-color: rgba(245, 158, 11, 0.5);
          box-shadow: 0 4px 24px rgba(245, 158, 11, 0.08);
        }

        .restore-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .restore-header-row h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .restore-header-row p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .badge-env {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-env.local {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .badge-env.prod {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        /* Dropzone */
        .dropzone-box {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius, 12px);
          padding: 36px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg-secondary);
        }

        .dropzone-box:hover,
        .dropzone-box.dragover {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.04);
        }

        .dropzone-box.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .dropzone-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .dropzone-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .dropzone-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* Preview Details Grid */
        .preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        @media (max-width: 860px) {
          .preview-grid {
            grid-template-columns: 1fr;
          }
        }

        .preview-stat-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm, 10px);
          padding: 14px 16px;
        }

        .preview-stat-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
        }

        .preview-stat-val {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 4px;
        }

        /* Diff breakdown list */
        .diff-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        @media (max-width: 900px) {
          .diff-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 500px) {
          .diff-grid {
            grid-template-columns: 1fr;
          }
        }

        .diff-card {
          padding: 12px 14px;
          border-radius: var(--radius-sm, 8px);
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .diff-card.insert { border-left: 3px solid #10b981; }
        .diff-card.update { border-left: 3px solid #3b82f6; }
        .diff-card.unchanged { border-left: 3px solid #64748b; }
        .diff-card.files { border-left: 3px solid #8b5cf6; }
        .diff-card.replace-files { border-left: 3px solid #f59e0b; }

        .diff-card-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .diff-card-num {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 2px;
        }

        /* Mode Selection */
        .mode-selection-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .mode-selection-grid {
            grid-template-columns: 1fr;
          }
        }

        .mode-card {
          border: 2px solid var(--border-color);
          border-radius: var(--radius, 12px);
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg-secondary);
        }

        .mode-card:hover {
          border-color: var(--border-hover);
        }

        .mode-card.selected.merge {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.04);
        }

        .mode-card.selected.replace {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.04);
        }

        .mode-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .mode-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .replace-warning-box {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-sm, 8px);
          padding: 14px 16px;
          margin-bottom: 20px;
        }

        .replace-warning-box h5 {
          font-size: 13px;
          font-weight: 700;
          color: #dc2626;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }

        :root[data-theme="dark"] .replace-warning-box h5,
        .dark .replace-warning-box h5 {
          color: #f87171;
        }

        .replace-warning-box p {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .confirm-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .confirm-input {
          padding: 8px 12px;
          font-size: 13px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--card-bg);
          color: var(--text-primary);
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-weight: 700;
          letter-spacing: 1px;
          width: 140px;
        }

        .confirm-input:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
        }

        /* Action Buttons */
        .restore-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
          flex-wrap: wrap;
        }

        /* Standard Action Grid */
        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .action-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius, 12px);
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }

        .action-card.recommended {
          border: 2px solid #f59e0b;
          box-shadow: 0 4px 20px rgba(245, 158, 11, 0.12);
        }

        .action-card:hover {
          border-color: var(--border-hover);
          box-shadow: var(--shadow-md);
        }

        .badge-recommended {
          position: absolute;
          top: -12px;
          right: 20px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 3px 10px;
          border-radius: 9999px;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
        }

        .action-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .action-card h3 {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .action-card p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 20px;
          flex: 1;
        }

        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: var(--radius-sm, 8px);
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }

        .action-btn.primary {
          background: #f59e0b;
          color: #ffffff;
        }

        .action-btn.primary:hover:not(:disabled) {
          background: #d97706;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .action-btn.danger {
          background: #dc2626;
          color: #ffffff;
        }

        .action-btn.danger:hover:not(:disabled) {
          background: #b91c1c;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        .action-btn.secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-color: var(--border-color);
        }

        .action-btn.secondary:hover:not(:disabled) {
          background: var(--border-color);
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Two-column layout */
        .content-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        @media (max-width: 960px) {
          .content-split {
            grid-template-columns: 1fr;
          }
        }

        .card-panel {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius, 12px);
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .panel-header h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-group {
          margin-bottom: 16px;
        }

        .category-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-tertiary);
          margin-bottom: 8px;
        }

        .table-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 6px;
          background: var(--bg-secondary);
          margin-bottom: 4px;
          font-size: 13px;
        }

        .table-name {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          color: var(--text-primary);
          font-weight: 500;
        }

        .table-count {
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
        }

        /* CLI Guide Terminal */
        .terminal-box {
          background: #0f172a;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #334155;
          margin-bottom: 16px;
        }

        .terminal-header {
          background: #1e293b;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #94a3b8;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .terminal-dots {
          display: flex;
          gap: 6px;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .dot.red { background: #ef4444; }
        .dot.yellow { background: #f59e0b; }
        .dot.green { background: #10b981; }

        .terminal-content {
          padding: 16px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 13px;
          color: #f8fafc;
          line-height: 1.6;
        }

        .terminal-cmd-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 10px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          margin-bottom: 8px;
        }

        .cmd-text {
          color: #38bdf8;
          word-break: break-all;
        }

        .copy-cmd-btn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }

        .copy-cmd-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .step-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .step-badge {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #f59e0b;
          color: white;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .security-box {
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: var(--radius, 12px);
          padding: 20px 24px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .security-box h4 {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .security-box p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 16px;
        }

        .modal-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 16px);
          padding: 28px;
          max-width: 480px;
          width: 100%;
          box-shadow: var(--shadow-xl);
        }

        .modal-card h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-card p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .refresh-btn {
            width: 100%;
            justify-content: center;
          }

          .restore-hub-card {
            padding: 16px;
          }

          .dropzone-box {
            padding: 24px 14px;
          }

          .modal-card {
            padding: 20px;
          }

          .modal-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .modal-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      {/* Confirmation Modal for Large Archive Download */}
      <AnimatePresence>
        {confirmModal && (
          <div className="modal-backdrop" onClick={() => setConfirmModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>
                <AlertTriangle size={20} color="#f59e0b" />
                Generate Full Production Backup?
              </h3>
              <p>
                This will query and serialize all database tables and package all uploaded
                files ({formatBytes(stats?.estimated_size_bytes || 0)} estimated).
                The download will begin automatically once packaging finishes.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="action-btn secondary"
                  onClick={() => setConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="action-btn primary"
                  onClick={() => {
                    setConfirmModal(false);
                    handleDownload("full");
                  }}
                >
                  Confirm & Export
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="page-header">
        <div className="header-title-area">
          <h1>
            <Database size={26} color="#f59e0b" />
            Admin Data Backup & Local Restore
          </h1>
          <p>
            Download production data snapshots and safely restore them into your local
            development environment for testing, debugging, and verification.
          </p>
        </div>
        <button
          className="refresh-btn"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          type="button"
        >
          <RefreshCw size={14} className={isRefetching ? "spinning" : ""} />
          <span>{isRefetching ? "Refreshing..." : "Refresh Stats"}</span>
        </button>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div className={`status-banner ${statusMessage.type}`}>
          {statusMessage.type === "success" && <CheckCircle2 size={20} />}
          {statusMessage.type === "error" && <AlertTriangle size={20} />}
          {statusMessage.type === "info" && <Info size={20} />}
          <div className="status-banner-content">
            <h4>{statusMessage.title}</h4>
            <p>{statusMessage.description}</p>
          </div>
        </div>
      )}

      {/* Quick Overview Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper records">
            <Layers size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Records</span>
            <div className="stat-value">
              {isLoading ? "..." : (stats?.total_records ?? 0).toLocaleString()}
            </div>
            <div className="stat-subtext">Across {totalTables} application tables</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper files">
            <FolderArchive size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Uploaded Files</span>
            <div className="stat-value">
              {isLoading ? "..." : (stats?.total_files ?? 0).toLocaleString()}
            </div>
            <div className="stat-subtext">Notes, syllabus & avatars</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper size">
            <HardDrive size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Est. Backup Size</span>
            <div className="stat-value">
              {isLoading ? "..." : formatBytes(stats?.estimated_size_bytes || 0)}
            </div>
            <div className="stat-subtext">Uncompressed data + media</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper env">
            <Server size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">System Engine</span>
            <div className="stat-value" style={{ fontSize: "16px", marginTop: "6px" }}>
              {isLoading
                ? "..."
                : `${stats?.database_type || "SQLite"} / ${stats?.environment || "development"}`}
            </div>
            <div className="stat-subtext">
              Storage: {stats?.file_storage || "Local uploads"}
            </div>
          </div>
        </div>
      </div>

      {/* Last Backup Info Banner */}
      {stats?.last_backup_generated && (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius, 12px)",
            padding: "12px 18px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
            color: "var(--text-secondary)",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={16} color="#f59e0b" />
            <span>
              <strong>Last Backup:</strong>{" "}
              {formatDate(stats.last_backup_generated.created_at)} (
              {formatBytes(stats.last_backup_generated.file_size_bytes)})
            </span>
          </div>
          <div>
            <span
              style={{
                background: "var(--bg-tertiary)",
                padding: "3px 8px",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "11px",
                textTransform: "uppercase",
              }}
            >
              Type: {stats.last_backup_generated.backup_type}
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: LOCAL RESTORE PIPELINE (OR PRODUCTION GUARD BANNER)
      ────────────────────────────────────────────────────────────── */}
      {!isLocalEnv ? (
        // PRODUCTION RESTORE ADVISORY BANNER
        <div
          style={{
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "var(--radius-lg, 16px)",
            padding: "24px",
            marginBottom: "32px",
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Lock size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                Local Restore Disabled in Production
              </h3>
              <span className="badge-env prod">Production Guard Active</span>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginTop: "6px",
                lineHeight: "1.5",
              }}
            >
              This StudyVerse instance is operating in a production environment using{" "}
              <strong>{stats?.database_type || "PostgreSQL"}</strong>. To safeguard live production
              records from accidental overwrites or data loss, restore execution is strictly disabled.
              Production databases are download-only for backups. To test or restore an archive, download
              it below and import it into your local development environment.
            </p>
          </div>
        </div>
      ) : (
        // LOCAL RESTORE INTERACTIVE WORKFLOW
        <div className={`restore-hub-card ${previewData ? "active-preview" : ""}`}>
          <div className="restore-header-row">
            <div>
              <h3>
                <RotateCcw size={20} color="#f59e0b" />
                Local Backup Ingestion & Restore
              </h3>
              <p>
                Safely upload a backup ZIP archive. Automated preflight validation inspects
                checksums, schema compatibility, and merge diffs before any database updates occur.
              </p>
            </div>
            <span className="badge-env local">
              <CheckCircle2 size={12} /> Local Environment ({stats?.database_type || "SQLite"})
            </span>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
          />

          {/* STATE 1: Initial Upload Dropzone */}
          {!selectedFile && !isValidatingUpload && !restoreResult && (
            <div
              className={`dropzone-box ${isDragOver ? "dragover" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon">
                <FileUp size={28} />
              </div>
              <div className="dropzone-title">
                Drag and drop a StudyVerse backup (.zip) here
              </div>
              <div className="dropzone-desc">
                or click to browse your computer. Supports Full, Database, or Media archives.
              </div>
            </div>
          )}

          {/* STATE 2: Uploading & Preflight In-Progress */}
          {isValidatingUpload && (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                background: "var(--bg-secondary)",
                borderRadius: "var(--radius, 12px)",
                border: "1px solid var(--border-color)",
              }}
            >
              <RefreshCw size={32} className="spinning" style={{ color: "#f59e0b", margin: "0 auto 16px" }} />
              <h4 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                Analyzing & Validating Backup Archive...
              </h4>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                Verifying manifest structure, calculating SHA-256 file checksums, and simulating merge plan...
              </p>
            </div>
          )}

          {/* STATE 3: Preflight Preview Ready */}
          {previewData && !isValidatingUpload && !restoreResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* If Preflight Failed */}
              {!previewData.is_valid ? (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "var(--radius, 12px)",
                    padding: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#dc2626",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <XCircle size={18} />
                    Preflight Verification Rejected Archive
                  </h4>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                    The uploaded backup archive failed security or structural preflight validation:
                  </p>
                  <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "#b91c1c", lineHeight: "1.6" }}>
                    {previewData.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: "16px" }}>
                    <button
                      type="button"
                      className="action-btn secondary"
                      onClick={handleResetRestore}
                    >
                      Choose a Different Archive
                    </button>
                  </div>
                </div>
              ) : (
                /* Preflight Passed */
                <div>
                  {/* File Metadata Overview */}
                  <div className="preview-grid">
                    <div className="preview-stat-box">
                      <div className="preview-stat-label">Source System</div>
                      <div className="preview-stat-val">
                        {previewData.source_database_type || "sqlite"} / {previewData.source_environment || "dev"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                        Version {previewData.backup_version || 1} • {formatDate(previewData.created_at)}
                      </div>
                    </div>

                    <div className="preview-stat-box">
                      <div className="preview-stat-label">Archive Payload</div>
                      <div className="preview-stat-val">
                        {previewData.total_records.toLocaleString()} Records
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                        Across {previewData.tables_count} tables • {formatBytes(previewData.estimated_size_bytes)}
                      </div>
                    </div>

                    <div className="preview-stat-box">
                      <div className="preview-stat-label">Security & Integrity</div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "#10b981",
                          marginTop: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <ShieldCheck size={18} />
                        Checksums & Schema Valid
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                        Zero ZipSlip vulnerabilities detected
                      </div>
                    </div>
                  </div>

                  {/* Merge Plan Impact Grid */}
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FileCheck size={16} color="#f59e0b" />
                      Restore Diff Preview:
                    </div>
                    <div className="diff-grid">
                      <div className="diff-card insert">
                        <div className="diff-card-label">To Insert</div>
                        <div className="diff-card-num">+{previewData.records_to_insert.toLocaleString()}</div>
                      </div>
                      <div className="diff-card update">
                        <div className="diff-card-label">To Update</div>
                        <div className="diff-card-num">~{previewData.records_to_update.toLocaleString()}</div>
                      </div>
                      <div className="diff-card unchanged">
                        <div className="diff-card-label">Unchanged</div>
                        <div className="diff-card-num">={previewData.records_unchanged.toLocaleString()}</div>
                      </div>
                      <div className="diff-card files">
                        <div className="diff-card-label">Files to Restore</div>
                        <div className="diff-card-num">{previewData.files_to_restore.toLocaleString()}</div>
                      </div>
                      <div className="diff-card replace-files">
                        <div className="diff-card-label">Files Overwritten</div>
                        <div className="diff-card-num">{previewData.files_to_replace.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div style={{ marginBottom: "14px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: "10px",
                      }}
                    >
                      Select Ingestion Mode:
                    </div>
                    <div className="mode-selection-grid">
                      {/* Mode: Merge */}
                      <div
                        className={`mode-card ${restoreMode === "merge" ? "selected merge" : ""}`}
                        onClick={() => setRestoreMode("merge")}
                      >
                        <div className="mode-title">
                          <CheckCircle2 size={16} color={restoreMode === "merge" ? "#10b981" : "var(--text-tertiary)"} />
                          Merge Mode (Recommended)
                        </div>
                        <p className="mode-desc">
                          Safely inserts newly discovered records and updates existing modified records. Local
                          records that do not exist in the backup archive are preserved.
                        </p>
                      </div>

                      {/* Mode: Replace */}
                      <div
                        className={`mode-card ${restoreMode === "replace" ? "selected replace" : ""}`}
                        onClick={() => setRestoreMode("replace")}
                      >
                        <div className="mode-title" style={{ color: restoreMode === "replace" ? "#ef4444" : "var(--text-primary)" }}>
                          <AlertTriangle size={16} color={restoreMode === "replace" ? "#ef4444" : "var(--text-tertiary)"} />
                          Replace Local Data (Destructive)
                        </div>
                        <p className="mode-desc">
                          Wipes current local database tables and rebuilds them completely from the backup archive.
                          An automated timestamped safety backup of your current database is created first.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Destructive Replace Confirmation Prompt */}
                  {restoreMode === "replace" && (
                    <div className="replace-warning-box">
                      <h5>
                        <AlertTriangle size={16} />
                        Safety Safeguard: Confirmation Required
                      </h5>
                      <p>
                        This will replace all local application data with the records from the backup archive.
                        An automated safety copy will be saved as <code>studyverse_before_restore_[timestamp].db</code>.
                        Type <strong>REPLACE</strong> below to proceed:
                      </p>
                      <div className="confirm-input-row">
                        <input
                          type="text"
                          placeholder="REPLACE"
                          className="confirm-input"
                          value={replaceConfirmation}
                          onChange={(e) => setReplaceConfirmation(e.target.value)}
                        />
                        <span style={{ fontSize: "12px", color: replaceConfirmation === "REPLACE" ? "#10b981" : "var(--text-tertiary)", fontWeight: 600 }}>
                          {replaceConfirmation === "REPLACE" ? "✓ Confirmation matched" : "Type REPLACE in capital letters"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="restore-actions">
                    <button
                      type="button"
                      className="action-btn secondary"
                      onClick={handleResetRestore}
                      disabled={isExecutingRestore}
                    >
                      Cancel / Select Different Archive
                    </button>
                    <button
                      type="button"
                      className={`action-btn ${restoreMode === "replace" ? "danger" : "primary"}`}
                      disabled={
                        isExecutingRestore ||
                        (restoreMode === "replace" && replaceConfirmation !== "REPLACE")
                      }
                      onClick={handleExecuteRestore}
                    >
                      {isExecutingRestore ? (
                        <>
                          <RefreshCw size={14} className="spinning" />
                          <span>Applying Restore...</span>
                        </>
                      ) : restoreMode === "replace" ? (
                        <>
                          <AlertTriangle size={14} />
                          <span>Replace Local Data Now</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw size={14} />
                          <span>Execute Safe Merge Restore</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STATE 4: Restore Execution Results */}
          {restoreResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "var(--radius, 12px)",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#10b981",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <CheckCircle2 size={28} />
              </div>
              <h4 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" }}>
                Local Database Restored Successfully!
              </h4>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  marginTop: "6px",
                  maxWidth: "600px",
                  margin: "6px auto 16px",
                  lineHeight: "1.5",
                }}
              >
                {restoreResult.message}
              </p>
              {restoreResult.safety_backup_path && (
                <div
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    background: "var(--card-bg)",
                    border: "1px solid var(--border-color)",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "18px",
                  }}
                >
                  Safety snapshot saved: <strong>{restoreResult.safety_backup_path}</strong>
                </div>
              )}
              <div>
                <button
                  type="button"
                  className="action-btn primary"
                  style={{ margin: "0 auto" }}
                  onClick={handleResetRestore}
                >
                  Done / Restore Another Archive
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: BACKUP ACTION CONTROLS (DOWNLOAD SNAPSHOTS)
      ────────────────────────────────────────────────────────────── */}
      <h2 className="section-title">
        <Download size={18} color="#f59e0b" />
        Export Backup Archives
      </h2>
      <div className="actions-grid">
        {/* Full Backup Card */}
        <div className="action-card recommended">
          <span className="badge-recommended">Recommended</span>
          <div>
            <div className="action-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
              <Archive size={22} />
            </div>
            <h3>Full Snapshot</h3>
            <p>
              Complete archive containing all database tables serialized as JSON plus all
              uploaded files and media. Everything needed for a 1-to-1 local clone.
            </p>
          </div>
          <button
            className="action-btn primary"
            onClick={() => {
              if ((stats?.estimated_size_bytes || 0) > 50 * 1024 * 1024) {
                setConfirmModal(true);
              } else {
                handleDownload("full");
              }
            }}
            disabled={!!downloadingType}
            type="button"
          >
            {downloadingType === "full" ? (
              <>
                <RefreshCw size={16} className="spinning" />
                <span>Exporting Archive...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Download Full (.zip)</span>
              </>
            )}
          </button>
        </div>

        {/* Database Only Card */}
        <div className="action-card">
          <div>
            <div className="action-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
              <Database size={22} />
            </div>
            <h3>Database Only</h3>
            <p>
              Lightweight archive containing all database records serialized as JSON and
              schema revision info. Skips media files for rapid synchronization.
            </p>
          </div>
          <button
            className="action-btn secondary"
            onClick={() => handleDownload("database")}
            disabled={!!downloadingType}
            type="button"
          >
            {downloadingType === "database" ? (
              <>
                <RefreshCw size={16} className="spinning" />
                <span>Exporting DB...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Download DB (.zip)</span>
              </>
            )}
          </button>
        </div>

        {/* Files Only Card */}
        <div className="action-card">
          <div>
            <div className="action-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
              <FileArchive size={22} />
            </div>
            <h3>Uploaded Files Only</h3>
            <p>
              Media archive containing all teacher notes, syllabus PDFs, student submissions,
              doubt photos, and avatars.
            </p>
          </div>
          <button
            className="action-btn secondary"
            onClick={() => handleDownload("files")}
            disabled={!!downloadingType}
            type="button"
          >
            {downloadingType === "files" ? (
              <>
                <RefreshCw size={16} className="spinning" />
                <span>Packaging Files...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Download Media (.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: BREAKDOWN & COLLAPSIBLE CLI GUIDE
      ────────────────────────────────────────────────────────────── */}
      <div className="content-split">
        {/* Column 1: Tables Breakdown */}
        <div className="card-panel">
          <div className="panel-header">
            <h3>
              <FileCheck size={18} color="#f59e0b" />
              Dynamic Schema Breakdown
            </h3>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-tertiary)",
              }}
            >
              {totalTables} Tables Verified
            </span>
          </div>

          {isLoading ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
              <RefreshCw size={20} className="spinning" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: "13px" }}>Loading table breakdown...</p>
            </div>
          ) : (
            <div style={{ maxHeight: "380px", overflowY: "auto", paddingRight: "6px" }}>
              {Object.entries(categorizedTables).map(([category, items]) => (
                <div key={category} className="category-group">
                  <div className="category-title">{category}</div>
                  {items.map(({ table, count }) => (
                    <div key={table} className="table-item">
                      <span className="table-name">{table}</span>
                      <span className="table-count">{count.toLocaleString()} rows</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Advanced CLI Restore Guide */}
        <div className="card-panel">
          <div className="panel-header">
            <h3>
              <Terminal size={18} color="#f59e0b" />
              Developer CLI Reference
            </h3>
            <button
              type="button"
              className="copy-cmd-btn"
              onClick={() => setShowCliGuide(!showCliGuide)}
              style={{ fontSize: "12px", color: "var(--text-secondary)" }}
            >
              {showCliGuide ? (
                <>
                  <span>Hide Guide</span>
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  <span>Show CLI</span>
                  <ChevronDown size={14} />
                </>
              )}
            </button>
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
            Developers can also run restores directly from the command line using the
            StudyVerse administrative CLI:
          </p>

          <div className="terminal-box">
            <div className="terminal-header">
              <div className="terminal-dots">
                <div className="dot red" />
                <div className="dot yellow" />
                <div className="dot green" />
              </div>
              <span>bash / powershell</span>
            </div>
            <div className="terminal-content">
              {/* Command 1: Merge */}
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                # Safe merge restore (recommended):
              </div>
              <div className="terminal-cmd-row">
                <span className="cmd-text">
                  python -m app.cli restore-backup backup.zip --strategy merge
                </span>
                <button
                  type="button"
                  className="copy-cmd-btn"
                  onClick={() =>
                    copyToClipboard(
                      "python -m app.cli restore-backup backup.zip --strategy merge",
                      "cmd1"
                    )
                  }
                >
                  {copiedCmd === "cmd1" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedCmd === "cmd1" ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Command 2: Dry Run */}
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", marginTop: "10px" }}>
                # Preflight validation without modifying database:
              </div>
              <div className="terminal-cmd-row">
                <span className="cmd-text">
                  python -m app.cli restore-backup backup.zip --dry-run
                </span>
                <button
                  type="button"
                  className="copy-cmd-btn"
                  onClick={() =>
                    copyToClipboard(
                      "python -m app.cli restore-backup backup.zip --dry-run",
                      "cmd2"
                    )
                  }
                >
                  {copiedCmd === "cmd2" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedCmd === "cmd2" ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Command 3: Replace */}
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", marginTop: "10px" }}>
                # Destructive replace with auto safety backup:
              </div>
              <div className="terminal-cmd-row">
                <span className="cmd-text">
                  python -m app.cli restore-backup backup.zip
                </span>
                <button
                  type="button"
                  className="copy-cmd-btn"
                  onClick={() =>
                    copyToClipboard(
                      "python -m app.cli restore-backup backup.zip",
                      "cmd3"
                    )
                  }
                >
                  {copiedCmd === "cmd3" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedCmd === "cmd3" ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>

          <ul className="step-list">
            <li className="step-item">
              <span className="step-badge">1</span>
              <span>
                Download a backup ZIP from this page and move it to your local StudyVerse backend folder.
              </span>
            </li>
            <li className="step-item">
              <span className="step-badge">2</span>
              <span>
                Run <code>--dry-run</code> to preflight manifest, schema compatibility, and file integrity.
              </span>
            </li>
            <li className="step-item">
              <span className="step-badge">3</span>
              <span>
                Execute restore. All remote storage URLs are automatically rewritten to local <code>/uploads/</code> paths.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Security & Integrity Guarantee Notice */}
      <div className="security-box">
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "rgba(245, 158, 11, 0.15)",
            color: "#f59e0b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={22} />
        </div>
        <div>
          <h4>Confidentiality & Data Integrity Guarantee</h4>
          <p>
            Backup archives contain production user data and must be stored securely. All user
            passwords remain protected with bcrypt hashes, and server secret keys (.env credentials)
            are never exported. Restores are performed inside an atomic transaction, guaranteeing zero
            partial database corruption.
          </p>
        </div>
      </div>
    </div>
  );
}
