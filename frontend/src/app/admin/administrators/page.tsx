"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, type AdminUser } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import {
  ShieldCheck,
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
  Crown,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

export default function SuperAdminAdministratorsPage() {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSuperAdmin = user?.email?.toLowerCase() === "admin@studyverse.com";

  const [search, setSearch] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [resettingAdmin, setResettingAdmin] = useState<AdminUser | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminUser | null>(null);

  // Add Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmAddPassword, setConfirmAddPassword] = useState("");
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

  // Delete state
  const [deleteError, setDeleteError] = useState("");

  // ─── Query Admins List ──────────────────────────────────
  const {
    data: admins = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: () => adminApi.getAdmins(),
    select: (res) => res.data,
    enabled: isSuperAdmin,
  });

  // ─── Create Admin Mutation ─────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => {
      if (password !== confirmAddPassword) {
        throw new Error("Passwords do not match.");
      }
      return adminApi.createAdmin({
        full_name: fullName,
        email,
        password,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
      setShowAddModal(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmAddPassword("");
      setFormError("");
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || err.message || "Failed to create administrator account.";
      setFormError(msg);
    },
  });

  // ─── Edit Admin Mutation ──────────────────────────────
  const editMutation = useMutation({
    mutationFn: (adminId: string) =>
      adminApi.updateAdmin(adminId, {
        full_name: editFullName,
        email: editEmail,
        is_active: editIsActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
      setEditingAdmin(null);
      setEditFormError("");
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || "Failed to update administrator account.";
      setEditFormError(msg);
    },
  });

  // ─── Reset Password Mutation ───────────────────────────
  const resetPasswordMutation = useMutation({
    mutationFn: (adminId: string) => {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      return adminApi.resetAdminPassword(adminId, newPassword);
    },
    onSuccess: (res) => {
      setResetSuccess(res.data.message || "Password reset successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setResetError("");
      setTimeout(() => {
        setResettingAdmin(null);
        setResetSuccess("");
      }, 1600);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || err.message || "Failed to reset password.";
      setResetError(msg);
    },
  });

  // ─── Delete Admin Mutation ────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (adminId: string) => adminApi.deleteAdmin(adminId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
      setDeletingAdmin(null);
      setDeleteError("");
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || "Failed to delete administrator account.";
      setDeleteError(msg);
    },
  });

  // Filtered admins
  const filteredAdmins = admins.filter(
    (a) =>
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const openEditModal = (a: AdminUser) => {
    setEditingAdmin(a);
    setEditFullName(a.full_name);
    setEditEmail(a.email);
    setEditIsActive(a.is_active);
    setEditFormError("");
  };

  const openResetModal = (a: AdminUser) => {
    setResettingAdmin(a);
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
    setResetSuccess("");
  };

  const openDeleteModal = (a: AdminUser) => {
    setDeletingAdmin(a);
    setDeleteError("");
  };

  // Guard unauthorized
  if (!isAuthLoading && !isSuperAdmin) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 20px" }}>
        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: 16,
            border: "1px solid var(--border-color)",
            padding: 36,
            textAlign: "center",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.12)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
            <ShieldAlert size={30} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
            Administrator account provisioning and management is exclusively restricted to the Primary Super Administrator (<code style={{ color: "#f59e0b" }}>admin@studyverse.com</code>).
          </p>
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: "#f59e0b",
              color: "white",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Control Panel</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1050 }} className="super-admin-page">
      <style>{`
        .super-admin-page {
          max-width: 1050px;
          margin: 0 auto;
          padding-bottom: 50px;
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

        .header-title-group h1 {
          font-size: clamp(20px, 4vw, 24px);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .super-admin-tag {
          font-size: 11px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-title-group p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .action-header-btns {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .add-admin-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 40px;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
        }

        .add-admin-btn:hover {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(139, 92, 246, 0.35);
        }

        .refresh-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .refresh-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-hover);
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
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }

        .admin-count-pill {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg-tertiary);
          padding: 6px 12px;
          border-radius: 20px;
          border: 1px solid var(--border-color);
        }

        .admins-table-card {
          background: var(--card-bg);
          border-radius: var(--radius, 12px);
          border: 1px solid var(--border-color);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          box-shadow: var(--shadow-sm);
          width: 100%;
        }

        .admins-table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
          text-align: left;
        }

        .admins-table th {
          background: var(--bg-tertiary);
          padding: 14px 20px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-color);
        }

        .admins-table td {
          padding: 16px 20px;
          font-size: 13px;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-color);
          vertical-align: middle;
        }

        .admins-table tr:last-child td {
          border-bottom: none;
        }

        .admin-name-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .admin-avatar.super {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
        }

        .admin-avatar.secondary {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        .role-badge.super {
          background: rgba(245, 158, 11, 0.12);
          color: #d97706;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .role-badge.secondary {
          background: rgba(139, 92, 246, 0.1);
          color: #7c3aed;
          border: 1px solid rgba(139, 92, 246, 0.25);
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

        .icon-action-btn:hover:not(:disabled) {
          background: var(--bg-tertiary);
          border-color: var(--border-hover);
        }

        .icon-action-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .icon-action-btn.edit-btn:hover:not(:disabled) {
          color: #8b5cf6;
        }

        .icon-action-btn.reset-pwd:hover:not(:disabled) {
          color: #2563eb;
        }

        .icon-action-btn.delete-btn {
          color: #ef4444;
        }

        .icon-action-btn.delete-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* Modal styling */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .modal-box {
          background: var(--card-bg);
          border-radius: var(--radius, 14px);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-xl);
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-close-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
        }

        .modal-close-btn:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
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
          letter-spacing: 0.5px;
        }

        .input-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .form-input {
          width: 100%;
          padding: 10px 14px 10px 38px;
          border: 1.5px solid var(--border-color);
          border-radius: 8px;
          font-size: 13px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          outline: none;
          transition: all 0.15s ease;
        }

        .form-input:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: var(--bg-tertiary);
        }

        .form-error {
          font-size: 12px;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .form-success {
          font-size: 12px;
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .cancel-btn {
          padding: 9px 16px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-btn.danger {
          background: #ef4444;
        }

        .submit-btn.danger:hover {
          background: #dc2626;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-primary);
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .search-wrapper {
            max-width: 100%;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header-row">
        <div className="header-title-group">
          <h1>
            <span>Administrator Directory</span>
            <span className="super-admin-tag">Super Admin Only</span>
          </h1>
          <p>Provision and govern secondary administrator accounts, privileges, and security credentials</p>
        </div>

        <div className="action-header-btns">
          <button
            className="refresh-btn"
            onClick={() => refetch()}
            title="Refresh list"
            aria-label="Refresh"
            type="button"
          >
            <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
          </button>
          <button
            className="add-admin-btn"
            onClick={() => {
              setShowAddModal(true);
              setFormError("");
            }}
            type="button"
          >
            <UserPlus size={16} />
            <span>Add Administrator</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-count-pill">
          {filteredAdmins.length} of {admins.length} Administrators
        </div>
      </div>

      {/* Table Card */}
      <div className="admins-table-card">
        <table className="admins-table">
          <thead>
            <tr>
              <th>Administrator</th>
              <th>Role & Access</th>
              <th>Status</th>
              <th>Created</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)" }}>
                  Loading administrators...
                </td>
              </tr>
            ) : filteredAdmins.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)" }}>
                  No administrators found matching "{search}".
                </td>
              </tr>
            ) : (
              filteredAdmins.map((admin) => {
                const isPrimary = admin.is_super_admin;
                return (
                  <tr key={admin.id}>
                    <td>
                      <div className="admin-name-cell">
                        <div className={`admin-avatar ${isPrimary ? "super" : "secondary"}`}>
                          {isPrimary ? <Crown size={18} /> : admin.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{admin.full_name}</span>
                            {isPrimary && (
                              <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }} title="Primary Super Admin">
                                ★
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {admin.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isPrimary ? (
                        <span className="role-badge super">
                          <Crown size={12} />
                          <span>Primary Super Admin</span>
                        </span>
                      ) : (
                        <span className="role-badge secondary">
                          <ShieldCheck size={12} />
                          <span>Secondary Admin</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${admin.is_active ? "active" : "inactive"}`}>
                        {admin.is_active ? (
                          <>
                            <CheckCircle size={12} /> Active
                          </>
                        ) : (
                          <>
                            <XCircle size={12} /> Suspended
                          </>
                        )}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="action-btns" style={{ justifyContent: "flex-end" }}>
                        <button
                          className="icon-action-btn edit-btn"
                          onClick={() => openEditModal(admin)}
                          title="Edit administrator details"
                          type="button"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          className="icon-action-btn reset-pwd"
                          onClick={() => openResetModal(admin)}
                          title="Reset password"
                          type="button"
                        >
                          <KeyRound size={13} />
                          <span>Password</span>
                        </button>
                        <button
                          className="icon-action-btn delete-btn"
                          onClick={() => openDeleteModal(admin)}
                          disabled={isPrimary}
                          title={isPrimary ? "Primary Super Admin cannot be deleted" : "Delete administrator"}
                          type="button"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Add Admin Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <motion.div
              className="modal-box"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  <UserPlus size={18} color="#8b5cf6" />
                  <span>Add New Administrator</span>
                </h3>
                <button
                  className="modal-close-btn"
                  onClick={() => setShowAddModal(false)}
                  type="button"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="form-error">
                  <AlertTriangle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate();
                }}
              >
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-icon-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      className="form-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-icon-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. john.admin@studyverse.com"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Temporary Password</label>
                  <div className="input-icon-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-icon-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Re-enter temporary password"
                      className="form-input"
                      value={confirmAddPassword}
                      onChange={(e) => setConfirmAddPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create Administrator"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Edit Admin Modal ──────────────────────────────── */}
      <AnimatePresence>
        {editingAdmin && (
          <div className="modal-overlay" onClick={() => setEditingAdmin(null)}>
            <motion.div
              className="modal-box"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  <Edit2 size={18} color="#8b5cf6" />
                  <span>Edit Administrator</span>
                </h3>
                <button
                  className="modal-close-btn"
                  onClick={() => setEditingAdmin(null)}
                  type="button"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {editFormError && (
                <div className="form-error">
                  <AlertTriangle size={15} />
                  <span>{editFormError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  editMutation.mutate(editingAdmin.id);
                }}
              >
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-icon-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email Address {editingAdmin.is_super_admin && "(Protected Super Admin)"}
                  </label>
                  <div className="input-icon-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      required
                      disabled={editingAdmin.is_super_admin}
                      className="form-input"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 20 }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      disabled={editingAdmin.is_super_admin}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#8b5cf6" }}
                    />
                    <span>
                      Account is Active {editingAdmin.is_super_admin && "(Super Admin cannot be deactivated)"}
                    </span>
                  </label>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setEditingAdmin(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={editMutation.isPending}
                  >
                    {editMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Reset Password Modal ──────────────────────────── */}
      <AnimatePresence>
        {resettingAdmin && (
          <div className="modal-overlay" onClick={() => setResettingAdmin(null)}>
            <motion.div
              className="modal-box"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  <KeyRound size={18} color="#2563eb" />
                  <span>Reset Administrator Password</span>
                </h3>
                <button
                  className="modal-close-btn"
                  onClick={() => setResettingAdmin(null)}
                  type="button"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>
                Setting a new password for <strong>{resettingAdmin.full_name}</strong> ({resettingAdmin.email}).
              </p>

              {resetError && (
                <div className="form-error">
                  <AlertTriangle size={15} />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="form-success">
                  <Check size={15} />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  resetPasswordMutation.mutate(resettingAdmin.id);
                }}
              >
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-icon-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Enter new password"
                      className="form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div className="input-icon-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Confirm new password"
                      className="form-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setResettingAdmin(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    style={{ background: "#2563eb" }}
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? "Resetting..." : "Update Password"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Delete Admin Modal ────────────────────────────── */}
      <AnimatePresence>
        {deletingAdmin && (
          <div className="modal-overlay" onClick={() => setDeletingAdmin(null)}>
            <motion.div
              className="modal-box"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  <Trash2 size={18} color="#ef4444" />
                  <span>Delete Administrator</span>
                </h3>
                <button
                  className="modal-close-btn"
                  onClick={() => setDeletingAdmin(null)}
                  type="button"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {deleteError && (
                <div className="form-error">
                  <AlertTriangle size={15} />
                  <span>{deleteError}</span>
                </div>
              )}

              <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 14 }}>
                Are you sure you want to permanently delete administrator{" "}
                <strong>{deletingAdmin.full_name}</strong> ({deletingAdmin.email})?
              </p>

              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 12,
                  color: "#ef4444",
                  lineHeight: 1.5,
                }}
              >
                ⚠️ <strong>Warning:</strong> This action is irreversible. The administrator will immediately lose all access to the administrative control panel.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setDeletingAdmin(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="submit-btn danger"
                  onClick={() => deleteMutation.mutate(deletingAdmin.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
