"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  BookOpen,
  FileText,
  Sparkles,
  BarChart3,
  FolderOpen,
  User,
  LogOut,
  GraduationCap,
  Megaphone,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const studentNav = [
  { label: "Calendar", href: "/portal", icon: Calendar },
  { label: "Announcements", href: "/portal/announcements", icon: Megaphone },
  { label: "Homework", href: "/portal/homework", icon: BookOpen },
  { label: "Syllabus", href: "/portal/syllabus", icon: FileText },
  { label: "AI Recommendations", href: "/portal/ai", icon: Sparkles },
  { label: "Test Marks", href: "/portal/tests", icon: BarChart3 },
  { label: "Files", href: "/portal/files", icon: FolderOpen },
  { label: "My Profile", href: "/portal/profile", icon: User },
];

interface StudentSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function StudentSidebar({
  mobileOpen = false,
  onMobileClose,
}: StudentSidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside className={`student-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <style>{`
          .mobile-sidebar-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(2px);
            z-index: 45;
          }

          .student-sidebar {
            width: var(--sidebar-width);
            height: 100vh;
            background: var(--card-bg);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 50;
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }

          @media (max-width: 1023px) {
            .mobile-sidebar-backdrop {
              display: block;
            }

            .student-sidebar {
              width: 280px !important;
              transform: translateX(-100%);
              box-shadow: var(--shadow-xl);
            }

            .student-sidebar.mobile-open {
              transform: translateX(0);
            }
          }

          .student-sidebar-header {
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-bottom: 1px solid var(--border-color);
            min-height: var(--header-height);
          }

          .student-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .student-logo {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, #10b981, #059669);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
            flex-shrink: 0;
          }

          .student-brand h2 {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.3px;
          }

          .student-brand p {
            font-size: 11px;
            color: var(--text-tertiary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
          }

          .mobile-close-btn {
            display: none;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
          }

          @media (max-width: 1023px) {
            .mobile-close-btn {
              display: flex;
              align-items: center;
              justify-content: center;
            }
          }

          .student-nav {
            flex: 1;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            overflow-y: auto;
          }

          .student-nav-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-tertiary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px 12px 6px;
          }

          .student-nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            border-radius: var(--radius-sm);
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.15s ease;
            position: relative;
            min-height: 44px;
          }

          .student-nav-item:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .student-nav-item.active {
            background: rgba(16, 185, 129, 0.12);
            color: #10b981;
            font-weight: 600;
          }

          .student-nav-item.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 20px;
            background: #10b981;
            border-radius: 0 4px 4px 0;
          }

          .student-footer {
            padding: 16px 12px;
            border-top: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .student-user {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            border-radius: var(--radius-sm);
            background: var(--bg-tertiary);
          }

          .student-avatar {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 13px;
          }

          .student-user-info p:first-child {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .student-user-info p:last-child {
            font-size: 11px;
            color: var(--text-tertiary);
          }

          .student-logout {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: var(--radius-sm);
            color: var(--text-secondary);
            background: none;
            border: 1px solid var(--border-color);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            transition: all 0.15s ease;
            font-family: inherit;
            min-height: 42px;
          }

          .student-logout:hover {
            background: var(--danger-light);
            color: var(--danger);
            border-color: transparent;
          }

          .readonly-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 100px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: var(--bg-tertiary);
            color: var(--text-tertiary);
            margin: 0 12px 8px;
          }
        `}</style>

        {/* Header */}
        <div className="student-sidebar-header">
          <div className="student-header-left">
            <div className="student-logo">
              <GraduationCap size={20} color="white" />
            </div>
            <div className="student-brand">
              <h2>StudyVerse</h2>
              <p>Student Portal</p>
            </div>
          </div>
          <button
            className="mobile-close-btn"
            onClick={onMobileClose}
            aria-label="Close sidebar"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="student-nav">
          <span className="student-nav-label">Your Space</span>
          <div className="readonly-badge">👁 View Only</div>
          {studentNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/portal" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`student-nav-item ${isActive ? "active" : ""}`}
                onClick={handleNavClick}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="student-footer">
          <div className="sidebar-theme-wrapper">
            <ThemeToggle variant="pills" />
          </div>

          <div className="student-user">
            <div className="student-avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || "S"}
            </div>
            <div className="student-user-info">
              <p>{user?.full_name || "Student"}</p>
              <p>{user?.email || ""}</p>
            </div>
          </div>
          <button className="student-logout" onClick={logout} type="button">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
