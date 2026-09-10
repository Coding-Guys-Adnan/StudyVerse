"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StudentSidebar } from "@/components/layout/student-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (user?.role !== "student") {
        router.push("/dashboard");
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
            borderTopColor: "#10b981",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "student") {
    return null;
  }

  return (
    <div className="student-layout-root">
      <style>{`
        .student-layout-root {
          display: flex;
          min-height: 100vh;
          background: var(--bg-secondary);
          width: 100%;
          overflow-x: hidden;
        }

        .student-main-content {
          flex: 1;
          min-width: 0;
          margin-left: var(--sidebar-width, 260px);
          padding: 32px;
          background: var(--bg-secondary);
          min-height: 100vh;
          width: calc(100% - var(--sidebar-width, 260px));
          max-width: calc(100% - var(--sidebar-width, 260px));
          box-sizing: border-box;
        }

        @media (max-width: 1023px) {
          .student-main-content {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 76px 16px 32px 16px !important;
          }
        }
      `}</style>

      <MobileHeader
        portalTitle="StudyVerse"
        portalRole="student"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />

      <StudentSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className="student-main-content">
        {children}
      </main>
    </div>
  );
}
