"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";

export default function AdminLayout({
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
      } else if (user?.role !== "admin") {
        if (user?.role === "teacher") {
          router.push("/dashboard");
        } else {
          router.push("/portal");
        }
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid var(--border-color)",
            borderTopColor: "#f59e0b",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Authenticating Admin Portal...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <div className="admin-layout-root">
      <style>{`
        .admin-layout-root {
          display: flex;
          min-height: 100vh;
          background: var(--bg-secondary);
          width: 100%;
          overflow-x: hidden;
        }

        .admin-main-content {
          flex: 1;
          min-width: 0;
          margin-left: var(--sidebar-width, 260px);
          padding: 32px;
          min-height: 100vh;
          background: var(--bg-secondary);
          width: calc(100% - var(--sidebar-width, 260px));
          max-width: calc(100% - var(--sidebar-width, 260px));
          box-sizing: border-box;
        }

        @media (max-width: 1023px) {
          .admin-main-content {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 72px 16px 28px 16px !important;
          }
        }

        @media (min-width: 640px) and (max-width: 1023px) {
          .admin-main-content {
            padding: 80px 24px 36px 24px !important;
          }
        }
      `}</style>

      <MobileHeader
        portalTitle="StudyVerse"
        portalRole="admin"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />

      <AdminSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className="admin-main-content">
        {children}
      </main>
    </div>
  );
}
