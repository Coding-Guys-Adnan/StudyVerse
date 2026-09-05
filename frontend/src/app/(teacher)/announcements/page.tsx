"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Megaphone, Plus, Trash2, Calendar } from "lucide-react";
import { academicApi } from "@/lib/academic-api";

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  // ─── Query ──────────────────────────────────────────────
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => academicApi.getAnnouncements(),
    select: (res) => res.data,
  });

  // ─── Mutations ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => academicApi.createAnnouncement({ title, message: message || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setTitle("");
      setMessage("");
      setShowAddForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicApi.deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }} className="announcements-page">
      <style>{`
        .announcements-page {
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

        .header-row h1 {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .header-row p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .ann-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          padding: 20px;
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
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .ann-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .ann-message {
          font-size: 13px;
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

        .card-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          color: var(--text-secondary);
        }

        .card-action-btn.danger:hover {
          background: var(--danger-light);
          color: var(--danger);
          border-color: transparent;
        }

        .compose-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          padding: 24px;
          margin-bottom: 24px;
        }

        @media (max-width: 480px) {
          .compose-card {
            padding: 16px;
          }
        }

        .compose-header {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="header-row"
      >
        <div>
          <h1>Announcements</h1>
          <p>Broadcast messages and study guidelines to all student portals</p>
        </div>
        {!showAddForm && (
          <button className="add-btn" onClick={() => setShowAddForm(true)} id="compose-ann-btn">
            <Plus size={16} />
            Compose Message
          </button>
        )}
      </motion.div>

      {/* ─── Compose Form ─── */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="compose-card"
        >
          <div className="compose-header">
            <Megaphone size={18} style={{ color: "var(--brand-500)" }} />
            <h3>Broadcast New Announcement</h3>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="ann-title">Subject / Title *</label>
              <input
                id="ann-title"
                className="form-input"
                placeholder="e.g. Schedule Change for National Holiday or Exam Preparation Guidelines"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ann-message">Announcement Message *</label>
              <textarea
                id="ann-message"
                className="notes-textarea"
                style={{ minHeight: 120 }}
                placeholder="Write your details, worksheets, or custom rules here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={createMutation.isPending || !title || !message}
                id="send-announcement-btn"
              >
                {createMutation.isPending ? "Broadcasting..." : "Broadcast"}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ─── Announcements List ─── */}
      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading announcements...
        </div>
      ) : announcements.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {announcements.map((ann) => (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ann-card"
              id={`ann-card-${ann.id}`}
            >
              <div className="ann-header">
                <h3 className="ann-title">{ann.title}</h3>
                <button
                  className="card-action-btn danger"
                  onClick={() => deleteMutation.mutate(ann.id)}
                  title="Delete Announcement"
                  id={`ann-delete-${ann.id}`}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="ann-message">{ann.message}</p>
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
      ) : (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius)",
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
              color: "var(--text-tertiary)",
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
            Broadcast reminders, center updates, worksheets, or holiday announcements directly to all students.
          </p>
        </div>
      )}
    </div>
  );
}
