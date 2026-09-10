"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Check,
  RotateCcw,
  Sparkles,
  BookOpen,
  Calendar,
  Award,
  FolderLock,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
} from "lucide-react";
import { studentsApi, StudentPermissions } from "@/lib/students-api";

interface StudentPermissionsTabProps {
  studentId: string;
}

const DEFAULT_PERMISSIONS: StudentPermissions = {
  syllabus: { can_edit: false, can_import: false },
  homework: { can_edit: false, can_import: false },
  calendar: { can_edit: false, can_import: false },
  tests: { can_edit: false, can_import: false },
  files: { can_edit: false, can_import: false },
};

const PRESET_COLLABORATOR: StudentPermissions = {
  syllabus: { can_edit: true, can_import: true },
  homework: { can_edit: true, can_import: true },
  calendar: { can_edit: true, can_import: false },
  tests: { can_edit: false, can_import: false },
  files: { can_edit: false, can_import: true },
};

const PRESET_FULL_CONTROL: StudentPermissions = {
  syllabus: { can_edit: true, can_import: true },
  homework: { can_edit: true, can_import: true },
  calendar: { can_edit: true, can_import: false },
  tests: { can_edit: true, can_import: true },
  files: { can_edit: false, can_import: true },
};

export function StudentPermissionsTab({ studentId }: StudentPermissionsTabProps) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<StudentPermissions>(DEFAULT_PERMISSIONS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch student permissions
  const { data: remoteData, isLoading, isError } = useQuery({
    queryKey: ["student-permissions", studentId],
    queryFn: () => studentsApi.getPermissions(studentId),
    select: (res) => res.data,
  });

  useEffect(() => {
    if (remoteData?.permissions) {
      setPermissions(remoteData.permissions);
    }
  }, [remoteData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (updated: StudentPermissions) =>
      studentsApi.updatePermissions(studentId, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-permissions", studentId] });
      setSaveSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSaveSuccess(false), 3500);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "Failed to update permissions. Please try again.";
      setErrorMessage(msg);
    },
  });

  const handleToggle = (
    module: keyof StudentPermissions,
    action: "can_edit" | "can_import"
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action],
      },
    }));
  };

  const applyPreset = (preset: StudentPermissions) => {
    setPermissions(preset);
  };

  const isPresetActive = (preset: StudentPermissions) => {
    return JSON.stringify(permissions) === JSON.stringify(preset);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 280 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="animate-spin" style={{ width: 28, height: 28, border: "3px solid var(--brand-500, #3b82f6)", borderTopColor: "transparent", borderRadius: "50%" }} />
          <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Loading student access permissions...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 24, borderRadius: "var(--radius, 12px)", background: "var(--danger-light)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 6 }}>
          <AlertTriangle size={18} /> Unable to load student permissions
        </div>
        <p style={{ fontSize: 13, opacity: 0.9 }}>
          You may not be assigned to this student, or the student record might not be active.
        </p>
      </div>
    );
  }

  return (
    <div className="student-permissions-tab">
      <style>{`
        .student-permissions-tab {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ─── Header Info Banner ─── */
        .perm-banner {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          padding: 22px 24px;
          border-radius: var(--radius-lg, 16px);
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .perm-banner::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
        }

        .perm-banner-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .perm-banner-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px 0;
        }

        .perm-banner-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 650px;
          line-height: 1.5;
        }

        /* ─── Quick Presets Toolbar ─── */
        .perm-presets {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .perm-presets-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .preset-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 13px;
          border-radius: var(--radius-sm, 8px);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-xs);
        }

        .preset-btn:hover {
          background: var(--gray-200);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .preset-btn.active-readonly {
          background: var(--brand-50, #eef2ff);
          color: var(--brand-600, #4f46e5);
          border-color: var(--brand-300, #a5b4fc);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
        }

        .preset-btn.active-collab {
          background: rgba(59, 130, 246, 0.12);
          color: #2563eb;
          border-color: rgba(59, 130, 246, 0.4);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.15);
        }

        html.dark .preset-btn.active-collab,
        html[data-theme="dark"] .preset-btn.active-collab {
          color: #60a5fa;
        }

        .preset-btn.active-full {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          border-color: rgba(16, 185, 129, 0.4);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
        }

        html.dark .preset-btn.active-full,
        html[data-theme="dark"] .preset-btn.active-full {
          color: #34d399;
        }

        /* ─── Notification Alerts ─── */
        .perm-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: var(--radius-sm, 10px);
          font-size: 13px;
          font-weight: 500;
          animation: fadeIn 0.2s ease-in-out;
        }

        .perm-alert.success {
          background: var(--success-light);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: var(--success);
        }

        .perm-alert.error {
          background: var(--danger-light);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--danger);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── Granular Cards Grid ─── */
        .perm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
        }

        .module-card {
          padding: 20px;
          border-radius: var(--radius-lg, 16px);
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: all 0.2s ease;
        }

        .module-card:hover {
          border-color: var(--border-hover);
          box-shadow: var(--shadow-md);
        }

        .module-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .module-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .module-card-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .module-card-subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
        }

        .module-card-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color);
        }

        /* ─── Toggle Row ─── */
        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          background: transparent;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          user-select: none;
        }

        .toggle-row:hover:not(.disabled) {
          background: var(--bg-tertiary);
        }

        .toggle-row.checked {
          background: var(--brand-50, rgba(99, 102, 241, 0.08));
          border-color: var(--brand-200, rgba(99, 102, 241, 0.25));
        }

        .toggle-row.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .toggle-row-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          transition: color 0.15s ease;
        }

        .toggle-row.checked .toggle-row-label {
          color: var(--brand-600, #4f46e5);
        }

        html.dark .toggle-row.checked .toggle-row-label,
        html[data-theme="dark"] .toggle-row.checked .toggle-row-label {
          color: #818cf8;
        }

        .toggle-row-desc {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
        }

        /* ─── Switch Toggle Track & Knob ─── */
        .switch-track {
          width: 38px;
          height: 20px;
          border-radius: 20px;
          background: var(--gray-300, #cbd5e1);
          position: relative;
          flex-shrink: 0;
          transition: background 0.2s ease, box-shadow 0.2s ease;
        }

        html.dark .switch-track,
        html[data-theme="dark"] .switch-track {
          background: var(--gray-700, #334155);
        }

        .switch-track.checked {
          background: var(--brand-500, #6366f1);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.35);
        }

        .switch-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: left 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
        }

        .switch-track.checked .switch-thumb {
          left: 20px;
        }

        /* ─── Footer Action Bar ─── */
        .perm-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .btn-reset {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: var(--radius-sm, 10px);
          font-size: 13px;
          font-weight: 500;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: var(--shadow-xs);
        }

        .btn-reset:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .btn-save {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 22px;
          border-radius: var(--radius-sm, 10px);
          font-size: 13px;
          font-weight: 600;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
          transition: all 0.15s ease;
        }

        .btn-save:hover:not(:disabled) {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.45);
        }

        .btn-save:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
      `}</style>

      {/* Header Info Banner */}
      <div className="perm-banner">
        <div style={{ display: "flex", gap: 14 }}>
          <div className="perm-banner-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="perm-banner-title">
              Student Portal Access & Permissions
            </h3>
            <p className="perm-banner-desc">
              Control what this student is authorized to do in their personal student portal for your subjects.
              StudyVerse isolates access so students only perform actions you explicitly permit.
            </p>
          </div>
        </div>

        {/* Quick Presets Toolbar */}
        <div className="perm-presets">
          <span className="perm-presets-label">
            Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset(DEFAULT_PERMISSIONS)}
            className={`preset-btn ${isPresetActive(DEFAULT_PERMISSIONS) ? "active-readonly" : ""}`}
          >
            <Lock size={13} /> Read-Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset(PRESET_COLLABORATOR)}
            className={`preset-btn ${isPresetActive(PRESET_COLLABORATOR) ? "active-collab" : ""}`}
          >
            <Sparkles size={13} /> Collaborator
          </button>
          <button
            type="button"
            onClick={() => applyPreset(PRESET_FULL_CONTROL)}
            className={`preset-btn ${isPresetActive(PRESET_FULL_CONTROL) ? "active-full" : ""}`}
          >
            <Unlock size={13} /> Full Control
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="perm-alert success">
          <CheckCircle2 size={16} /> Access permissions saved and applied successfully.
        </div>
      )}

      {errorMessage && (
        <div className="perm-alert error">
          <AlertTriangle size={16} /> {errorMessage}
        </div>
      )}

      {/* Granular Module Cards Grid */}
      <div className="perm-grid">
        {/* Module 1: Syllabus */}
        <div className="module-card">
          <div className="module-card-header">
            <div className="module-icon-box" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}>
              <Layers size={20} />
            </div>
            <div>
              <h4 className="module-card-title">Syllabus & Curriculum</h4>
              <p className="module-card-subtitle">Chapters, checklist items, & notes</p>
            </div>
          </div>
          <div className="module-card-body">
            <ToggleRow
              label="Allow Editing"
              description="Create, rename, or delete syllabus subjects, chapters, notes, and checklist items."
              checked={permissions.syllabus.can_edit}
              onChange={() => handleToggle("syllabus", "can_edit")}
            />
            <ToggleRow
              label="Allow Importing"
              description="Upload center syllabus files or import syllabus topics via CSV/Excel."
              checked={permissions.syllabus.can_import}
              onChange={() => handleToggle("syllabus", "can_import")}
            />
          </div>
        </div>

        {/* Module 2: Homework */}
        <div className="module-card">
          <div className="module-card-header">
            <div className="module-icon-box" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7" }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h4 className="module-card-title">Homework & Study Tasks</h4>
              <p className="module-card-subtitle">Assignments, due dates, & homework files</p>
            </div>
          </div>
          <div className="module-card-body">
            <ToggleRow
              label="Allow Editing"
              description="Create personal study tasks, update status (completed/assigned), and edit homework."
              checked={permissions.homework.can_edit}
              onChange={() => handleToggle("homework", "can_edit")}
            />
            <ToggleRow
              label="Allow Importing"
              description="Upload homework attachment files or study task documentation."
              checked={permissions.homework.can_import}
              onChange={() => handleToggle("homework", "can_import")}
            />
          </div>
        </div>

        {/* Module 3: Calendar */}
        <div className="module-card">
          <div className="module-card-header">
            <div className="module-icon-box" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
              <Calendar size={20} />
            </div>
            <div>
              <h4 className="module-card-title">Calendar & Timetable</h4>
              <p className="module-card-subtitle">Study schedule, personal reminders, & exam dates</p>
            </div>
          </div>
          <div className="module-card-body">
            <ToggleRow
              label="Allow Editing"
              description="Create and delete personal calendar study events and reminders."
              checked={permissions.calendar.can_edit}
              onChange={() => handleToggle("calendar", "can_edit")}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", opacity: 0.6 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingRight: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)" }}>Allow Importing</span>
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: 0 }}>Not supported by StudyVerse calendar</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "var(--bg-tertiary)", color: "var(--text-tertiary)", border: "1px solid var(--border-color)" }}>
                Disabled
              </span>
            </div>
          </div>
        </div>

        {/* Module 4: Exams & Tests */}
        <div className="module-card">
          <div className="module-card-header">
            <div className="module-icon-box" style={{ background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e" }}>
              <Award size={20} />
            </div>
            <div>
              <h4 className="module-card-title">Exams & Test Marks</h4>
              <p className="module-card-subtitle">Mock test scores, question papers, & answer sheets</p>
            </div>
          </div>
          <div className="module-card-body">
            <ToggleRow
              label="Allow Editing"
              description="Record or edit test scores and obtained marks."
              checked={permissions.tests.can_edit}
              onChange={() => handleToggle("tests", "can_edit")}
            />
            <ToggleRow
              label="Allow Importing"
              description="Upload question papers or scanned answer sheet files."
              checked={permissions.tests.can_import}
              onChange={() => handleToggle("tests", "can_import")}
            />
          </div>
        </div>

        {/* Module 5: Files Hub */}
        <div className="module-card">
          <div className="module-card-header">
            <div className="module-icon-box" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <FolderLock size={20} />
            </div>
            <div>
              <h4 className="module-card-title">Files & Resource Hub</h4>
              <p className="module-card-subtitle">Study materials, documents, and reference PDFs</p>
            </div>
          </div>
          <div className="module-card-body">
            <ToggleRow
              label="Allow Importing / Uploading"
              description="Upload study materials, notes, and reference files directly to student repository."
              checked={permissions.files.can_import}
              onChange={() => handleToggle("files", "can_import")}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", color: "var(--text-tertiary)", fontSize: 11.5 }}>
              <Info size={13} /> File editing is not applicable in StudyVerse.
            </div>
          </div>
        </div>
      </div>

      {/* Save Action Bar */}
      <div className="perm-footer">
        <button
          type="button"
          onClick={() => {
            if (remoteData?.permissions) {
              setPermissions(remoteData.permissions);
            }
          }}
          disabled={saveMutation.isPending}
          className="btn-reset"
        >
          <RotateCcw size={14} /> Reset
        </button>

        <button
          type="button"
          onClick={() => saveMutation.mutate(permissions)}
          disabled={saveMutation.isPending}
          className="btn-save"
        >
          {saveMutation.isPending ? (
            <>
              <div className="animate-spin" style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%" }} />
              Saving...
            </>
          ) : (
            <>
              <Check size={16} /> Save Access Permissions
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange();
      }}
      className={`toggle-row ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingRight: 12 }}>
        <span className="toggle-row-label">
          {label}
        </span>
        <p className="toggle-row-desc">
          {description}
        </p>
      </div>

      {/* Switch Toggle */}
      <div className={`switch-track ${checked ? "checked" : ""}`}>
        <div className="switch-thumb" />
      </div>
    </div>
  );
}
