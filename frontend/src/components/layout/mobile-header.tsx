"use client";

import { Sparkles, Menu, GraduationCap, ShieldCheck, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";

interface MobileHeaderProps {
  onMenuToggle: () => void;
  portalTitle?: string;
  portalRole?: "teacher" | "student" | "admin";
}

export function MobileHeader({
  onMenuToggle,
  portalTitle = "StudyVerse",
  portalRole = "teacher",
}: MobileHeaderProps) {
  const { user } = useAuth();

  const getRoleIcon = () => {
    if (portalRole === "admin") return <ShieldCheck size={18} color="white" />;
    if (portalRole === "student") return <GraduationCap size={18} color="white" />;
    return <Sparkles size={18} color="white" />;
  };

  const getBadgeStyle = () => {
    if (portalRole === "admin") return { bg: "linear-gradient(135deg, #f59e0b, #d97706)", label: "Admin" };
    if (portalRole === "student") return { bg: "linear-gradient(135deg, #10b981, #059669)", label: "Student" };
    return { bg: "linear-gradient(135deg, var(--brand-500), var(--brand-600))", label: "Teacher" };
  };

  const badge = getBadgeStyle();

  return (
    <header className="mobile-header">
      <style>{`
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: var(--card-bg);
          border-bottom: 1px solid var(--border-color);
          z-index: 35;
          padding: 0 16px;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-xs);
        }

        @media (max-width: 1023px) {
          .mobile-header {
            display: flex;
          }
        }

        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mobile-logo {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mobile-title h1 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
          letter-spacing: -0.3px;
        }

        .mobile-title p {
          font-size: 10px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .mobile-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hamburger-btn {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .hamburger-btn:hover {
          background: var(--border-color);
        }
      `}</style>

      <div className="mobile-brand">
        <div className="mobile-logo" style={{ background: badge.bg }}>
          {getRoleIcon()}
        </div>
        <div className="mobile-title">
          <h1>{portalTitle}</h1>
          <p>{badge.label} Portal</p>
        </div>
      </div>

      <div className="mobile-actions">
        <ThemeToggle variant="icon-only" />
        <button
          className="hamburger-btn"
          onClick={onMenuToggle}
          aria-label="Open mobile menu"
          type="button"
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}
