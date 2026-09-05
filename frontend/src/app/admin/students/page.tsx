"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  adminApi,
  type AdminStudent,
  type AdminTeacher,
  type AssignedTeacherInfo,
} from "@/lib/api";
import {
  GraduationCap,
  Search,
  CheckCircle,
  XCircle,
  X,
  Mail,
  Lock,
  User,
  Phone,
  BookOpen,
  ShieldAlert,
  Edit2,
  KeyRound,
  Check,
  Plus,
  Trash2,
} from "lucide-react";

export default function AdminStudentsPage() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [boardFilter, setBoardFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [resettingStudent, setResettingStudent] = useState<AdminStudent | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<AdminStudent | null>(null);

  // Edit Student Form State
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editClassGrade, setEditClassGrade] = useState("");
  const [editBoard, setEditBoard] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editFormError, setEditFormError] = useState("");

  // Assigned Teachers State in Edit Modal
  const [selectedTeacherToAdd, setSelectedTeacherToAdd] = useState("");

  // Reset Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // ─── Query Students ──────────────────────────────────────
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["admin-students", search, gradeFilter, boardFilter, statusFilter],
    queryFn: () =>
      adminApi.getStudents({
        search: search || undefined,
        class_grade: gradeFilter || undefined,
        board: boardFilter || undefined,
        is_active: statusFilter === "all" ? undefined : statusFilter === "active",
      }),
    select: (res) => res.data,
  });

  // ─── Query Teachers for Assignment Dropdown ──────────────
  const { data: allTeachers = [] } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: () => adminApi.getTeachers(),
    select: (res) => res.data,
  });

  // ─── Mutations ───────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: (studentId: string) =>
      adminApi.updateStudent(studentId, {
        name: editName,
        email: editEmail || undefined,
        phone: editPhone || undefined,
        parent_phone: editParentPhone || undefined,
        class_grade: editClassGrade || undefined,
        board: editBoard || undefined,
        notes: editNotes || undefined,
        is_active: editIsActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setEditingStudent(null);
      setEditFormError("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setEditFormError(
        axiosErr.response?.data?.detail || "Failed to update student profile."
      );
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminApi.updateStudentStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
    },
  });

  const [deleteError, setDeleteError] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (studentId: string) => adminApi.deleteStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setDeletingStudent(null);
      setDeleteError("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setDeleteError(
        axiosErr.response?.data?.detail || "Failed to delete student record."
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (studentId: string) =>
      adminApi.resetStudentPassword(studentId, newPassword),
    onSuccess: (res) => {
      setResetSuccess(res.data.message || "Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setResetError("");
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setTimeout(() => {
        setResettingStudent(null);
        setResetSuccess("");
      }, 1800);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setResetError(
        axiosErr.response?.data?.detail || "Failed to reset password."
      );
    },
  });

  const addTeacherMutation = useMutation({
    mutationFn: ({ studentId, teacherId }: { studentId: string; teacherId: string }) =>
      adminApi.addStudentTeacher(studentId, teacherId),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      if (editingStudent && editingStudent.id === variables.studentId) {
        setEditingStudent({
          ...editingStudent,
          assigned_teachers: res.data,
        });
      }
      setSelectedTeacherToAdd("");
    },
  });

  const removeTeacherMutation = useMutation({
    mutationFn: ({ studentId, teacherId }: { studentId: string; teacherId: string }) =>
      adminApi.removeStudentTeacher(studentId, teacherId),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      if (editingStudent && editingStudent.id === variables.studentId) {
        setEditingStudent({
          ...editingStudent,
          assigned_teachers: res.data,
        });
      }
    },
  });

  const openEditModal = (student: AdminStudent) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditEmail(student.email || "");
    setEditPhone(student.phone || "");
    setEditParentPhone(student.parent_phone || "");
    setEditClassGrade(student.class_grade || "");
    setEditBoard(student.board || "");
    setEditNotes(student.notes || "");
    setEditIsActive(student.is_active);
    setEditFormError("");
    setSelectedTeacherToAdd("");
  };

  const openResetModal = (student: AdminStudent) => {
    setResettingStudent(student);
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
    setResetSuccess("");
  };

  // Get unique grades and boards for filter options
  const uniqueGrades = Array.from(
    new Set(students.map((s) => s.class_grade).filter(Boolean))
  );
  const defaultBoards = ["CBSE", "ICSE", "WBBSE"];
  const uniqueBoards = Array.from(
    new Set([...defaultBoards, ...students.map((s) => s.board).filter(Boolean)])
  );

  return (
    <div style={{ maxWidth: 1100 }} className="admin-students-page">
      <style>{`
        .admin-students-page {
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-row h1 {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .header-row p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .filters-card {
          background: var(--card-bg);
          border-radius: var(--radius, 12px);
          border: 1px solid var(--border-color);
          padding: 16px 20px;
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          box-shadow: var(--shadow-sm);
        }

        .search-wrapper {
          position: relative;
          flex: 1;
          min-width: 240px;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
          z-index: 2;
        }

        .search-input {
          width: 100%;
          padding: 10px 14px 10px 42px !important;
          border: 1.5px solid var(--border-color);
          border-radius: 8px;
          font-size: 13px;
          background: var(--card-bg);
          color: var(--text-primary);
          outline: none;
          min-height: 40px;
          transition: all 0.15s ease;
        }

        .search-input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }

        .filter-select {
          padding: 10px 14px;
          border: 1.5px solid var(--border-color);
          border-radius: 8px;
          font-size: 13px;
          background: var(--card-bg);
          color: var(--text-primary);
          cursor: pointer;
          outline: none;
          min-height: 40px;
        }

        .filter-select:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }

        .students-table-card {
          background: var(--card-bg);
          border-radius: var(--radius, 12px);
          border: 1px solid var(--border-color);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .students-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
          text-align: left;
        }

        .students-table th {
          background: var(--bg-tertiary);
          padding: 12px 18px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-color);
        }

        .students-table td {
          padding: 14px 18px;
          font-size: 13px;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-color);
        }

        .students-table tr:last-child td {
          border-bottom: none;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.active {
          background: var(--success-light);
          color: var(--success);
        }

        .status-badge.inactive {
          background: var(--danger-light);
          color: var(--danger);
        }

        .teacher-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          background: var(--brand-50);
          color: var(--brand-600);
          font-size: 11px;
          font-weight: 600;
          margin-right: 4px;
          margin-bottom: 4px;
        }

        .action-btns {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          flex-wrap: wrap;
        }

        .icon-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 34px;
        }

        .icon-action-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--border-hover);
        }

        .icon-action-btn.reset-pwd:hover {
          color: #2563eb;
          border-color: #93c5fd;
          background: var(--info-light);
        }

        .icon-action-btn.delete-btn {
          color: var(--danger);
          border-color: var(--border-color);
          background: var(--danger-light);
        }

        .toggle-btn {
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 34px;
        }

        .toggle-btn.deactivate {
          color: var(--warning);
          background: var(--warning-light);
        }

        .toggle-btn.activate {
          color: var(--success);
          background: var(--success-light);
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 20px;
        }

        .modal-content {
          background: var(--card-bg);
          border-radius: 16px;
          width: 100%;
          max-width: 620px;
          box-shadow: var(--shadow-xl);
          border: 1px solid var(--border-color);
          overflow: hidden;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 18px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
        }

        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: #d97706;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border-color);
        }

        :root.dark .section-title,
        [data-theme="dark"] .section-title {
          color: #fbbf24;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 20px;
        }

        @media (max-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        .form-group {
          margin-bottom: 12px;
        }

        .form-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .form-input-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
        }

        .form-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
          z-index: 2;
        }

        .form-input {
          width: 100% !important;
          padding: 10px 14px 10px 42px !important;
          border: 1.5px solid var(--border-color) !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          background: var(--card-bg) !important;
          color: var(--text-primary) !important;
          outline: none !important;
          min-height: 40px !important;
          font-family: inherit !important;
          transition: all 0.15s ease !important;
        }

        .form-input:focus {
          border-color: #f59e0b !important;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15) !important;
        }

        .notes-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1.5px solid var(--border-color);
          border-radius: 8px;
          font-size: 13px;
          background: var(--card-bg);
          color: var(--text-primary);
          outline: none;
          font-family: inherit;
          resize: vertical;
          transition: all 0.15s ease;
        }

        .notes-textarea:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }

        .btn-cancel {
          padding: 9px 18px;
          border-radius: 8px;
          border: 1.5px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          min-height: 38px;
        }

        .btn-cancel:hover {
          background: var(--bg-tertiary);
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .assigned-teachers-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .teacher-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .remove-teacher-btn {
          background: none;
          border: none;
          color: var(--danger);
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
        }

        .remove-teacher-btn:hover {
          background: var(--danger-light);
        }

        .add-teacher-row {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="header-row"
      >
        <div>
          <h1>Student Accounts Management</h1>
          <p>View student records, edit profiles, manage teacher assignments & reset passwords</p>
        </div>
      </motion.div>

      {/* Filters Toolbar */}
      <div className="filters-card">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by student name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
        >
          <option value="">All Classes / Grades</option>
          {uniqueGrades.map((g) => (
            <option key={g} value={g as string}>
              {g}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={boardFilter}
          onChange={(e) => setBoardFilter(e.target.value)}
        >
          <option value="">All Boards</option>
          {uniqueBoards.map((b) => (
            <option key={b} value={b as string}>
              {b}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Account Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Students Table */}
      {isLoading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--gray-400)" }}>
          Loading student roster...
        </div>
      ) : students.length > 0 ? (
        <div className="table-responsive">
          <table className="students-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Email & Phone</th>
                <th>Class / Board</th>
                <th>Assigned Teachers</th>
                <th>Status</th>
                <th style={{ width: 240, textAlign: "right", paddingRight: 20 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student: AdminStudent) => (
                <tr key={student.id} id={`student-row-${student.id}`}>
                  <td>
                    <strong style={{ color: "var(--text-primary)" }}>{student.name}</strong>
                    {student.notes && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {student.notes.length > 40
                          ? `${student.notes.substring(0, 40)}...`
                          : student.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{student.email || <span style={{ color: "var(--text-tertiary)" }}>No email</span>}</div>
                    {student.phone && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        Ph: {student.phone}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{student.class_grade || "N/A"}</span>
                    {student.board && (
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>
                        ({student.board})
                      </span>
                    )}
                  </td>
                  <td>
                    {student.assigned_teachers.length > 0 ? (
                      <div>
                        {student.assigned_teachers.map((t: AssignedTeacherInfo) => (
                          <span key={t.id} className="teacher-badge">
                            {t.full_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>None Assigned</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        student.is_active ? "active" : "inactive"
                      }`}
                    >
                      {student.is_active ? (
                        <>
                          <CheckCircle size={11} /> Active
                        </>
                      ) : (
                        <>
                          <XCircle size={11} /> Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="icon-action-btn"
                        onClick={() => openEditModal(student)}
                        title="Edit Student"
                        type="button"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        className="icon-action-btn reset-pwd"
                        onClick={() => openResetModal(student)}
                        title="Reset Password"
                        type="button"
                      >
                        <KeyRound size={13} />
                        <span>Password</span>
                      </button>

                      <button
                        className={`toggle-btn ${
                          student.is_active ? "deactivate" : "activate"
                        }`}
                        onClick={() =>
                          statusMutation.mutate({
                            id: student.id,
                            is_active: !student.is_active,
                          })
                        }
                        disabled={statusMutation.isPending}
                        type="button"
                      >
                        {student.is_active ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        className="icon-action-btn delete-btn"
                        onClick={() => {
                          setDeletingStudent(student);
                          setDeleteError("");
                        }}
                        disabled={deleteMutation.isPending}
                        title="Delete Student Record"
                        type="button"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius, 12px)",
            padding: "64px 32px",
            textAlign: "center",
          }}
        >
          <GraduationCap size={32} style={{ color: "var(--text-tertiary)", marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            No students found
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Try adjusting your search query or clear existing filter selections.
          </p>
        </div>
      )}

      {/* Edit Student Modal */}
      <AnimatePresence>
        {editingStudent && (
          <div className="modal-overlay" onClick={() => setEditingStudent(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Edit2 size={18} style={{ color: "#f59e0b" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                    Edit Student Profile: {editingStudent.name}
                  </h3>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                  onClick={() => setEditingStudent(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                {editFormError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      color: "#dc2626",
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ShieldAlert size={16} />
                    <span>{editFormError}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    editMutation.mutate(editingStudent.id);
                  }}
                >
                  {/* Personal Information */}
                  <div className="section-title">Personal Information</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Student Name *</label>
                      <div className="form-input-wrapper">
                        <User size={15} className="form-input-icon" />
                        <input
                          type="text"
                          className="form-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <div className="form-input-wrapper">
                        <Mail size={15} className="form-input-icon" />
                        <input
                          type="email"
                          className="form-input"
                          placeholder="student@example.com"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <div className="form-input-wrapper">
                        <Phone size={15} className="form-input-icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Student phone"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Parent Phone Number</label>
                      <div className="form-input-wrapper">
                        <Phone size={15} className="form-input-icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Parent phone"
                          value={editParentPhone}
                          onChange={(e) => setEditParentPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div className="section-title">Academic Information</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Class / Grade</label>
                      <div className="form-input-wrapper">
                        <BookOpen size={15} className="form-input-icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Class 10"
                          value={editClassGrade}
                          onChange={(e) => setEditClassGrade(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Board</label>
                      <div className="form-input-wrapper">
                        <BookOpen size={15} className="form-input-icon" />
                        <input
                          type="text"
                          className="form-input"
                          list="admin-board-options"
                          placeholder="e.g. CBSE / ICSE / WBBSE"
                          value={editBoard}
                          onChange={(e) => setEditBoard(e.target.value)}
                        />
                        <datalist id="admin-board-options">
                          <option value="CBSE" />
                          <option value="ICSE" />
                          <option value="WBBSE" />
                          <option value="State Board" />
                          <option value="IB" />
                          <option value="IGCSE" />
                        </datalist>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes & Remarks</label>
                    <textarea
                      rows={2}
                      className="notes-textarea"
                      placeholder="Additional notes about student progress..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>

                  {/* Assigned Teachers (Many-to-Many) */}
                  <div className="section-title">Assigned Teachers (Multiple)</div>
                  <div className="assigned-teachers-list">
                    {editingStudent.assigned_teachers.length > 0 ? (
                      editingStudent.assigned_teachers.map((t: AssignedTeacherInfo) => (
                        <div key={t.id} className="teacher-chip">
                          <span>{t.full_name}</span>
                          <button
                            type="button"
                            className="remove-teacher-btn"
                            onClick={() =>
                              removeTeacherMutation.mutate({
                                studentId: editingStudent.id,
                                teacherId: t.id,
                              })
                            }
                            title="Remove teacher assignment"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No teachers assigned yet.</p>
                    )}
                  </div>

                  <div className="add-teacher-row">
                    <select
                      className="filter-select"
                      style={{ flex: 1 }}
                      value={selectedTeacherToAdd}
                      onChange={(e) => setSelectedTeacherToAdd(e.target.value)}
                    >
                      <option value="">Select a teacher to assign...</option>
                      {allTeachers
                        .filter(
                          (t) =>
                            !editingStudent?.assigned_teachers?.some(
                              (at: AssignedTeacherInfo) => at.id === t.id
                            )
                        )
                        .map((t: AdminTeacher) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name} - {t.email}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "#2563eb",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      disabled={!selectedTeacherToAdd || addTeacherMutation.isPending}
                      onClick={() => {
                        if (selectedTeacherToAdd) {
                          addTeacherMutation.mutate({
                            studentId: editingStudent.id,
                            teacherId: selectedTeacherToAdd,
                          });
                        }
                      }}
                    >
                      <Plus size={14} />
                      <span>Assign</span>
                    </button>
                  </div>

                  {/* Account Status */}
                  <div className="section-title">Account Status</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--bg-tertiary)",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      marginBottom: 20,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: editIsActive ? "#059669" : "#dc2626",
                      }}
                    >
                      {editIsActive ? "Active Student Account" : "Deactivated Student Account"}
                    </span>
                    <button
                      type="button"
                      className={`toggle-btn ${editIsActive ? "deactivate" : "activate"}`}
                      onClick={() => setEditIsActive(!editIsActive)}
                    >
                      {editIsActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setEditingStudent(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: "9px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: "#f59e0b",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                      disabled={editMutation.isPending || !editName}
                    >
                      {editMutation.isPending ? "Saving..." : "Save Student Profile"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resettingStudent && (
          <div className="modal-overlay" onClick={() => setResettingStudent(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ maxWidth: 440 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <KeyRound size={18} style={{ color: "#3b82f6" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Reset Student Password</h3>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
                  onClick={() => setResettingStudent(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newPassword !== confirmPassword) {
                    setResetError("Passwords do not match.");
                    return;
                  }
                  resetPasswordMutation.mutate(resettingStudent.id);
                }}
              >
                <div className="modal-body">
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    Set a new password for student <strong style={{ color: "var(--text-primary)" }}>{resettingStudent.name}</strong>. If no linked login exists, an account will be generated.
                  </p>

                  {resetSuccess && (
                    <div
                      style={{
                        background: "var(--success-light)",
                        color: "var(--success)",
                        padding: "10px 14px",
                        borderRadius: 8,
                        fontSize: 13,
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Check size={16} />
                      <span>{resetSuccess}</span>
                    </div>
                  )}

                  {resetError && (
                    <div
                      style={{
                        background: "var(--danger-light)",
                        color: "var(--danger)",
                        padding: "10px 14px",
                        borderRadius: 8,
                        fontSize: 13,
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <ShieldAlert size={16} />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">New Password *</label>
                    <div className="form-input-wrapper">
                      <Lock size={15} className="form-input-icon" />
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setResetError("");
                        }}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password *</label>
                    <div className="form-input-wrapper">
                      <Lock size={15} className="form-input-icon" />
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setResetError("");
                        }}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setResettingStudent(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: "9px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: "#2563eb",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                      disabled={resetPasswordMutation.isPending || !newPassword || !confirmPassword}
                    >
                      {resetPasswordMutation.isPending ? "Setting..." : "Reset Password"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Student Modal */}
      <AnimatePresence>
        {deletingStudent && (
          <div className="modal-overlay" onClick={() => setDeletingStudent(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ maxWidth: 460 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ background: "#7f1d1d" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Trash2 size={18} style={{ color: "#fca5a5" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "white" }}>Delete Student Record</h3>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}
                  onClick={() => setDeletingStudent(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                {deleteError && (
                  <div
                    style={{
                      background: "var(--danger-light)",
                      color: "var(--danger)",
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ShieldAlert size={16} />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div
                  style={{
                    background: "var(--danger-light)",
                    color: "var(--danger)",
                    padding: "14px",
                    borderRadius: 8,
                    fontSize: 13,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                  }}
                >
                  <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ color: "var(--danger)" }}>Warning: Permanent Deletion</strong>
                    <p style={{ marginTop: 4, margin: 0, fontSize: 12.5, color: "var(--text-primary)" }}>
                      Are you sure you want to permanently delete student <strong>{deletingStudent.name}</strong>?
                      This will delete the student profile, credentials, academic records, attendance, and all associated data.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setDeletingStudent(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "#dc2626",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => deleteMutation.mutate(deletingStudent.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={15} />
                    <span>{deleteMutation.isPending ? "Deleting..." : "Permanently Delete"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
