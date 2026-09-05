"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  Phone,
  Mail,
  GraduationCap,
  User,
  BookOpen,
  AlertTriangle,
  ChevronRight,
  Cake,
} from "lucide-react";
import { studentsApi, type Student, type StudentCreate } from "@/lib/students-api";
import Link from "next/link";

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  // ─── Queries ────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["students", search, classFilter],
    queryFn: () =>
      studentsApi.list({
        search: search || undefined,
        class_grade: classFilter || undefined,
      }),
    select: (res) => res.data,
  });

  const students = data?.students || [];
  const total = data?.total || 0;

  // Get unique classes for filter dropdown
  const uniqueClasses = Array.from(
    new Set(students.map((s) => s.class_grade).filter(Boolean))
  ).sort();

  // ─── Mutations ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: StudentCreate) => studentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StudentCreate }) =>
      studentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setShowModal(false);
      setEditingStudent(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDeleteTarget(null);
    },
  });

  const openAddModal = useCallback(() => {
    setEditingStudent(null);
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((student: Student) => {
    setEditingStudent(student);
    setShowModal(true);
  }, []);

  return (
    <div className="students-page">
      <style>{`
        .students-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .page-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .page-header p {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .add-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          min-height: 42px;
        }

        .add-btn:hover {
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
          transform: translateY(-1px);
        }

        .filters-row {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .search-bar {
          position: relative;
          flex: 1;
          min-width: 240px;
        }

        .search-bar input {
          width: 100%;
          padding: 10px 14px 10px 40px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 14px;
          color: var(--text-primary);
          background: var(--card-bg);
          transition: all 0.15s ease;
          font-family: inherit;
          min-height: 42px;
        }

        .search-bar input:focus {
          outline: none;
          border-color: var(--brand-400);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .search-bar-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
        }

        .filter-select {
          padding: 10px 14px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 14px;
          color: var(--text-primary);
          background: var(--card-bg);
          font-family: inherit;
          min-width: 160px;
          cursor: pointer;
          min-height: 42px;
        }

        .filter-select:focus {
          outline: none;
          border-color: var(--brand-400);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .student-count {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        /* ─── Student Grid ──────────────────────────── */
        .students-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        @media (max-width: 480px) {
          .students-grid {
            grid-template-columns: 1fr;
          }
        }

        .student-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          padding: 20px;
          border: 1px solid var(--border-color);
          transition: all 0.2s ease;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          display: block;
          position: relative;
        }

        .student-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
          border-color: var(--brand-300);
        }

        .student-card-top {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .student-avatar {
          width: 46px;
          height: 46px;
          min-width: 46px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          color: white;
        }

        .student-card-info h3 {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .student-card-info .class-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .student-card-meta {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .meta-row svg {
          min-width: 14px;
          color: var(--text-tertiary);
        }

        .student-card-actions {
          position: absolute;
          top: 14px;
          right: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          opacity: 1;
          z-index: 5;
        }

        .card-action-btn {
          height: 30px;
          padding: 0 10px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          color: var(--text-primary);
        }

        .card-action-btn:hover {
          background: var(--brand-50);
          color: var(--brand-600);
          border-color: var(--brand-300);
        }

        .card-action-btn.danger {
          width: 30px;
          padding: 0;
          justify-content: center;
          color: var(--text-secondary);
        }

        .card-action-btn.danger:hover {
          background: var(--danger-light);
          color: var(--danger);
          border-color: rgba(239, 68, 68, 0.2);
        }

        .card-chevron {
          position: absolute;
          right: 16px;
          bottom: 20px;
          color: var(--text-tertiary);
          transition: all 0.15s ease;
        }

        .student-card:hover .card-chevron {
          color: var(--brand-400);
          transform: translateX(3px);
        }

        /* ─── Empty State ───────────────────────────── */
        .empty-students {
          background: var(--card-bg);
          border-radius: var(--radius);
          padding: 64px 32px;
          border: 1px solid var(--border-color);
          text-align: center;
        }

        .empty-students-icon {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: var(--bg-tertiary);
          color: var(--brand-500);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .empty-students h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .empty-students p {
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 360px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* ─── Loading Skeleton ──────────────────────── */
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .skeleton-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          padding: 20px;
          border: 1px solid var(--border-color);
        }

        .skeleton-line {
          height: 14px;
          background: var(--bg-tertiary);
          border-radius: 6px;
          animation: pulse-soft 1.5s ease-in-out infinite;
        }

        .skeleton-avatar {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: var(--bg-tertiary);
          animation: pulse-soft 1.5s ease-in-out infinite;
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

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 540px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .form-input {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 14px;
          color: var(--text-primary);
          background: var(--card-bg);
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--brand-400);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .form-input::placeholder {
          color: var(--text-tertiary);
        }

        textarea.form-input {
          min-height: 80px;
          resize: vertical;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid var(--border-color);
        }

        .btn-secondary {
          padding: 10px 20px;
          background: var(--card-bg);
          color: var(--text-primary);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .btn-secondary:hover {
          background: var(--bg-tertiary);
          border-color: var(--border-hover);
        }

        .btn-primary {
          padding: 10px 20px;
          background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-danger {
          padding: 10px 20px;
          background: var(--danger);
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .btn-danger:hover:not(:disabled) {
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
        }

        .btn-danger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* ─── Delete Confirm ────────────────────────── */
        .delete-modal-body {
          padding: 24px;
          text-align: center;
        }

        .delete-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: var(--danger-light);
          color: var(--danger);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .delete-modal-body h3 {
          font-size: 17px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .delete-modal-body p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .error-banner {
          background: var(--danger-light);
          color: var(--danger);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          margin-bottom: 16px;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
      `}</style>

      {/* Header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1>Students</h1>
          <p>Manage your students</p>
        </div>
        <button className="add-btn" onClick={openAddModal} id="add-student-btn">
          <Plus size={18} />
          Add Student
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="filters-row"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <div className="search-bar">
          <Search size={16} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Search students by name, email, or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="student-search"
          />
        </div>
        {uniqueClasses.length > 0 && (
          <select
            className="filter-select"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            id="class-filter"
          >
            <option value="">All Classes</option>
            {uniqueClasses.map((c) => (
              <option key={c} value={c!}>
                {c}
              </option>
            ))}
          </select>
        )}
      </motion.div>

      {/* Count */}
      {!isLoading && students.length > 0 && (
        <p className="student-count">
          Showing {students.length} of {total} student{total !== 1 ? "s" : ""}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="skeleton-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card">
              <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                <div className="skeleton-avatar" />
                <div style={{ flex: 1 }}>
                  <div
                    className="skeleton-line"
                    style={{ width: "60%", marginBottom: 8 }}
                  />
                  <div className="skeleton-line" style={{ width: "40%" }} />
                </div>
              </div>
              <div
                className="skeleton-line"
                style={{ width: "80%", marginBottom: 8 }}
              />
              <div className="skeleton-line" style={{ width: "50%" }} />
            </div>
          ))}
        </div>
      )}

      {/* Student Cards */}
      {!isLoading && students.length > 0 && (
        <div className="students-grid">
          {students.map((student, i) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                href={`/students/${student.id}`}
                className="student-card"
                id={`student-card-${student.id}`}
              >
                <div className="student-card-actions">
                  <button
                    className="card-action-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditModal(student);
                    }}
                    title="Edit student personal details"
                    id={`student-edit-${student.id}`}
                    type="button"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    className="card-action-btn danger"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(student);
                    }}
                    title="Delete student"
                    id={`student-delete-${student.id}`}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="student-card-top">
                  <div
                    className="student-avatar"
                    style={{
                      background: getAvatarGradient(student.name),
                    }}
                  >
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="student-card-info">
                    <h3>{student.name}</h3>
                    {student.class_grade && (
                      <span className="class-badge">
                        <GraduationCap size={11} />
                        {student.class_grade}
                        {student.board ? ` • ${student.board}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="student-card-meta">
                  {student.email && (
                    <div className="meta-row">
                      <Mail size={14} />
                      <span>{student.email}</span>
                    </div>
                  )}
                  {student.phone && (
                    <div className="meta-row">
                      <Phone size={14} />
                      <span>{student.phone}</span>
                    </div>
                  )}
                  {!student.email && !student.phone && (
                    <div className="meta-row">
                      <User size={14} />
                      <span>No contact info added</span>
                    </div>
                  )}
                  {student.date_of_birth && (
                    <div className="meta-row" style={{ color: "var(--brand-600)", fontWeight: 500 }}>
                      <Cake size={14} style={{ color: "#f59e0b" }} />
                      <span>
                        Birthday:{" "}
                        {new Date(student.date_of_birth + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <ChevronRight size={16} className="card-chevron" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && students.length === 0 && !search && !classFilter && (
        <motion.div
          className="empty-students"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="empty-students-icon">
            <Users size={32} />
          </div>
          <h3>No students added yet</h3>
          <p>
            Click the <strong>&quot;Add Student&quot;</strong> button above to add your
            first student. You can manage their calendar, homework, syllabus, and
            more from their profile.
          </p>
        </motion.div>
      )}

      {/* No results */}
      {!isLoading && students.length === 0 && (search || classFilter) && (
        <motion.div
          className="empty-students"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="empty-students-icon">
            <Search size={32} />
          </div>
          <h3>No students found</h3>
          <p>
            Try adjusting your search or filter criteria.
          </p>
        </motion.div>
      )}

      {/* ─── Add/Edit Modal ──────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <StudentFormModal
            student={editingStudent}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            error={
              (createMutation.error as Error)?.message ||
              (updateMutation.error as Error)?.message ||
              ""
            }
            onClose={() => {
              setShowModal(false);
              setEditingStudent(null);
              createMutation.reset();
              updateMutation.reset();
            }}
            onSubmit={(data) => {
              if (editingStudent) {
                updateMutation.mutate({ id: editingStudent.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Delete Confirm Modal ────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              className="modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 400 }}
            >
              <div className="delete-modal-body">
                <div className="delete-icon">
                  <AlertTriangle size={26} />
                </div>
                <h3>Delete &quot;{deleteTarget.name}&quot;?</h3>
                <p>
                  This will permanently remove this student and all their
                  associated data. This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  id="confirm-delete-btn"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Student"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Student Form Modal Component ─────────────────────────
function StudentFormModal({
  student,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  student: Student | null;
  isSubmitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (data: StudentCreate) => void;
}) {
  const [name, setName] = useState(student?.name || "");
  const [email, setEmail] = useState(student?.email || "");
  const [phone, setPhone] = useState(student?.phone || "");
  const [parentPhone, setParentPhone] = useState(student?.parent_phone || "");
  const [classGrade, setClassGrade] = useState(student?.class_grade || "");
  const [board, setBoard] = useState(student?.board || "");
  const [dateOfBirth, setDateOfBirth] = useState(student?.date_of_birth || "");
  const [notes, setNotes] = useState(student?.notes || "");

  useEffect(() => {
    setName(student?.name || "");
    setEmail(student?.email || "");
    setPhone(student?.phone || "");
    setParentPhone(student?.parent_phone || "");
    setClassGrade(student?.class_grade || "");
    setBoard(student?.board || "");
    setDateOfBirth(student?.date_of_birth || "");
    setNotes(student?.notes || "");
  }, [student]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      email: email || undefined,
      phone: phone || undefined,
      parent_phone: parentPhone || undefined,
      class_grade: classGrade || undefined,
      board: board || undefined,
      date_of_birth: dateOfBirth || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{student ? "Edit Student" : "Add New Student"}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="student-name">
                Full Name *
              </label>
              <input
                id="student-name"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="student-email">
                  Email
                </label>
                <input
                  id="student-email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@email.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="student-phone">
                  Phone
                </label>
                <input
                  id="student-phone"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="student-parent-phone">
                Parent&apos;s Phone
              </label>
              <input
                id="student-parent-phone"
                className="form-input"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="student-class">
                  Class / Grade
                </label>
                <input
                  id="student-class"
                  className="form-input"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  placeholder="e.g. 10th"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="student-board">
                  Board
                </label>
                <input
                  id="student-board"
                  className="form-input"
                  list="student-board-options"
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  placeholder="e.g. CBSE, ICSE, WBBSE"
                />
                <datalist id="student-board-options">
                  <option value="CBSE" />
                  <option value="ICSE" />
                  <option value="WBBSE" />
                  <option value="State Board" />
                  <option value="IB" />
                  <option value="IGCSE" />
                </datalist>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="student-dob">
                Date of Birth 🎂
              </label>
              <input
                id="student-dob"
                type="date"
                className="form-input"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="student-notes">
                Notes
              </label>
              <textarea
                id="student-notes"
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about the student..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !name.trim()}
              id="submit-student-btn"
            >
              {isSubmitting
                ? "Saving..."
                : student
                ? "Update Student"
                : "Add Student"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
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
