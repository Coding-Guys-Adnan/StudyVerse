"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle,
  X,
  CreditCard,
  User,
  Megaphone,
  ArrowRight,
  Calendar as CalendarIcon,
  Maximize2,
  Eye,
  FileText,
  Sparkles,
  Plus,
  Trash2,
} from "lucide-react";
import { portalApi, type CalendarDayData } from "@/lib/portal-api";
import { formatLocalDateToISO, formatDisplayDate } from "@/lib/date-utils";
import { PlanTextModal } from "@/components/calendar/plan-text-modal";

export default function StudentCalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Center Popup Modal State for Full Text View (matches teacher portion)
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    field: "topics" | "actuallyTaught" | "notes" | "all";
    value: string;
  }>({
    isOpen: false,
    title: "",
    field: "topics",
    value: "",
  });

  const openModal = (
    title: string,
    field: "topics" | "actuallyTaught" | "notes" | "all",
    currentVal: string
  ) => {
    setModalState({
      isOpen: true,
      title,
      field,
      value: currentVal,
    });
  };

  const queryClient = useQueryClient();

  // Event modal state
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventType, setNewEventType] = useState("reminder");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // ─── Query Permissions ──────────────────────────────────
  const { data: permData } = useQuery({
    queryKey: ["portal-permissions"],
    queryFn: () => portalApi.getPermissions(),
    select: (res) => res.data,
  });

  const canEditCalendar = !!permData?.effective_permissions?.calendar?.can_edit;

  // ─── Query Announcements Widget ──────────────────────────
  const { data: announcements = [] } = useQuery({
    queryKey: ["portal-announcements-widget"],
    queryFn: () => portalApi.getAnnouncements(),
    select: (res) => res.data,
  });
  const recentAnnouncements = announcements.slice(0, 2);

  // ─── Query Month Data ──────────────────────────────────
  const { data: monthData, isLoading } = useQuery({
    queryKey: ["portal-calendar", year, month],
    queryFn: () => portalApi.getCalendarMonth(year, month),
    select: (res) => res.data,
  });

  const createEventMutation = useMutation({
    mutationFn: (data: { event_date: string; title: string; description?: string; event_type?: string }) =>
      portalApi.createCalendarEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-calendar", year, month] });
      setShowAddEventModal(false);
      setNewEventTitle("");
      setNewEventDesc("");
    },
    onError: (err) => {
      console.error("Failed to create event", err);
      alert("Failed to create event. Please try again.");
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => portalApi.deleteCalendarEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-calendar", year, month] });
    },
  });

  // ─── Grid Calculations ──────────────────────────────────
  const gridDays = useMemo(() => {
    const totalDays = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const daysList = [];

    const prevMonthYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevMonthTotalDays = new Date(prevMonthYear, prevMonth, 0).getDate();

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(prevMonthYear, prevMonth - 1, prevMonthTotalDays - i);
      daysList.push({ date: d, isCurrentMonth: false, isoStr: formatLocalDateToISO(d) });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month - 1, i);
      daysList.push({ date: d, isCurrentMonth: true, isoStr: formatLocalDateToISO(d) });
    }

    // Next month padding
    const remainingCells = 42 - daysList.length;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(nextMonthYear, nextMonth - 1, i);
      daysList.push({ date: d, isCurrentMonth: false, isoStr: formatLocalDateToISO(d) });
    }

    return daysList;
  }, [year, month]);

  const selectedDayData = useMemo(() => {
    if (!selectedDateStr || !monthData?.days) return null;
    return monthData.days[selectedDateStr] || null;
  }, [selectedDateStr, monthData]);

  // ─── Handlers ───────────────────────────────────────────
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(formatLocalDateToISO(today));
  };

  return (
    <div style={{ maxWidth: 1200 }} className="portal-calendar">
      <style>{`
        .portal-calendar {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ─── Split Layout (matches teacher) ─── */
        .portal-split-layout {
          display: flex;
          min-height: 550px;
          gap: 24px;
          align-items: stretch;
        }

        @media (max-width: 900px) {
          .portal-split-layout {
            flex-direction: column;
            min-height: auto;
          }
          .portal-side-panel {
            width: 100% !important;
          }
        }

        .portal-calendar-main {
          flex: 1;
          height: 100%;
          overflow-y: auto;
        }

        .portal-calendar-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        /* ─── Header ─── */
        .portal-calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .portal-month-year h2 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .portal-calendar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .portal-nav-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1.5px solid var(--border-color);
          background: var(--card-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }

        .portal-nav-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .portal-today-btn {
          padding: 0 12px;
          height: 34px;
          font-size: 13px;
          font-weight: 600;
          color: var(--brand-600);
          background: var(--brand-50);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .portal-today-btn:hover {
          background: var(--brand-100);
        }

        /* ─── Grid ─── */
        .portal-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: var(--border-color);
          gap: 1px;
          flex: 1;
        }

        .portal-weekday-header {
          background: var(--bg-tertiary);
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 0;
        }

        .portal-day-cell {
          background: var(--card-bg);
          min-height: 84px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
          position: relative;
          transition: all 0.15s ease;
        }

        @media (max-width: 640px) {
          .portal-day-cell {
            min-height: 60px;
            padding: 4px;
          }
        }

        .portal-day-cell:hover {
          background: var(--bg-tertiary);
        }

        .portal-day-cell.outside {
          background: var(--bg-secondary);
          color: var(--text-tertiary);
        }

        .portal-day-cell.selected {
          background: var(--brand-50);
          outline: 2px solid var(--brand-500);
          outline-offset: -2px;
          z-index: 10;
        }

        .portal-day-number-wrapper {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .portal-day-number {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .portal-day-cell.outside .portal-day-number {
          color: var(--text-tertiary);
        }

        .portal-day-cell.is-today .portal-day-number {
          background: var(--brand-500);
          color: white !important;
        }

        /* ─── Indicators (matching teacher) ─── */
        .portal-cell-indicators {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
        }

        .portal-indicator-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .portal-indicator-dot.attendance-present { background: var(--success); }
        .portal-indicator-dot.attendance-absent { background: var(--danger); }
        .portal-indicator-dot.attendance-leave { background: var(--warning); }

        .portal-indicator-pill {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 100px;
          display: flex;
          align-items: center;
          gap: 2px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .portal-indicator-pill.event-exam {
          background: var(--danger-light);
          color: var(--danger);
        }

        .portal-indicator-pill.event-class {
          background: var(--success-light);
          color: var(--success);
        }

        .portal-indicator-pill.event-reminder {
          background: var(--warning-light);
          color: var(--warning);
        }

        .portal-fee-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          border-radius: 4px;
          padding: 1px 4px;
        }

        .portal-fee-badge.paid {
          background: var(--success-light);
          color: var(--success);
        }

        .portal-fee-badge.pending {
          background: var(--danger-light);
          color: var(--danger);
        }

        .btn-text-expand {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--brand-600, #4f46e5);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-text-expand:hover {
          background: var(--brand-50, #f5f3ff);
          border-color: var(--brand-300, #c7d2fe);
          transform: translateY(-1px);
        }

        .portal-plan-card {
          cursor: pointer;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px 12px;
          position: relative;
          transition: all 0.15s ease;
        }

        .portal-plan-card:hover {
          background: var(--card-bg);
          border-color: var(--brand-400, #818cf8);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
        }

        /* ─── Plan Text Modal (Center Popup) ─── */
        .plan-text-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: planModalFadeIn 0.15s ease-out;
        }

        @keyframes planModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes planModalScaleUp {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .plan-text-modal-content {
          background: var(--card-bg, #ffffff);
          width: 100%;
          max-width: 680px;
          max-height: 85vh;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: planModalScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .plan-text-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 22px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .plan-text-modal-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--brand-100, #e0e7ff);
          color: var(--brand-600, #4f46e5);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .modal-close-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-close-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .plan-text-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 22px;
          min-height: 240px;
        }

        .modal-reader-view {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 20px;
        }

        .plan-text-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 22px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        /* ─── Side Panel ─── */
        .portal-side-panel {
          width: 360px;
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .portal-side-panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .portal-side-panel-header h3 {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .portal-side-panel-content {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .portal-panel-section-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }

        .portal-event-item {
          display: flex;
          align-items: flex-start;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--bg-tertiary);
          margin-bottom: 8px;
          border-left: 3px solid var(--border-color);
        }

        .portal-event-item.exam { border-left-color: var(--danger); }
        .portal-event-item.class { border-left-color: var(--success); }
        .portal-event-item.reminder { border-left-color: var(--warning); }

        .portal-event-info h4 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .portal-event-info p {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .portal-hw-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 6px;
          color: var(--text-primary);
        }

        .portal-hw-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 100px;
        }

        .portal-hw-badge.completed {
          background: var(--success-light);
          color: var(--success);
        }

        .portal-hw-badge.incomplete {
          background: var(--danger-light);
          color: var(--danger);
        }

        .portal-hw-badge.assigned {
          background: var(--info-light);
          color: var(--info);
        }

        /* Rich Vibrant Green Teacher Announcements Widget */
        .recent-announcements-widget {
          background: linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%);
          border: 1.5px solid #86efac;
          border-radius: var(--radius-lg, 16px);
          padding: 18px 20px;
          margin-bottom: 24px;
          box-shadow: 0 4px 16px rgba(34, 197, 94, 0.12);
        }

        [data-theme="dark"] .recent-announcements-widget {
          background: linear-gradient(135deg, rgba(20, 83, 45, 0.75) 0%, rgba(6, 78, 59, 0.6) 100%);
          border: 1.5px solid #22c55e;
          box-shadow: 0 4px 20px rgba(34, 197, 94, 0.2);
        }

        .announcements-widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid #bbf7d0;
        }

        [data-theme="dark"] .announcements-widget-header {
          border-bottom-color: rgba(74, 222, 128, 0.3);
        }

        .announcements-icon-badge {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #16a34a;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(22, 163, 74, 0.35);
        }

        .announcements-widget-title {
          font-size: 15px;
          font-weight: 700;
          color: #14532d;
        }

        [data-theme="dark"] .announcements-widget-title {
          color: #4ade80;
        }

        .announcements-view-all {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #15803d;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        [data-theme="dark"] .announcements-view-all {
          color: #4ade80;
        }

        .announcements-view-all:hover {
          color: #166534;
        }

        [data-theme="dark"] .announcements-view-all:hover {
          color: #86efac;
        }

        .announcement-item-card {
          background: #ffffff;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 12px 16px;
          transition: all 0.15s ease;
        }

        [data-theme="dark"] .announcement-item-card {
          background: rgba(20, 83, 45, 0.55);
          border-color: rgba(74, 222, 128, 0.3);
        }

        .announcement-item-title {
          font-size: 14px;
          font-weight: 600;
          color: #14532d;
        }

        [data-theme="dark"] .announcement-item-title {
          color: #f0fdf4;
        }

        .announcement-item-date {
          font-size: 11px;
          color: #166534;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        [data-theme="dark"] .announcement-item-date {
          color: #86efac;
        }

        .announcement-item-body {
          font-size: 13px;
          color: #166534;
          margin: 0;
          line-height: 1.5;
        }

        [data-theme="dark"] .announcement-item-body {
          color: #dcfce7;
        }
      `}</style>

      {/* ─── Recent Announcements Widget ─── */}
      {recentAnnouncements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="recent-announcements-widget"
        >
          <div className="announcements-widget-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="announcements-icon-badge">
                <Megaphone size={16} />
              </div>
              <h3 className="announcements-widget-title">
                Teacher Announcements
              </h3>
            </div>
            <Link href="/portal/announcements" className="announcements-view-all">
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentAnnouncements.map((ann) => (
              <div key={ann.id} className="announcement-item-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 4,
                  }}
                >
                  <h4 className="announcement-item-title">
                    {ann.title}
                  </h4>
                  <span className="announcement-item-date">
                    <CalendarIcon size={11} />
                    {new Date(ann.created_at).toLocaleDateString("default", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                {ann.message && (
                  <p className="announcement-item-body">
                    {ann.message.length > 140
                      ? `${ann.message.substring(0, 140)}...`
                      : ann.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {isLoading ? (
        <div style={{ padding: "80px 0", textAlign: "center", color: "var(--gray-400)" }}>
          Loading your study calendar...
        </div>
      ) : (
        <div className="portal-split-layout">
          {/* ─── Main Calendar ─── */}
          <div className="portal-calendar-main">
            <div className="portal-calendar-card">
              {/* Header */}
              <div className="portal-calendar-header">
                <div className="portal-month-year" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h2>
                    {currentDate.toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  {monthData?.month_fee_status === "paid" ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 10px",
                        borderRadius: 100,
                        fontSize: 12,
                        fontWeight: 700,
                        background: "#ecfdf5",
                        color: "#059669",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      <CheckCircle size={13} />
                      Fees Paid {monthData.month_paid_date ? `(${formatDisplayDate(monthData.month_paid_date)})` : ""}
                    </span>
                  ) : monthData?.month_fee_status === "pending" ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 10px",
                        borderRadius: 100,
                        fontSize: 12,
                        fontWeight: 700,
                        background: "#fff1f2",
                        color: "#e11d48",
                        border: "1px solid #fecdd3",
                      }}
                    >
                      <Clock size={13} />
                      Fees Due {monthData.fee_due_day ? `(Due: ${monthData.fee_due_day}th)` : ""}
                    </span>
                  ) : null}
                </div>
                <div className="portal-calendar-actions">
                  <button className="portal-today-btn" onClick={setToday}>
                    Today
                  </button>
                  <button className="portal-nav-btn" onClick={handlePrevMonth}>
                    <ChevronLeft size={16} />
                  </button>
                  <button className="portal-nav-btn" onClick={handleNextMonth}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Weekday Grid */}
              <div className="portal-calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="portal-weekday-header">
                    {day}
                  </div>
                ))}

                {/* Day Cells */}
                {gridDays.map(({ date: dayDate, isCurrentMonth, isoStr }) => {
                  const isToday = new Date().toDateString() === dayDate.toDateString();
                  const isSelected = selectedDateStr === isoStr;
                  const dayData: CalendarDayData | undefined = monthData?.days?.[isoStr];

                  // Check event types
                  const hasExam = dayData?.events?.some((e) => e.event_type === "exam");
                  const hasClass = dayData?.events?.some((e) => e.event_type === "class");
                  const hasReminder = dayData?.events?.some((e) => e.event_type === "reminder");

                  return (
                    <div
                      key={isoStr}
                      className={`portal-day-cell ${!isCurrentMonth ? "outside" : ""} ${
                        isSelected ? "selected" : ""
                      } ${isToday ? "is-today" : ""}`}
                      onClick={() => setSelectedDateStr(isoStr)}
                      id={`portal-cal-cell-${isoStr}`}
                    >
                      <div className="portal-day-number-wrapper">
                        <span className="portal-day-number">{dayDate.getDate()}</span>
                        {dayData?.fee_status === "paid" && (
                          <span
                            className="portal-fee-badge paid"
                            title={`Fee Paid on ${formatDisplayDate(isoStr)}`}
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "#dcfce7",
                              color: "#15803d",
                              border: "1px solid #86efac",
                            }}
                          >
                            ✓ Fee Paid
                          </span>
                        )}
                      </div>

                      {/* Daily plan text hidden from grid cells per user preference; visible in sidebar preview */}

                      <div className="portal-cell-indicators">
                        {/* Attendance Dot */}
                        {dayData?.attendance && (
                          <span
                            className={`portal-indicator-dot attendance-${dayData.attendance.status}`}
                            title={`Attendance: ${dayData.attendance.status}`}
                          />
                        )}

                        {/* Birthday indicator */}
                        {dayData?.is_birthday && (
                          <span
                            style={{
                              background: "linear-gradient(135deg, #fbcfe8, #f472b6)",
                              color: "#831843",
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 100,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            🎂 Birthday
                          </span>
                        )}

                        {/* Event indicator pills */}
                        {hasExam && (
                          <span className="portal-indicator-pill event-exam">Exam</span>
                        )}
                        {hasClass && (
                          <span className="portal-indicator-pill event-class">Class</span>
                        )}
                        {hasReminder && (
                          <span className="portal-indicator-pill event-reminder">Rem</span>
                        )}

                        {/* Homework indicator */}
                        {dayData?.homework && dayData.homework.length > 0 && (
                          <span
                            style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 100,
                              fontWeight: 600,
                            }}
                          >
                            HW ({dayData.homework.length})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── Side Details Panel (Read-Only) ─── */}
          <div className="portal-side-panel">
            <div className="portal-side-panel-header">
              <h3>
                {selectedDateStr
                  ? formatDisplayDate(selectedDateStr, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Select a Date"}
              </h3>
              {selectedDateStr && (
                <button
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--gray-400)",
                  }}
                  onClick={() => setSelectedDateStr(null)}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="portal-side-panel-content">
              {/* Birthday banner if selected day is student's birthday */}
              {selectedDateStr && monthData?.days?.[selectedDateStr]?.is_birthday && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #fdf2f8, #fbcfe8)",
                    border: "1px solid #f472b6",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 16,
                    color: "#831843",
                    fontWeight: 600,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: "0 2px 8px rgba(244, 114, 182, 0.15)",
                  }}
                >
                  <span style={{ fontSize: 22 }}>🎂</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Happy Birthday! 🎉</div>
                    <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>
                      Special birthday celebration day on your calendar!
                    </div>
                  </div>
                </div>
              )}

              {selectedDateStr && selectedDayData ? (
                <>
                  {/* Attendance */}
                  <div>
                    <div className="portal-panel-section-title">Attendance</div>
                    {selectedDayData.attendance ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 13,
                          textTransform: "capitalize",
                          background:
                            selectedDayData.attendance.status === "present"
                              ? "var(--success-light)"
                              : selectedDayData.attendance.status === "absent"
                              ? "var(--danger-light)"
                              : "#fef3c7",
                          color:
                            selectedDayData.attendance.status === "present"
                              ? "var(--success)"
                              : selectedDayData.attendance.status === "absent"
                              ? "var(--danger)"
                              : "#d97706",
                        }}
                      >
                        <CheckCircle size={14} />
                        {selectedDayData.attendance.status}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: "var(--gray-400)", fontStyle: "italic" }}>
                        No attendance recorded
                      </p>
                    )}
                  </div>

                  {/* Daily Plan & Delivery (matches teacher calendar structure) */}
                  <div>
                    <div className="portal-panel-section-title">
                      <span>Daily Plan & Delivery</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* Preview Full Plan Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const parts = [
                            `### Planned Topics to Teach\n${selectedDayData.daily_plan?.topics_to_teach || "*No planned topics recorded.*"}`,
                            `### Things Actually Taught Today\n${selectedDayData.daily_plan?.actually_taught || "*Record of what was actually covered or completed in class will appear here once logged by teacher.*"}`,
                            `### Teaching Notes / Remarks\n${selectedDayData.daily_plan?.notes || "*No remarks or notes recorded.*"}`,
                          ];
                          openModal(
                            "Daily Plan & Delivery",
                            "all",
                            parts.join("\n\n---\n\n")
                          );
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: "1.5px solid var(--brand-200, #c7d2fe)",
                          background: "var(--brand-50, #f5f3ff)",
                          color: "var(--brand-700, #4338ca)",
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          boxShadow: "0 1px 4px rgba(99, 102, 241, 0.1)",
                        }}
                        title="Click to open full reading view in center popup"
                        id="preview-full-plan-btn"
                      >
                        <Eye size={14} />
                        <span>Preview Full Topic Plan & Notes</span>
                      </button>

                      {/* 1. Planned Topics to Teach */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--gray-500)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <BookOpen size={12} />
                            Planned Topics to Teach
                          </span>
                          <button
                            type="button"
                            className="btn-text-expand"
                            onClick={() =>
                              openModal(
                                "Planned Topics to Teach",
                                "topics",
                                selectedDayData.daily_plan?.topics_to_teach || "No planned topics logged for this date."
                              )
                            }
                            title="Click to view full text in center popup"
                            id="expand-student-topics-btn"
                          >
                            <Maximize2 size={11} />
                            <span>Expand</span>
                          </button>
                        </div>
                        {selectedDayData.daily_plan?.topics_to_teach ? (
                          <div
                            className="portal-plan-card"
                            onClick={() =>
                              openModal(
                                "Planned Topics to Teach",
                                "topics",
                                selectedDayData.daily_plan?.topics_to_teach || ""
                              )
                            }
                            title="Click to expand & view full text in center popup"
                          >
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--text-primary)",
                                lineHeight: 1.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                paddingRight: 20,
                              }}
                            >
                              {selectedDayData.daily_plan.topics_to_teach}
                            </div>
                            <span
                              style={{
                                position: "absolute",
                                right: 8,
                                top: 8,
                                color: "var(--brand-600, #4f46e5)",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Maximize2 size={12} />
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: "var(--bg-tertiary)",
                              border: "1px dashed var(--border-color)",
                              borderRadius: 8,
                              padding: "9px 12px",
                              fontSize: 12,
                              color: "var(--text-tertiary)",
                              fontStyle: "italic",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              openModal(
                                "Planned Topics to Teach",
                                "topics",
                                "No planned topics logged for this date."
                              )
                            }
                          >
                            No planned topics logged for this date.
                          </div>
                        )}
                      </div>

                      {/* 2. Things Actually Taught Today */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--brand-600, #4f46e5)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <CheckCircle size={12} />
                            Things Actually Taught Today
                          </span>
                          <button
                            type="button"
                            className="btn-text-expand"
                            onClick={() =>
                              openModal(
                                "Things Actually Taught Today",
                                "actuallyTaught",
                                selectedDayData.daily_plan?.actually_taught || "Record of what was actually covered or completed in class will appear here once logged by teacher."
                              )
                            }
                            title="Click to view full text in center popup"
                            id="expand-student-taught-btn"
                          >
                            <Maximize2 size={11} />
                            <span>Expand</span>
                          </button>
                        </div>
                        {selectedDayData.daily_plan?.actually_taught ? (
                          <div
                            className="portal-plan-card"
                            style={{ borderColor: "var(--brand-200, #c7d2fe)" }}
                            onClick={() =>
                              openModal(
                                "Things Actually Taught Today",
                                "actuallyTaught",
                                selectedDayData.daily_plan?.actually_taught || ""
                              )
                            }
                            title="Click to expand & view full text in center popup"
                          >
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--text-primary)",
                                lineHeight: 1.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                paddingRight: 20,
                              }}
                            >
                              {selectedDayData.daily_plan.actually_taught}
                            </div>
                            <span
                              style={{
                                position: "absolute",
                                right: 8,
                                top: 8,
                                color: "var(--brand-600, #4f46e5)",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Maximize2 size={12} />
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: "var(--bg-tertiary)",
                              border: "1px dashed var(--brand-200, #c7d2fe)",
                              borderRadius: 8,
                              padding: "9px 12px",
                              fontSize: 12,
                              color: "var(--text-tertiary)",
                              fontStyle: "italic",
                              lineHeight: 1.4,
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              openModal(
                                "Things Actually Taught Today",
                                "actuallyTaught",
                                "Record of what was actually covered or completed in class will appear here once logged by teacher."
                              )
                            }
                            title="Click to view in center popup"
                          >
                            Record of what was actually covered or completed in class will appear here once logged by teacher.
                          </div>
                        )}
                      </div>

                      {/* 3. Teaching Notes / Remarks */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--gray-500)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <FileText size={12} />
                            Teaching Notes / Remarks
                          </span>
                          <button
                            type="button"
                            className="btn-text-expand"
                            onClick={() =>
                              openModal(
                                "Teaching Notes / Remarks",
                                "notes",
                                selectedDayData.daily_plan?.notes || "No remarks or notes logged for this day."
                              )
                            }
                            title="Click to view full text in center popup"
                            id="expand-student-notes-btn"
                          >
                            <Maximize2 size={11} />
                            <span>Expand</span>
                          </button>
                        </div>
                        {selectedDayData.daily_plan?.notes ? (
                          <div
                            className="portal-plan-card"
                            onClick={() =>
                              openModal(
                                "Teaching Notes / Remarks",
                                "notes",
                                selectedDayData.daily_plan?.notes || ""
                              )
                            }
                            title="Click to expand & view full text in center popup"
                          >
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--text-primary)",
                                lineHeight: 1.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: "vertical",
                                whiteSpace: "pre-line",
                                paddingRight: 20,
                              }}
                            >
                              {selectedDayData.daily_plan.notes}
                            </div>
                            <span
                              style={{
                                position: "absolute",
                                right: 8,
                                top: 8,
                                color: "var(--brand-600, #4f46e5)",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Maximize2 size={12} />
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: "var(--bg-tertiary)",
                              border: "1px dashed var(--border-color)",
                              borderRadius: 8,
                              padding: "9px 12px",
                              fontSize: 12,
                              color: "var(--text-tertiary)",
                              fontStyle: "italic",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              openModal(
                                "Teaching Notes / Remarks",
                                "notes",
                                "No remarks or notes logged for this day."
                              )
                            }
                          >
                            No remarks or notes logged for this day.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Events */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div className="portal-panel-section-title" style={{ margin: 0 }}>Calendar Events & Exams</div>
                      {canEditCalendar && (
                        <button
                          type="button"
                          onClick={() => setShowAddEventModal(true)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-tertiary)",
                            color: "var(--brand-600)",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Plus size={12} /> Add Event
                        </button>
                      )}
                    </div>

                    {selectedDayData.events && selectedDayData.events.length > 0 ? (
                      selectedDayData.events.map((event) => (
                        <div key={event.id} className={`portal-event-item ${event.event_type}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div className="portal-event-info">
                            <h4>{event.title}</h4>
                            <p style={{ textTransform: "capitalize" }}>
                              {event.event_type}
                              {event.description ? ` • ${event.description}` : ""}
                            </p>
                          </div>
                          {canEditCalendar && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete event "${event.title}"?`)) {
                                  deleteEventMutation.mutate(event.id);
                                }
                              }}
                              title="Delete event"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                padding: "4px 6px",
                                borderRadius: 4,
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 12, color: "var(--gray-400)", textAlign: "center", padding: "10px 0" }}>
                        No events scheduled for this day
                      </p>
                    )}
                  </div>

                  {/* Homework */}
                  <div>
                    <div className="portal-panel-section-title">Homework Due</div>
                    {selectedDayData.homework && selectedDayData.homework.length > 0 ? (
                      selectedDayData.homework.map((hw) => (
                        <div key={hw.id} className="portal-hw-item">
                          <div>
                            <strong style={{ display: "block" }}>{hw.title}</strong>
                            <span style={{ fontSize: 11, color: "var(--gray-400)" }}>
                              {hw.subject}
                            </span>
                          </div>
                          <span className={`portal-hw-badge ${hw.status}`}>{hw.status}</span>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 12, color: "var(--gray-400)", textAlign: "center", padding: "10px 0" }}>
                        No homework due on this date
                      </p>
                    )}
                  </div>

                  {/* Fee Status */}
                  {selectedDayData.fee_status && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: 12,
                        borderRadius: 8,
                        background: selectedDayData.fee_status === "paid" ? "var(--success-light)" : "var(--danger-light)",
                        color: selectedDayData.fee_status === "paid" ? "var(--success)" : "var(--danger)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <CreditCard size={18} />
                      <span>
                        Fee status: {selectedDayData.fee_status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </>
              ) : selectedDateStr ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--gray-400)" }}>
                  <CalendarDays size={40} style={{ marginBottom: 12, color: "var(--gray-300)" }} />
                  <p style={{ fontSize: 13 }}>
                    No data available for this date.
                  </p>
                  {canEditCalendar && (
                    <button
                      type="button"
                      onClick={() => setShowAddEventModal(true)}
                      style={{
                        marginTop: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: "var(--brand-500)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={13} /> Add Event on this Date
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--gray-400)" }}>
                  <CalendarDays size={40} style={{ marginBottom: 12, color: "var(--gray-300)" }} />
                  <p style={{ fontSize: 13 }}>
                    Click any cell in the calendar to view attendance, daily topics, homework, and class events.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Text Modal (Center Popup - Read-Only Preview for Students) */}
      <PlanTextModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        field={modalState.field}
        dateStr={selectedDateStr || ""}
        initialValue={modalState.value}
        readOnly={true}
      />

      {/* Add Calendar Event Modal */}
      {showAddEventModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowAddEventModal(false)}
        >
          <div
            style={{
              background: "var(--card-bg, #fff)",
              borderRadius: "var(--radius, 12px)",
              border: "1px solid var(--border-color, #e2e8f0)",
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                Add Event for {selectedDateStr || formatLocalDateToISO(currentDate)}
              </h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newEventTitle.trim()) return;
                createEventMutation.mutate({
                  event_date: selectedDateStr || formatLocalDateToISO(currentDate),
                  title: newEventTitle.trim(),
                  description: newEventDesc.trim() || undefined,
                  event_type: newEventType,
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Event Title *
                </label>
                <input
                  required
                  placeholder="e.g. Science Project Submission, Math Quiz"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Type
                </label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="reminder">Reminder</option>
                  <option value="exam">Exam / Test</option>
                  <option value="class">Study Session</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createEventMutation.isPending}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--brand-500, #4f46e5)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {createEventMutation.isPending ? "Adding..." : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
