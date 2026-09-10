"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Database,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
}: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isSuperAdmin = user?.email?.toLowerCase() === "admin@studyverse.com";

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    ...(isSuperAdmin
      ? [{ label: "Administrators", href: "/admin/administrators", icon: ShieldCheck }]
      : []),
    { label: "Teachers", href: "/admin/teachers", icon: Users },
    { label: "Students", href: "/admin/students", icon: GraduationCap },
    { label: "Backup & Data", href: "/admin/backup", icon: Database },
  ];

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

      <aside className={`admin-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <style>{`
          .mobile-sidebar-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(2px);
            z-index: 45;
          }

          .admin-sidebar {
            width: var(--sidebar-width, 260px);
            height: 100vh;
            background: var(--card-bg);
            border-right: 1px solid var(--border-color);
            color: var(--text-primary);
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

            .admin-sidebar {
              width: 280px !important;
              transform: translateX(-100%);
              box-shadow: var(--shadow-xl);
            }

            .admin-sidebar.mobile-open {
              transform: translateX(0);
            }
          }

          .admin-sidebar-header {
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-bottom: 1px solid var(--border-color);
            min-height: var(--header-height, 64px);
          }

          .admin-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .admin-logo {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
            flex-shrink: 0;
          }

          .admin-brand h2 {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.3px;
          }

          .admin-brand p {
            font-size: 11px;
            color: #f59e0b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
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

          .admin-nav {
            flex: 1;
            padding: 16px 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .admin-nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 8px;
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.15s ease;
            min-height: 44px;
          }

          .admin-nav-item:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .admin-nav-item.active {
            background: #f59e0b;
            color: white;
            font-weight: 600;
          }

          .admin-footer {
            padding: 16px 12px;
            border-top: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .admin-user-info {
            padding: 8px 10px;
            border-radius: var(--radius-sm);
            background: var(--bg-tertiary);
          }

          .admin-user-info p:first-child {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .admin-user-info p:last-child {
            font-size: 11px;
            color: var(--text-tertiary);
          }

          .admin-logout {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 8px;
            color: #ef4444;
            background: none;
            border: 1px solid var(--border-color);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            transition: all 0.15s ease;
            min-height: 42px;
          }

          .admin-logout:hover {
            background: rgba(239, 68, 68, 0.1);
            border-color: transparent;
          }
        `}</style>

        <div className="admin-sidebar-header">
          <div className="admin-header-left">
            <div className="admin-logo">
              <ShieldCheck size={20} color="white" />
            </div>
            <div className="admin-brand">
              <h2>StudyVerse</h2>
              <p>{isSuperAdmin ? "Super Admin" : "Admin Portal"}</p>
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

        <nav className="admin-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item ${isActive ? "active" : ""}`}
                onClick={handleNavClick}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-footer">
          <div className="sidebar-theme-wrapper">
            <ThemeToggle variant="pills" />
          </div>

          <div className="admin-user-info">
            <p>{user?.full_name || "Administrator"}</p>
            <p>{user?.email || ""}</p>
          </div>
          <button className="admin-logout" onClick={logout} type="button">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
