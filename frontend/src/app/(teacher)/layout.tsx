"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TeacherSidebar } from "@/components/layout/teacher-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (user?.role !== "teacher") {
        router.push("/portal");
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--bg-secondary)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid var(--border-color)",
            borderTopColor: "var(--brand-500)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "teacher") {
    return null;
  }

  return (
    <div className="teacher-layout-root">
      <style>{`
        .teacher-layout-root {
          display: flex;
          min-height: 100vh;
          background: var(--bg-secondary);
          width: 100%;
          overflow-x: hidden;
        }

        .teacher-main-content {
          flex: 1;
          min-width: 0;
          margin-left: ${sidebarCollapsed ? "var(--sidebar-collapsed, 72px)" : "var(--sidebar-width, 260px)"};
          padding: 32px;
          background: var(--bg-secondary);
          min-height: 100vh;
          transition: margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          width: calc(100% - ${sidebarCollapsed ? "var(--sidebar-collapsed, 72px)" : "var(--sidebar-width, 260px)"});
          max-width: calc(100% - ${sidebarCollapsed ? "var(--sidebar-collapsed, 72px)" : "var(--sidebar-width, 260px)"});
          box-sizing: border-box;
        }

        @media (max-width: 1023px) {
          .teacher-main-content {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 76px 16px 32px 16px !important;
          }
        }
      `}</style>

      <MobileHeader
        portalTitle="StudyVerse"
        portalRole="teacher"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />

      <TeacherSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className="teacher-main-content">
        {children}
      </main>
    </div>
  );
}
