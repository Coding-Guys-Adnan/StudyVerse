"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Megaphone, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { portalApi, type Announcement } from "@/lib/portal-api";

export default function StudentAnnouncementsPage() {
  const {
    data: announcements = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["student-announcements"],
    queryFn: () => portalApi.getAnnouncements(),
    select: (res) => res.data,
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "3px solid var(--border-color)",
              borderTopColor: "#10b981",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ fontSize: 14 }}>Loading announcements...</p>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="error-card">
          <AlertCircle size={28} />
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              Failed to load announcements
            </h3>
            <p style={{ fontSize: 13, color: "var(--danger)" }}>
              {(error as Error)?.message || "An unexpected error occurred while fetching updates."}
            </p>
          </div>
          <button
            className="refresh-btn"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}
            onClick={() => refetch()}
          >
            Try Again
          </button>
        </div>
      );
    }

    if (announcements.length > 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {announcements.map((ann: Announcement) => (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="ann-card"
              id={`student-ann-card-${ann.id}`}
            >
              <div className="ann-header">
                <div className="ann-icon-wrapper">
                  <Megaphone size={16} />
                </div>
                <h3 className="ann-title">{ann.title}</h3>
              </div>

              {ann.message && <p className="ann-message">{ann.message}</p>}

              <div className="ann-meta">
                <span className="ann-channel">App Portal</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={12} />
                  {new Date(ann.created_at).toLocaleDateString("default", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    return (
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius, 12px)",
          padding: "64px 32px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "var(--bg-tertiary)",
            color: "var(--brand-600)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Megaphone size={24} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
          No announcements yet
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto" }}>
          When your teacher sends updates, class guidelines, or homework reminders, they will appear here.
        </p>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }} className="student-announcements-page">
      <style>{`
        .student-announcements-page {
          padding-bottom: 40px;
        }

        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-title-section h1 {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .header-title-section p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-sm, 8px);
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 38px;
        }

        .refresh-btn:hover {
          background: var(--bg-tertiary);
        }

        .ann-card {
          background: var(--card-bg);
          border-radius: var(--radius, 12px);
          border: 1px solid var(--border-color);
          padding: 20px 24px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.15s ease;
          position: relative;
        }

        .ann-card:hover {
          box-shadow: var(--shadow-sm);
          border-color: var(--brand-300);
        }

        .ann-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ann-icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--brand-50);
          color: var(--brand-600);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ann-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
        }

        .ann-message {
          font-size: 14px;
          color: var(--text-secondary);
          white-space: pre-wrap;
          line-height: 1.6;
        }

        .ann-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 11px;
          color: var(--text-tertiary);
          padding-top: 4px;
        }

        .ann-channel {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--brand-50);
          color: var(--brand-600);
          padding: 2px 8px;
          border-radius: 100px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .error-card {
          background: var(--danger-light);
          border: 1px solid var(--border-color);
          border-radius: var(--radius, 12px);
          padding: 24px;
          color: var(--danger);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="header-row"
      >
        <div className="header-title-section">
          <h1>Teacher Announcements</h1>
          <p>Broadcast updates, guidelines, and notifications from your tutor</p>
        </div>
        <button
          className="refresh-btn"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh Announcements"
          type="button"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </motion.div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}
