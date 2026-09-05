"use client";

import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, BookOpen, CalendarDays, Sparkles, ArrowRight } from "lucide-react";
import { studentsApi } from "@/lib/students-api";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: statsData } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => studentsApi.dashboardStats(),
    select: (res) => res.data,
  });

  const { data: recentData } = useQuery({
    queryKey: ["students", "", ""],
    queryFn: () => studentsApi.list(),
    select: (res) => res.data,
  });

  const recentStudents = (recentData?.students || []).slice(0, 5);

  const stats = [
    {
      label: "Total Students",
      value: statsData?.total_students?.toString() || "0",
      icon: Users,
      color: "#6366f1",
      bg: "rgba(99, 102, 241, 0.15)",
      desc:
        statsData && statsData.total_students > 0
          ? `${statsData.total_students} enrolled`
          : "Add students to get started",
    },
    {
      label: "Today's Classes",
      value: statsData?.today_classes?.toString() || "0",
      icon: CalendarDays,
      color: "#0ea5e9",
      bg: "rgba(14, 165, 233, 0.15)",
      desc:
        statsData && statsData.today_classes > 0
          ? `${statsData.today_classes} scheduled`
          : "No classes scheduled",
    },
    {
      label: "Homework Pending",
      value: statsData?.homework_pending?.toString() || "0",
      icon: BookOpen,
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.15)",
      desc:
        statsData && statsData.homework_pending > 0
          ? `${statsData.homework_pending} pending`
          : "All clear",
    },
    {
      label: "AI Plans Generated",
      value: statsData?.ai_plans_generated?.toString() || "0",
      icon: Sparkles,
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.15)",
      desc:
        statsData && statsData.ai_plans_generated > 0
          ? `${statsData.ai_plans_generated} generated`
          : "Start using AI assistant",
    },
  ];

  return (
    <div className="dashboard">
      <style>{`
        .dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-greeting {
          margin-bottom: 32px;
        }

        .dashboard-greeting h1 {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }

        .dashboard-greeting p {
          font-size: 15px;
          color: var(--text-secondary);
        }

        @media (max-width: 640px) {
          .dashboard-greeting h1 {
            font-size: 22px;
          }
          .dashboard-greeting p {
            font-size: 13px;
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        .stat-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          padding: 24px;
          border: 1px solid var(--border-color);
          transition: all 0.2s ease;
          cursor: default;
        }

        .stat-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .stat-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .stat-desc {
          font-size: 12px;
          color: var(--text-tertiary);
          margin-top: 8px;
        }

        /* ─── Recent Students ─────────────────────── */
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .section-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .view-all-link {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 500;
          color: var(--brand-600);
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .view-all-link:hover {
          color: var(--brand-700);
        }

        .recent-list {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          overflow: hidden;
        }

        .recent-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-color);
          text-decoration: none;
          color: inherit;
          transition: all 0.15s ease;
          min-height: 52px;
        }

        .recent-item:last-child {
          border-bottom: none;
        }

        .recent-item:hover {
          background: var(--bg-tertiary);
        }

        .recent-avatar {
          width: 38px;
          height: 38px;
          min-width: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 15px;
          color: white;
        }

        .recent-info {
          flex: 1;
        }

        .recent-info h4 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .recent-info p {
          font-size: 12px;
          color: var(--text-tertiary);
        }

        .recent-arrow {
          color: var(--text-tertiary);
          transition: all 0.15s ease;
        }

        .recent-item:hover .recent-arrow {
          color: var(--brand-400);
          transform: translateX(2px);
        }

        .empty-section {
          background: var(--card-bg);
          border-radius: var(--radius);
          padding: 48px 32px;
          border: 1px solid var(--border-color);
          text-align: center;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: var(--bg-tertiary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          color: var(--text-tertiary);
        }

        .empty-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .empty-section p {
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 400px;
          margin: 0 auto;
          line-height: 1.5;
        }
      `}</style>

      {/* Greeting */}
      <motion.div
        className="dashboard-greeting"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1>
          Good{" "}
          {new Date().getHours() < 12
            ? "morning"
            : new Date().getHours() < 17
            ? "afternoon"
            : "evening"}
          , {user?.full_name?.split(" ")[0] || "Teacher"} 👋
        </h1>
        <p>Here&apos;s an overview of your tuition center</p>
      </motion.div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <div className="stat-card-header">
              <div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
              <div
                className="stat-icon"
                style={{ background: stat.bg, color: stat.color }}
              >
                <stat.icon size={22} />
              </div>
            </div>
            <div className="stat-desc">{stat.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Recent Students */}
      {recentStudents.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <div className="section-header">
            <h2>Recent Students</h2>
            <Link href="/students" className="view-all-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="recent-list">
            {recentStudents.map((student) => (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="recent-item"
              >
                <div
                  className="recent-avatar"
                  style={{ background: getAvatarGradient(student.name) }}
                >
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div className="recent-info">
                  <h4>{student.name}</h4>
                  <p>
                    {[student.class_grade, student.board]
                      .filter(Boolean)
                      .join(" • ") || "No details"}
                  </p>
                </div>
                <ArrowRight size={16} className="recent-arrow" />
              </Link>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="empty-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <div className="empty-icon">
            <Users size={28} />
          </div>
          <h3>No students yet</h3>
          <p>
            Head over to the <strong>Students</strong> section to add your first
            student. Once added, you&apos;ll see activity and stats here.
          </p>
        </motion.div>
      )}
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
