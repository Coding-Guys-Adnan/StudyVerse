"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, type AdminTeacher } from "@/lib/api";
import {
  Users,
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  X,
  Mail,
  Lock,
  User,
  ShieldAlert,
  Edit2,
  KeyRound,
  Check,
  Trash2,
} from "lucide-react";

export default function AdminTeachersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacher | null>(null);
  const [resettingTeacher, setResettingTeacher] = useState<AdminTeacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<AdminTeacher | null>(null);

  // Add Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  // Edit Form state
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editFormError, setEditFormError] = useState("");

  // Reset Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // ─── Query Teachers List ────────────────────────────────
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: () => adminApi.getTeachers(),
    select: (res) => res.data,
  });

  // ─── Create Teacher Mutation ───────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createTeacher({ full_name: fullName, email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      setShowAddModal(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setFormError("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setFormError(
        axiosErr.response?.data?.detail || "Failed to create teacher account."
      );
    },
  });

  // ─── Edit Teacher Mutation ────────────────────────────
  const editMutation = useMutation({
    mutationFn: (teacherId: string) =>
      adminApi.updateTeacher(teacherId, {
        full_name: editFullName,
        email: editEmail,
        is_active: editIsActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      setEditingTeacher(null);
      setEditFormError("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setEditFormError(
        axiosErr.response?.data?.detail || "Failed to update teacher account."
      );
    },
  });

  // ─── Reset Password Mutation ───────────────────────────
  const resetPasswordMutation = useMutation({
    mutationFn: (teacherId: string) =>
      adminApi.resetTeacherPassword(teacherId, newPassword),
    onSuccess: (res) => {
      setResetSuccess(res.data.message || "Password reset successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setResetError("");
      setTimeout(() => {
        setResettingTeacher(null);
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

  // ─── Toggle Status Mutation ─────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminApi.updateTeacherStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
    },
  });

  // ─── Delete Teacher Mutation ────────────────────────────
  const [deleteError, setDeleteError] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (teacherId: string) => adminApi.deleteTeacher(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      setDeletingTeacher(null);
      setDeleteError("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setDeleteError(
        axiosErr.response?.data?.detail || "Failed to delete teacher account."
      );
    },
  });

  // Filtered teachers
  const filteredTeachers = teachers.filter(
    (t) =>
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  const openEditModal = (t: AdminTeacher) => {
    setEditingTeacher(t);
    setEditFullName(t.full_name);
    setEditEmail(t.email);
    setEditIsActive(t.is_active);
    setEditFormError("");
  };

  const openResetModal = (t: AdminTeacher) => {
    setResettingTeacher(t);
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
    setResetSuccess("");
  };

  return (
    <div style={{ maxWidth: 1050 }} className="admin-teachers-page">
      <style>{`
        .admin-teachers-page {
          max-width: 1050px;
          margin: 0 auto;
          padding-bottom: 40px;
          width: 100%;
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
          font-size: clamp(20px, 4vw, 24px);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .header-row p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .add-teacher-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 40px;
        }

        .add-teacher-btn:hover {
          background: #d97706;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .search-wrapper {
          position: relative;
          flex: 1;
          max-width: 380px;
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

        .teachers-table-card {
          background: var(--card-bg);
          border-radius: var(--radius, 12px);
          border: 1px solid var(--border-color);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          box-shadow: var(--shadow-sm);
          width: 100%;
        }

        .teachers-table {
          width: 100%;
          min-width: 780px;
          border-collapse: collapse;
          text-align: left;
        }

        .teachers-table th {
          background: var(--bg-tertiary);
          padding: 12px 20px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-color);
        }

        .teachers-table td {
          padding: 16px 20px;
          font-size: 13px;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-color);
        }

        .teachers-table tr:last-child td {
          border-bottom: none;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
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
          max-width: 460px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-xl);
          border: 1px solid var(--border-color);
          overflow: hidden;
        }

        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          flex-shrink: 0;
        }

        .modal-body {
          padding: 22px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
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
          font-size: 14px !important;
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

        .toggle-switch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          gap: 12px;
        }

        @media (max-width: 640px) {
          .header-row {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .add-teacher-btn {
            width: 100%;
            justify-content: center;
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-wrapper {
            max-width: 100%;
            width: 100%;
          }

          .modal-overlay {
            padding: 12px;
          }

          .modal-content {
            max-height: 92vh;
            border-radius: 12px;
          }

          .modal-header {
            padding: 14px 16px;
          }

          .modal-body {
            padding: 16px;
          }
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="header-row"
      >
        <div>
          <h1>Teacher Accounts Management</h1>
          <p>Create credentials, edit teacher details, reset passwords & toggle status</p>
        </div>
        <button
          className="add-teacher-btn"
          onClick={() => {
            setShowAddModal(true);
            setFormError("");
          }}
          id="add-teacher-btn"
        >
          <UserPlus size={18} />
          <span>Add New Teacher</span>
        </button>
      </motion.div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by teacher name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Teachers Table */}
      {isLoading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--gray-400)" }}>
          Loading teacher roster...
        </div>
      ) : filteredTeachers.length > 0 ? (
        <div className="teachers-table-card">
          <table className="teachers-table">
            <thead>
              <tr>
                <th>Teacher Name</th>
                <th>Email Address</th>
                <th>Enrolled Students</th>
                <th>Status</th>
                <th>Created Date</th>
                <th style={{ width: 240, textAlign: "right", paddingRight: 20 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher: AdminTeacher) => (
                <tr key={teacher.id} id={`teacher-row-${teacher.id}`}>
                  <td>
                    <strong style={{ color: "var(--text-primary)" }}>{teacher.full_name}</strong>
                  </td>
                  <td>{teacher.email}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: "#2563eb" }}>
                      {teacher.student_count} Students
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        teacher.is_active ? "active" : "inactive"
                      }`}
                    >
                      {teacher.is_active ? (
                        <>
                          <CheckCircle size={12} /> Active
                        </>
                      ) : (
                        <>
                          <XCircle size={12} /> Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td>
                    {new Date(teacher.created_at).toLocaleDateString("default", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <div className="action-btns" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="icon-action-btn"
                        onClick={() => openEditModal(teacher)}
                        title="Edit Teacher"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        className="icon-action-btn reset-pwd"
                        onClick={() => openResetModal(teacher)}
                        title="Reset Password"
                      >
                        <KeyRound size={13} />
                        <span>Password</span>
                      </button>

                      <button
                        className={`toggle-btn ${
                          teacher.is_active ? "deactivate" : "activate"
                        }`}
                        onClick={() =>
                          statusMutation.mutate({
                            id: teacher.id,
                            is_active: !teacher.is_active,
                          })
                        }
                        disabled={statusMutation.isPending}
                        title={teacher.is_active ? "Deactivate Account" : "Activate Account"}
                      >
                        {teacher.is_active ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        className="icon-action-btn delete-btn"
                        onClick={() => {
                          setDeletingTeacher(teacher);
                          setDeleteError("");
                        }}
                        disabled={deleteMutation.isPending}
                        title="Delete Teacher Account"
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
          <Users size={32} style={{ color: "var(--text-tertiary)", marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            No teachers found
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {search
              ? "No teacher accounts match your search query."
              : "Click 'Add New Teacher' to provision your first tutor account."}
          </p>
        </div>
      )}

      {/* Add Teacher Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <UserPlus size={18} style={{ color: "#f59e0b" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Create Teacher Account</h3>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
                  onClick={() => setShowAddModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate();
                }}
              >
                <div className="modal-body">
                  {formError && (
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
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <div className="form-input-wrapper">
                      <User size={16} className="form-input-icon" />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Dr. Richard Sharma"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <div className="form-input-wrapper">
                      <Mail size={16} className="form-input-icon" />
                      <input
                        type="email"
                        className="form-input"
                        placeholder="teacher@tuition.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <div className="form-input-wrapper">
                      <Lock size={16} className="form-input-icon" />
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Enter account password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#f59e0b", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                      disabled={createMutation.isPending || !fullName || !email || !password}
                      id="save-teacher-btn"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Teacher Account"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Teacher Modal */}
      <AnimatePresence>
        {editingTeacher && (
          <div className="modal-overlay" onClick={() => setEditingTeacher(null)}>
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
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Edit Teacher Account</h3>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
                  onClick={() => setEditingTeacher(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  editMutation.mutate(editingTeacher.id);
                }}
              >
                <div className="modal-body">
                  {editFormError && (
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
                      <span>{editFormError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <div className="form-input-wrapper">
                      <User size={16} className="form-input-icon" />
                      <input
                        type="text"
                        className="form-input"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <div className="form-input-wrapper">
                      <Mail size={16} className="form-input-icon" />
                      <input
                        type="email"
                        className="form-input"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Status</label>
                    <div className="toggle-switch-row">
                      <span style={{ fontSize: 13, fontWeight: 600, color: editIsActive ? "#059669" : "#dc2626" }}>
                        {editIsActive ? "Active Account" : "Deactivated Account"}
                      </span>
                      <button
                        type="button"
                        className={`toggle-btn ${editIsActive ? "deactivate" : "activate"}`}
                        onClick={() => setEditIsActive(!editIsActive)}
                      >
                        {editIsActive ? "Set Inactive" : "Set Active"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setEditingTeacher(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#f59e0b", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                      disabled={editMutation.isPending || !editFullName || !editEmail}
                    >
                      {editMutation.isPending ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resettingTeacher && (
          <div className="modal-overlay" onClick={() => setResettingTeacher(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <KeyRound size={18} style={{ color: "#3b82f6" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Reset Password</h3>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
                  onClick={() => setResettingTeacher(null)}
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
                  resetPasswordMutation.mutate(resettingTeacher.id);
                }}
              >
                <div className="modal-body">
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    Resetting password for <strong style={{ color: "var(--text-primary)" }}>{resettingTeacher.full_name}</strong> ({resettingTeacher.email}). Existing password is never stored or shown in plaintext.
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
                      <Lock size={16} className="form-input-icon" />
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
                      <Lock size={16} className="form-input-icon" />
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
                      onClick={() => setResettingTeacher(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                      disabled={resetPasswordMutation.isPending || !newPassword || !confirmPassword}
                    >
                      {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Teacher Modal */}
      <AnimatePresence>
        {deletingTeacher && (
          <div className="modal-overlay" onClick={() => setDeletingTeacher(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ background: "#7f1d1d" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Trash2 size={18} style={{ color: "#fca5a5" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "white" }}>Delete Teacher Account</h3>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}
                  onClick={() => setDeletingTeacher(null)}
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
                      Are you sure you want to permanently delete teacher account for{" "}
                      <strong>{deletingTeacher.full_name}</strong> ({deletingTeacher.email})?
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setDeletingTeacher(null)}
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
                    onClick={() => deleteMutation.mutate(deletingTeacher.id)}
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
