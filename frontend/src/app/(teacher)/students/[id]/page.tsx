"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  BookOpen,
  FileText,
  Sparkles,
  Award,
  ChevronLeft,
  Phone,
  Mail,
  GraduationCap,
  FileDown,
  User,
  ArrowLeft,
  Edit3,
  X,
  CreditCard,
  Cake,
  ShieldCheck,
} from "lucide-react";
import { studentsApi, type StudentUpdate } from "@/lib/students-api";
import { StudentCalendar } from "@/components/calendar/student-calendar";
import { HomeworkTab } from "@/components/student/homework-tab";
import { SyllabusTab } from "@/components/student/syllabus-tab";
import { AIAssistantTab } from "@/components/student/ai-assistant-tab";
import { TestsTab } from "@/components/student/tests-tab";
import { StudentPermissionsTab } from "@/components/student/student-permissions-tab";

type TabType = "calendar" | "homework" | "syllabus" | "ai" | "tests" | "permissions";

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const studentId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>("calendar");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editClassGrade, setEditClassGrade] = useState("");
  const [editBoard, setEditBoard] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editMonthlyFees, setEditMonthlyFees] = useState("");
  const [editFeeDueDay, setEditFeeDueDay] = useState("");

  // ─── Query Student Profile ──────────────────────────────
  const { data: student, isLoading, error } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => studentsApi.get(studentId),
    select: (res) => res.data,
  });

  const updateMutation = useMutation({
    mutationFn: (data: StudentUpdate) => studentsApi.update(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setShowEditModal(false);
    },
  });

  const openEditModal = () => {
    if (student) {
      setEditName(student.name);
      setEditEmail(student.email || "");
      setEditPhone(student.phone || "");
      setEditParentPhone(student.parent_phone || "");
      setEditClassGrade(student.class_grade || "");
      setEditBoard(student.board || "");
      setEditDateOfBirth(student.date_of_birth || "");
      setEditNotes(student.notes || "");
      setEditMonthlyFees(student.monthly_fees !== null && student.monthly_fees !== undefined ? String(student.monthly_fees) : "");
      setEditFeeDueDay(student.fee_due_day ? String(student.fee_due_day) : "");
      setShowEditModal(true);
    }
  };

  const tabs = [
    { id: "calendar", label: "Calendar & Planner", icon: Calendar },
    { id: "homework", label: "Homework", icon: BookOpen },
    { id: "syllabus", label: "Syllabus Tracker", icon: FileText },
    { id: "ai", label: "AI assistant", icon: Sparkles },
    { id: "tests", label: "Exams & Marks", icon: Award },
    { id: "permissions", label: "Access & Permissions", icon: ShieldCheck },
  ] as const;

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "80vh",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid var(--gray-200)",
            borderTopColor: "var(--brand-500)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <h2 style={{ color: "var(--danger)" }}>Failed to load student profile</h2>
        <button
          className="btn-secondary"
          onClick={() => router.push("/students")}
          style={{ marginTop: 16 }}
        >
          Go Back to Students List
        </button>
      </div>
    );
  }

  return (
    <div className="student-profile">
      <style>{`
        .student-profile {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
          cursor: pointer;
          border: none;
          background: none;
          font-family: inherit;
          padding: 6px 12px;
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .back-link:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        /* ─── Profile Header Card ───────────────────── */
        .profile-header-card {
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        @media (max-width: 640px) {
          .profile-header-card {
            padding: 16px;
            gap: 14px;
            margin-bottom: 16px;
          }
        }

        .profile-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
        }

        .profile-main-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .profile-avatar {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 22px;
          flex-shrink: 0;
        }

        .profile-name-class {
          min-width: 0;
        }

        .profile-name-class h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          margin-bottom: 4px;
          word-break: break-word;
        }

        @media (max-width: 640px) {
          .profile-name-class h1 {
            font-size: 18px;
          }
          .profile-avatar {
            width: 48px;
            height: 48px;
            font-size: 18px;
            border-radius: 12px;
          }
        }

        .profile-class-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          background: var(--brand-50);
          color: var(--brand-600);
        }

        .profile-contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
          width: 100%;
          background: var(--bg-tertiary);
          padding: 14px 16px;
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--border-color);
        }

        @media (max-width: 640px) {
          .profile-contact-grid {
            grid-template-columns: 1fr;
            padding: 12px;
            gap: 10px;
          }
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
          min-width: 0;
        }

        .contact-item span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .contact-item svg {
          color: var(--text-tertiary);
          min-width: 16px;
          flex-shrink: 0;
        }

        .student-notes-section {
          padding: 12px 14px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          border-left: 3px solid var(--brand-500);
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          word-break: break-word;
        }

        .edit-student-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .edit-student-btn:hover {
          background: var(--brand-50);
          color: var(--brand-600);
          border-color: var(--brand-300);
        }

        @media (max-width: 640px) {
          .edit-student-btn {
            padding: 6px 12px;
            font-size: 12px;
          }
        }

        /* ─── Modal ─────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .modal-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-xl);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
        }

        .modal-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }

        .modal-close:hover {
          background: var(--border-color);
          color: var(--text-primary);
        }

        .modal-body {
          padding: 24px;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid var(--border-color);
        }

        .profile-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1.5px solid var(--border-color);
          margin-bottom: 24px;
          overflow-x: auto;
          padding-bottom: 1px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .profile-tabs::-webkit-scrollbar {
          display: none;
        }

        .profile-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          border: none;
          background: none;
          cursor: pointer;
          position: relative;
          transition: all 0.15s ease;
          white-space: nowrap;
          font-family: inherit;
          min-height: 44px;
        }

        .profile-tab-btn:hover {
          color: var(--text-primary);
        }

        .profile-tab-btn.active {
          color: var(--brand-600);
        }

        .active-tab-line {
          position: absolute;
          bottom: -1.5px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--brand-500);
        }

        .tab-panel-container {
          min-height: 400px;
        }
      `}</style>

      {/* Back button */}
      <button className="back-link" onClick={() => router.push("/students")}>
        <ArrowLeft size={16} />
        Back to Students
      </button>

      {/* Header Profile Info */}
      <div className="profile-header-card">
        <div className="profile-top-row">
          <div className="profile-main-meta">
            <div
              className="profile-avatar"
              style={{ background: getAvatarGradient(student.name) }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div className="profile-name-class">
              <h1>{student.name}</h1>
              {student.class_grade && (
                <span className="profile-class-badge">
                  <GraduationCap size={12} />
                  {student.class_grade}
                  {student.board ? ` • ${student.board}` : ""}
                </span>
              )}
            </div>
          </div>

          <button
            className="edit-student-btn"
            onClick={openEditModal}
            title="Edit student details"
            type="button"
            id="edit-student-details-btn"
          >
            <Edit3 size={15} />
            <span>Edit Details</span>
          </button>
        </div>

        <div className="profile-contact-grid">
          {student.email && (
            <div className="contact-item">
              <Mail size={16} />
              <span>{student.email}</span>
            </div>
          )}
          {student.phone && (
            <div className="contact-item">
              <Phone size={16} />
              <span>Student: {student.phone}</span>
            </div>
          )}
          {student.parent_phone && (
            <div className="contact-item">
              <Phone size={16} />
              <span>Parent: {student.parent_phone}</span>
            </div>
          )}
          {student.date_of_birth && (
            <div className="contact-item" style={{ color: "var(--brand-600)", fontWeight: 500 }}>
              <Cake size={16} style={{ color: "#f59e0b" }} />
              <span>
                Birthday:{" "}
                {new Date(student.date_of_birth + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          {student.monthly_fees !== null && student.monthly_fees !== undefined && (
            <div className="contact-item" style={{ color: "var(--brand-600)", fontWeight: 600 }}>
              <CreditCard size={16} />
              <span>
                Fee: ₹{student.monthly_fees.toLocaleString("en-IN")}/mo
                {student.fee_due_day ? ` (Due: ${student.fee_due_day}th)` : ""}
              </span>
            </div>
          )}
        </div>

        {student.notes && (
          <div className="student-notes-section">
            <strong>Notes:</strong> {student.notes}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="profile-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`profile-tab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id as any)}
              id={`tab-btn-${tab.id}`}
            >
              <tab.icon size={16} />
              {tab.label}
              {isActive && (
                <motion.div
                  className="active-tab-line"
                  layoutId="activeTabLine"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="tab-panel-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {activeTab === "calendar" && (
              <StudentCalendar studentId={studentId} />
            )}
            {activeTab === "homework" && (
              <HomeworkTab studentId={studentId} />
            )}
            {activeTab === "syllabus" && (
              <SyllabusTab studentId={studentId} studentName={student?.name} />
            )}
            {activeTab === "ai" && (
              <AIAssistantTab studentId={studentId} studentName={student?.name} />
            )}
            {activeTab === "tests" && (
              <TestsTab studentId={studentId} />
            )}
            {activeTab === "permissions" && (
              <StudentPermissionsTab studentId={studentId} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <motion.div
              className="modal-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Edit Student Details</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowEditModal(false)}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateMutation.mutate({
                    name: editName,
                    email: editEmail || undefined,
                    phone: editPhone || undefined,
                    parent_phone: editParentPhone || undefined,
                    class_grade: editClassGrade || undefined,
                    board: editBoard || undefined,
                    date_of_birth: editDateOfBirth || undefined,
                    notes: editNotes || undefined,
                    monthly_fees: editMonthlyFees ? parseFloat(editMonthlyFees) : null,
                    fee_due_day: editFeeDueDay ? parseInt(editFeeDueDay, 10) : null,
                  });
                }}
              >
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-name">Full Name *</label>
                    <input
                      id="edit-name"
                      className="form-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-class">Class / Grade</label>
                      <input
                        id="edit-class"
                        className="form-input"
                        placeholder="e.g. 10th, 12th"
                        value={editClassGrade}
                        onChange={(e) => setEditClassGrade(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-board">Board / Curriculum</label>
                      <input
                        id="edit-board"
                        className="form-input"
                        placeholder="e.g. CBSE, ICSE"
                        value={editBoard}
                        onChange={(e) => setEditBoard(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-email">Email Address</label>
                      <input
                        id="edit-email"
                        type="email"
                        className="form-input"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-phone">Student Phone</label>
                      <input
                        id="edit-phone"
                        className="form-input"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-parent-phone">Parent Phone</label>
                    <input
                      id="edit-parent-phone"
                      className="form-input"
                      value={editParentPhone}
                      onChange={(e) => setEditParentPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-dob">Date of Birth 🎂</label>
                    <input
                      id="edit-dob"
                      type="date"
                      className="form-input"
                      value={editDateOfBirth}
                      onChange={(e) => setEditDateOfBirth(e.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-monthly-fees">Monthly Fee (₹)</label>
                      <input
                        id="edit-monthly-fees"
                        type="number"
                        className="form-input"
                        placeholder="e.g. 2000"
                        value={editMonthlyFees}
                        onChange={(e) => setEditMonthlyFees(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-fee-due-day">Fee Due Day of Month</label>
                      <input
                        id="edit-fee-due-day"
                        type="number"
                        min="1"
                        max="31"
                        className="form-input"
                        placeholder="e.g. 5 (5th of month)"
                        value={editFeeDueDay}
                        onChange={(e) => setEditFeeDueDay(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-notes">Notes / Special Instructions</label>
                    <textarea
                      id="edit-notes"
                      className="form-input"
                      placeholder="Add tutor notes..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={updateMutation.isPending || !editName.trim()}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────
const avatarGradients = [
  "linear-gradient(135deg, #6366f1, #4f46e5)",
  "linear-gradient(135deg, #0ea5e9, #0284c7)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #d97706)",
  "linear-gradient(135deg, #ec4899, #db2777)",
  "linear-gradient(135deg, #8b5cf6, #7c3aed)",
  "linear-gradient(135deg, #ef4444, #dc2626)",
  "linear-gradient(135deg, #14b8a6, #0d9488)",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
}
