"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { adminApi } from "@/lib/api";
import { Users, UserCheck, ArrowRight, UserPlus, GraduationCap, Database } from "lucide-react";

export default function AdminDashboardPage() {
  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: () => adminApi.getTeachers(),
    select: (res) => res.data,
  });

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => adminApi.getStudents(),
    select: (res) => res.data,
  });

  const totalTeachers = teachers.length;
  const activeTeachers = teachers.filter((t) => t.is_active).length;
  const totalStudents = students.length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }} className="admin-dashboard-page">
      <style>{`
        .admin-dashboard-page {
          padding-bottom: 40px;
        }

        .admin-header h1 {
          font-size: clamp(20px, 4vw, 26px);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .admin-header p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 24px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: var(--card-bg);
          border-radius: var(--radius, 12px);
          border: 1px solid var(--border-color);
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }

        .stat-icon-wrapper {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon-wrapper.teachers { background: var(--info-light); color: var(--info); }
        .stat-icon-wrapper.active { background: var(--success-light); color: var(--success); }
        .stat-icon-wrapper.students { background: var(--warning-light); color: var(--warning); }
        .stat-icon-wrapper.backup { background: rgba(16, 185, 129, 0.12); color: #10b981; }

        .stat-number {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .quick-actions-card {
          background: var(--card-bg);
          border-radius: var(--radius, 12px);
          border: 1px solid var(--border-color);
          padding: 22px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 240px;
        }

        .quick-actions-header {
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .quick-actions-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .action-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #f59e0b;
          color: white;
          border-radius: 8px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s ease;
          width: fit-content;
          min-height: 40px;
        }

        .action-link-btn:hover {
          background: #d97706;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
        }

        .action-link-btn.students-btn {
          background: #2563eb;
        }

        .action-link-btn.students-btn:hover {
          background: #1d4ed8;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        }

        .action-link-btn.backup-btn {
          background: #059669;
        }

        .action-link-btn.backup-btn:hover {
          background: #047857;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
        }

        @media (max-width: 640px) {
          .quick-actions-card {
            padding: 18px;
          }
          .action-link-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-header"
      >
        <h1>Admin Control Panel</h1>
        <p>Manage teachers, student accounts, credentials, and teacher assignments</p>
      </motion.div>

      {/* Stats */}
      <div className="stats-grid">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="stat-card">
          <div className="stat-icon-wrapper teachers">
            <Users size={24} />
          </div>
          <div>
            <div className="stat-number">{isLoadingTeachers ? "..." : totalTeachers}</div>
            <div className="stat-label">Total Teachers</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card">
          <div className="stat-icon-wrapper active">
            <UserCheck size={24} />
          </div>
          <div>
            <div className="stat-number">{isLoadingTeachers ? "..." : activeTeachers}</div>
            <div className="stat-label">Active Teachers</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="stat-card">
          <div className="stat-icon-wrapper students">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="stat-number">{isLoadingStudents ? "..." : totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions Cards Grid */}
      <div className="cards-grid">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="quick-actions-card">
          <div>
            <div className="quick-actions-header">
              <h3>Teacher Management</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                Provision new tutor accounts, edit details, and reset passwords.
              </p>
            </div>
            <div style={{ padding: "8px 0 20px 0", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
              <p>• Edit teacher names and emails.</p>
              <p>• Securely reset teacher passwords.</p>
              <p>• Activate or deactivate teacher access.</p>
            </div>
          </div>
          <Link href="/admin/teachers" className="action-link-btn">
            <UserPlus size={16} />
            <span>Manage Teachers</span>
            <ArrowRight size={14} />
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="quick-actions-card">
          <div>
            <div className="quick-actions-header">
              <h3>Student Management</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                View student roster, assign multiple teachers, and reset student passwords.
              </p>
            </div>
            <div style={{ padding: "8px 0 20px 0", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
              <p>• Edit student contact & academic info.</p>
              <p>• Assign or unassign multiple teachers.</p>
              <p>• Reset passwords or enable student login.</p>
            </div>
          </div>
          <Link href="/admin/students" className="action-link-btn students-btn">
            <GraduationCap size={16} />
            <span>Manage Students</span>
            <ArrowRight size={14} />
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="quick-actions-card">
          <div>
            <div className="quick-actions-header">
              <h3>Backup & Data Protection</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                Export full archives, download database dumps, and inspect data health.
              </p>
            </div>
            <div style={{ padding: "8px 0 20px 0", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
              <p>• One-click Full System ZIP backup.</p>
              <p>• Selective database and media archive exports.</p>
              <p>• Safety preflight checks and environment safeguards.</p>
            </div>
          </div>
          <Link href="/admin/backup" className="action-link-btn backup-btn">
            <Database size={16} />
            <span>Backup & Data</span>
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
