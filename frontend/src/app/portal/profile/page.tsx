"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, GraduationCap, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { portalApi } from "@/lib/portal-api";
import axios from "axios";

export default function StudentProfilePage() {
  const { data: student, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["portal-profile"],
    queryFn: () => portalApi.getProfile(),
    select: (res) => res.data,
    retry: 1,
  });

  const getErrorMessage = (): string => {
    if (!error) return "No student profile is linked to this account.";
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        return "Unable to connect to the server. Please check if the backend server is running and try again.";
      }
      if (error.response.status === 403) {
        return "You are not authorized to access this profile.";
      }
      const detail = error.response.data?.detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
    return "An unexpected error occurred while loading your profile.";
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>My Profile</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Manage and review your center enrollment details</p>
      </div>

      {isLoading || isRefetching ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading profile...
        </div>
      ) : student ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Header Card */}
          <div
            style={{
              background: "var(--card-bg)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-color)",
              padding: 30,
              display: "flex",
              alignItems: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {student.name}
              </h2>
              {student.class_grade && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 100,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "var(--brand-50)",
                    color: "var(--brand-600)",
                  }}
                >
                  <GraduationCap size={12} />
                  {student.class_grade}
                  {student.board ? ` • ${student.board}` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Contact Details Card */}
          <div
            style={{
              background: "var(--card-bg)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border-color)",
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Contact Information
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
              {student.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                  <Mail size={16} color="var(--text-tertiary)" />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>Email Address</div>
                    <strong style={{ color: "var(--text-primary)" }}>{student.email}</strong>
                  </div>
                </div>
              )}
              {student.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                  <Phone size={16} color="var(--text-tertiary)" />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>Student Phone</div>
                    <strong style={{ color: "var(--text-primary)" }}>{student.phone}</strong>
                  </div>
                </div>
              )}
              {student.parent_phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                  <Phone size={16} color="var(--text-tertiary)" />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>Parent Contact</div>
                    <strong style={{ color: "var(--text-primary)" }}>{student.parent_phone}</strong>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                <Calendar size={16} color="var(--text-tertiary)" />
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>Enrolled Since</div>
                  <strong style={{ color: "var(--text-primary)" }}>{new Date(student.created_at).toLocaleDateString()}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Card */}
          {student.notes && (
            <div
              style={{
                background: "var(--card-bg)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border-color)",
                padding: 24,
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
                Special Guidelines / Tutor Notes
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {student.notes}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-color)",
            padding: 32,
            textAlign: "center",
            maxWidth: 540,
            margin: "40px auto 0",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--danger-light)",
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <AlertCircle size={24} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Unable to Load Profile
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
            {getErrorMessage()}
          </p>
          <button
            onClick={() => refetch()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 8,
              background: "var(--brand-600)",
              color: "white",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
            type="button"
          >
            <RefreshCw size={16} />
            Retry Loading Profile
          </button>
        </div>
      )}
    </div>
  );
}
