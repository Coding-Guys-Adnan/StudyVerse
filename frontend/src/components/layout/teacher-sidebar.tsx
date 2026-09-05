"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const teacherNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
];

interface TeacherSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function TeacherSidebar({
  collapsed: controlledCollapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: TeacherSidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isCollapsed ? "collapsed" : ""} ${
          mobileOpen ? "mobile-open" : ""
        }`}
      >
        <style>{`
          .mobile-sidebar-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(2px);
            z-index: 45;
          }

          .sidebar {
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
            transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
          }

          .sidebar.collapsed {
            width: var(--sidebar-collapsed, 72px);
          }

          @media (max-width: 1023px) {
            .mobile-sidebar-backdrop {
              display: block;
            }

            .sidebar {
              width: 280px !important;
              transform: translateX(-100%);
              box-shadow: var(--shadow-xl);
            }

            .sidebar.mobile-open {
              transform: translateX(0);
            }

            .collapse-btn {
              display: none !important;
            }
          }

          .sidebar-header {
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-bottom: 1px solid var(--border-color);
            min-height: var(--header-height);
            position: relative;
          }

          .sidebar-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .sidebar-logo {
            width: 36px;
            height: 36px;
            min-width: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
            flex-shrink: 0;
          }

          .sidebar-brand {
            overflow: hidden;
            white-space: nowrap;
            transition: opacity 0.2s ease;
          }

          .collapsed .sidebar-brand {
            opacity: 0;
            width: 0;
          }

          .sidebar-brand h2 {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.3px;
          }

          .sidebar-brand p {
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

          .sidebar-nav {
            flex: 1;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            overflow-y: auto;
          }

          .nav-section-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-tertiary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px 12px 6px;
          }

          .collapsed .nav-section-label {
            text-align: center;
            padding: 12px 4px 6px;
            font-size: 9px;
          }

          .nav-item {
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

          .collapsed .nav-item {
            justify-content: center;
            padding: 10px;
          }

          .nav-item:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .nav-item.active {
            background: var(--brand-50);
            color: var(--brand-600);
            font-weight: 600;
          }

          .nav-item.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 20px;
            background: var(--brand-500);
            border-radius: 0 4px 4px 0;
          }

          .nav-item-icon {
            min-width: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .nav-item-label {
            white-space: nowrap;
            overflow: hidden;
            transition: opacity 0.2s ease;
          }

          .collapsed .nav-item-label {
            opacity: 0;
            width: 0;
          }

          .sidebar-footer {
            padding: 16px 12px;
            border-top: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .sidebar-theme-wrapper {
            padding: 0 4px 6px;
          }

          .collapsed .sidebar-theme-wrapper {
            display: none;
          }

          .sidebar-user {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            border-radius: var(--radius-sm);
            background: var(--bg-tertiary);
          }

          .collapsed .sidebar-user {
            justify-content: center;
            padding: 8px;
            background: transparent;
          }

          .user-avatar {
            width: 32px;
            height: 32px;
            min-width: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 13px;
          }

          .user-info {
            overflow: hidden;
            transition: opacity 0.2s ease;
          }

          .collapsed .user-info {
            opacity: 0;
            width: 0;
          }

          .user-info p:first-child {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .user-info p:last-child {
            font-size: 11px;
            color: var(--text-tertiary);
          }

          .logout-btn {
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

          .collapsed .logout-btn {
            justify-content: center;
            border: none;
          }

          .logout-btn:hover {
            background: var(--danger-light);
            color: var(--danger);
            border-color: transparent;
          }

          .collapse-btn {
            position: absolute;
            right: 12px;
            top: 24px;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 50;
            transition: all 0.2s ease;
            color: var(--text-secondary);
          }

          .collapsed .collapse-btn {
            right: 50%;
            transform: translateX(50%);
            top: 14px;
          }

          .collapse-btn:hover {
            color: var(--brand-600);
            background: var(--brand-50);
            border-color: var(--brand-300);
          }
        `}</style>

        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <div className="sidebar-logo">
              <Sparkles size={20} color="white" />
            </div>
            <div className="sidebar-brand">
              <h2>StudyVerse</h2>
              <p>Teaching Assistant</p>
            </div>
          </div>
          
          {/* Desktop Collapse Toggle */}
          <button
            className="collapse-btn"
            onClick={handleToggle}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Mobile Close Button */}
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
        <nav className="sidebar-nav">
          <span className="nav-section-label">Menu</span>
          {teacherNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? "active" : ""}`}
                title={isCollapsed ? item.label : undefined}
                onClick={handleNavClick}
              >
                <span className="nav-item-icon">
                  <item.icon size={20} />
                </span>
                <span className="nav-item-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!isCollapsed && (
            <div className="sidebar-theme-wrapper">
              <ThemeToggle variant="pills" />
            </div>
          )}

          <div className="sidebar-user">
            <div className="user-avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || "T"}
            </div>
            <div className="user-info">
              <p>{user?.full_name || "Teacher"}</p>
              <p>{user?.email || ""}</p>
            </div>
          </div>

          <button className="logout-btn" onClick={logout} id="logout-btn" type="button">
            <LogOut size={18} />
            <span className="nav-item-label">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
