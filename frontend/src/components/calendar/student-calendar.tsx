"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  FileText,
  Clock,
  Award,
  CalendarDays,
  Bookmark,
  CheckCircle,
  HelpCircle,
  CreditCard,
  Maximize2,
  Eye,
  Edit3,
  BookOpen,
} from "lucide-react";
import { academicApi, type CalendarDayData } from "@/lib/academic-api";
import { formatLocalDateToISO, formatDisplayDate } from "@/lib/date-utils";
import { PlanTextModal } from "./plan-text-modal";

interface StudentCalendarProps {
  studentId: string;
}

export function StudentCalendar({ studentId }: StudentCalendarProps) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed

  // ─── Query Month Data ──────────────────────────────────
  const { data: monthData, isLoading } = useQuery({
    queryKey: ["calendar", studentId, year, month],
    queryFn: () => academicApi.getCalendarMonth(studentId, year, month),
    select: (res) => res.data,
  });

  // ─── Grid Calculations ──────────────────────────────────
  const gridDays = useMemo(() => {
    // Days in current month
    const totalDays = new Date(year, month, 0).getDate();
    // First day of month (0 = Sunday, 1 = Monday, etc.)
    const firstDayIndex = new Date(year, month - 1, 1).getDay();

    const daysList = [];

    // Padding from previous month
    const prevMonthYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevMonthTotalDays = new Date(prevMonthYear, prevMonth, 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(prevMonthYear, prevMonth - 1, prevMonthTotalDays - i);
      daysList.push({
        date: d,
        isCurrentMonth: false,
        isoStr: formatLocalDateToISO(d),
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month - 1, i);
      daysList.push({
        date: d,
        isCurrentMonth: true,
        isoStr: formatLocalDateToISO(d),
      });
    }

    // Padding for next month
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const remainingSlots = 42 - daysList.length;

    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(nextMonthYear, nextMonth - 1, i);
      daysList.push({
        date: d,
        isCurrentMonth: false,
        isoStr: formatLocalDateToISO(d),
      });
    }

    return daysList;
  }, [year, month]);

  // ─── Handlers ───────────────────────────────────────────
  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(formatLocalDateToISO(today));
  };

  const selectedDayData = selectedDateStr ? monthData?.days[selectedDateStr] : null;

  return (
    <div className="calendar-container">
      <style>{`
        .calendar-container {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .month-year h2 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .calendar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-btn {
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

        .nav-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .today-btn {
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

        .today-btn:hover {
          background: var(--brand-100);
        }

        /* ─── Grid ──────────────────────────────────── */
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: var(--border-color);
          gap: 1px;
        }

        .weekday-header {
          background: var(--bg-tertiary);
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 0;
        }

        .day-cell {
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
          .day-cell {
            min-height: 60px;
            padding: 4px;
          }
        }

        .day-cell:hover {
          background: var(--bg-tertiary);
        }

        .day-cell.outside {
          background: var(--bg-secondary);
          color: var(--text-tertiary);
        }

        .day-cell.selected {
          background: var(--brand-50);
          outline: 2px solid var(--brand-500);
          outline-offset: -2px;
          z-index: 10;
        }

        .day-number-wrapper {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .day-number {
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

        .day-cell.outside .day-number {
          color: var(--text-tertiary);
        }

        .day-cell.is-today .day-number {
          background: var(--brand-500);
          color: white !important;
        }

        /* Indicators */
        .cell-indicators {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
        }

        .indicator-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .indicator-dot.attendance-present { background: var(--success); }
        .indicator-dot.attendance-absent { background: var(--danger); }
        .indicator-dot.attendance-leave { background: var(--warning); }

        .indicator-pill {
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

        .indicator-pill.event-exam {
          background: var(--danger-light);
          color: var(--danger);
        }

        .indicator-pill.event-class {
          background: var(--success-light);
          color: var(--success);
        }

        .indicator-pill.event-reminder {
          background: var(--warning-light);
          color: var(--warning);
        }

        .fee-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          border-radius: 4px;
          padding: 1px 4px;
        }

        .fee-badge.paid {
          background: var(--success-light);
          color: var(--success);
        }

        .fee-badge.pending {
          background: var(--danger-light);
          color: var(--danger);
        }

        .topics-taught-preview {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.3;
        }

        .day-cell.outside .topics-taught-preview {
          color: var(--text-tertiary);
        }

        .split-layout {
          display: flex;
          min-height: 550px;
          gap: 24px;
          align-items: stretch;
        }

        @media (max-width: 900px) {
          .split-layout {
            flex-direction: column;
            min-height: auto;
          }
          .calendar-side-panel {
            width: 100% !important;
          }
        }

        .calendar-main {
          flex: 1;
          height: 100%;
          overflow-y: auto;
        }

        .calendar-side-panel {
          width: 360px;
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .side-panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .side-panel-header h3 {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .side-panel-content {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .panel-section-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .attendance-toggle-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .attendance-btn {
          padding: 10px;
          border: 1.5px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-primary);
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          transition: all 0.15s ease;
          min-height: 40px;
        }

        .attendance-btn:hover {
          background: var(--bg-tertiary);
        }

        .attendance-btn.present {
          border-color: var(--success);
          color: var(--success);
        }
        .attendance-btn.present.active {
          background: var(--success);
          color: white;
        }

        .attendance-btn.absent {
          border-color: var(--danger);
          color: var(--danger);
        }
        .attendance-btn.absent.active {
          background: var(--danger);
          color: white;
        }

        .attendance-btn.leave {
          border-color: var(--warning);
          color: var(--warning);
        }
        .attendance-btn.leave.active {
          background: var(--warning);
          color: white;
        }

        .notes-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1.5px solid var(--border-color);
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          min-height: 80px;
          resize: vertical;
          background: var(--card-bg);
          color: var(--text-primary);
        }

        .notes-textarea:focus {
          outline: none;
          border-color: var(--brand-400);
        }

        .save-plan-btn {
          width: 100%;
          padding: 10px;
          background: var(--brand-50);
          color: var(--brand-600);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.15s ease;
          min-height: 40px;
        }

        .save-plan-btn:hover {
          background: var(--brand-100);
        }

        .event-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--bg-tertiary);
          margin-bottom: 8px;
          border-left: 3px solid var(--border-color);
        }

        .event-item.exam { border-left-color: var(--danger); }
        .event-item.class { border-left-color: var(--success); }
        .event-item.reminder { border-left-color: var(--warning); }

        .event-info h4 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .event-info p {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .delete-event-btn {
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 4px;
        }

        .delete-event-btn:hover {
          color: var(--danger);
        }

        .event-form {
          border: 1px solid var(--border-color);
          padding: 12px;
          border-radius: 8px;
          margin-top: 8px;
          background: var(--card-bg);
        }

        .event-form-input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 12px;
          margin-bottom: 8px;
          font-family: inherit;
          background: var(--card-bg);
          color: var(--text-primary);
        }

        .event-form-select {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 12px;
          margin-bottom: 8px;
          font-family: inherit;
          background: var(--card-bg);
          color: var(--text-primary);
        }

        .add-event-submit {
          width: 100%;
          padding: 10px;
          background: var(--brand-600);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          min-height: 38px;
        }

        .homework-list-item {
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

        .modal-view-toggle {
          display: flex;
          background: var(--bg-tertiary);
          padding: 3px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          gap: 2px;
        }

        .modal-toggle-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-toggle-btn.active {
          background: var(--card-bg);
          color: var(--text-primary);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

        .modal-editor-textarea {
          width: 100%;
          min-height: 300px;
          padding: 16px;
          border: 1.5px solid var(--border-color);
          border-radius: 12px;
          font-size: 14.5px;
          line-height: 1.7;
          font-family: inherit;
          color: var(--text-primary);
          background: var(--card-bg);
          resize: vertical;
        }

        .modal-editor-textarea:focus {
          outline: none;
          border-color: var(--brand-500);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .plan-text-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 22px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
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
      `}</style>

      <div className="split-layout">
        {/* Main Calendar */}
        <div className="calendar-main">
          <div className="calendar-header">
            <div className="month-year" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                  Fees Unpaid {monthData.fee_due_day ? `(Due: ${monthData.fee_due_day}th)` : ""}
                </span>
              ) : null}
            </div>
            <div className="calendar-actions">
              <button className="today-btn" onClick={setToday}>
                Today
              </button>
              <button className="nav-btn" onClick={prevMonth}>
                <ChevronLeft size={16} />
              </button>
              <button className="nav-btn" onClick={nextMonth}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="weekday-header">
                {day}
              </div>
            ))}

            {gridDays.map(({ date: dayDate, isCurrentMonth, isoStr }) => {
              const isToday =
                new Date().toDateString() === dayDate.toDateString();
              const isSelected = selectedDateStr === isoStr;
              const dayData: CalendarDayData | undefined =
                monthData?.days[isoStr];

              // Check if day has exam event
              const hasExam = dayData?.events.some(
                (e) => e.event_type === "exam"
              );
              const hasClass = dayData?.events.some(
                (e) => e.event_type === "class"
              );
              const hasReminder = dayData?.events.some(
                (e) => e.event_type === "reminder"
              );

              return (
                <div
                  key={isoStr}
                  className={`day-cell ${!isCurrentMonth ? "outside" : ""} ${
                    isSelected ? "selected" : ""
                  } ${isToday ? "is-today" : ""}`}
                  onClick={() => setSelectedDateStr(isoStr)}
                  id={`calendar-cell-${isoStr}`}
                >
                  <div className="day-number-wrapper">
                    <span className="day-number">{dayDate.getDate()}</span>
                    {dayData?.fee_status === "paid" && (
                      <span
                        className="fee-badge paid"
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

                  {/* Daily plan text hidden from grid cells per user preference; visible in sidebar */}

                  <div className="cell-indicators">
                    {/* Attendance Dot */}
                    {dayData?.attendance && (
                      <span
                        className={`indicator-dot attendance-${dayData.attendance.status}`}
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

                    {/* Event indicators */}
                    {hasExam && (
                      <span className="indicator-pill event-exam">Exam</span>
                    )}
                    {hasClass && (
                      <span className="indicator-pill event-class">Class</span>
                    )}
                    {hasReminder && (
                      <span className="indicator-pill event-reminder">Rem</span>
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

        {/* Side Details Panel */}
        <div className="calendar-side-panel">
          <div className="side-panel-header">
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

          <div className="side-panel-content">
            {selectedDateStr && monthData?.days[selectedDateStr]?.is_birthday && (
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
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Student's Birthday! 🎉</div>
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>Special birthday celebration day on the calendar.</div>
                </div>
              </div>
            )}
            {selectedDateStr ? (
              <DayDetailsPanel
                studentId={studentId}
                dateStr={selectedDateStr}
                dayData={selectedDayData}
                monthData={monthData}
              />
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--gray-400)",
                }}
              >
                <CalendarDays
                  size={40}
                  style={{ marginBottom: 12, color: "var(--gray-300)" }}
                />
                <p style={{ fontSize: 13 }}>
                  Click any cell in the calendar to view, edit or log plan details, attendance, fee records, and class events.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Day Details Panel Sub-Component ────────────────────────
function DayDetailsPanel({
  studentId,
  dateStr,
  dayData,
  monthData,
}: {
  studentId: string;
  dateStr: string;
  dayData: CalendarDayData | null | undefined;
  monthData: any;
}) {
  const queryClient = useQueryClient();
  const [topics, setTopics] = useState(dayData?.daily_plan?.topics_to_teach || "");
  const [notes, setNotes] = useState(dayData?.daily_plan?.notes || "");
  const [actuallyTaught, setActuallyTaught] = useState(dayData?.daily_plan?.actually_taught || "");
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState("class");
  const [eventDesc, setEventDesc] = useState("");

  // Center Popup Modal State for Full Text View
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    field: "topics" | "actuallyTaught" | "notes";
    value: string;
  }>({
    isOpen: false,
    title: "",
    field: "topics",
    value: "",
  });

  const openModal = (
    title: string,
    field: "topics" | "actuallyTaught" | "notes",
    currentVal: string
  ) => {
    setModalState({
      isOpen: true,
      title,
      field,
      value: currentVal,
    });
  };

  const handleModalSave = (newVal: string) => {
    const field = modalState.field;
    const nextTopics = field === "topics" ? newVal : topics;
    const nextNotes = field === "notes" ? newVal : notes;
    const nextActuallyTaught = field === "actuallyTaught" ? newVal : actuallyTaught;

    if (field === "topics") setTopics(newVal);
    else if (field === "actuallyTaught") setActuallyTaught(newVal);
    else if (field === "notes") setNotes(newVal);

    academicApi.saveDailyPlan(studentId, dateStr, nextTopics, nextNotes, nextActuallyTaught).then(() => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    });
  };

  // Sync plan inputs when day changes
  useMemo(() => {
    setTopics(dayData?.daily_plan?.topics_to_teach || "");
    setNotes(dayData?.daily_plan?.notes || "");
    setActuallyTaught(dayData?.daily_plan?.actually_taught || "");
    setShowEventForm(false);
    setEventTitle("");
    setEventDesc("");
    setModalState({
      isOpen: false,
      title: "",
      field: "topics",
      value: "",
    });
  }, [dateStr, dayData]);

  // ─── Mutations ──────────────────────────────────────────
  const attendanceMutation = useMutation({
    mutationFn: ({ status }: { status: "present" | "absent" | "leave" | "none" }) => {
      if (status === "none") {
        return academicApi.removeAttendance(studentId, dateStr);
      }
      return academicApi.markAttendance(studentId, dateStr, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: () => academicApi.saveDailyPlan(studentId, dateStr, topics, notes, actuallyTaught),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const addEventMutation = useMutation({
    mutationFn: () =>
      academicApi.addEvent(studentId, {
        event_date: dateStr,
        title: eventTitle,
        description: eventDesc || undefined,
        event_type: eventType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setEventTitle("");
      setEventDesc("");
      setShowEventForm(false);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => academicApi.deleteEvent(studentId, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const toggleFeeMutation = useMutation({
    mutationFn: (newStatus: "paid" | "pending") =>
      academicApi.toggleFee(studentId, {
        fee_month: dateStr.slice(0, 7),
        status: newStatus,
        paid_date: newStatus === "paid" ? dateStr : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const monthName = new Date(dateStr + "T00:00:00").toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const activeAttendance = dayData?.attendance?.status || "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ─── Attendance ─── */}
      <div>
        <div className="panel-section-title">
          <span>Attendance</span>
        </div>
        <div className="attendance-toggle-row">
          {(["present", "absent", "leave"] as const).map((status) => (
            <button
              key={status}
              className={`attendance-btn ${status} ${
                activeAttendance === status ? "active" : ""
              }`}
              onClick={() =>
                attendanceMutation.mutate({
                  status: activeAttendance === status ? "none" : status,
                })
              }
              id={`attendance-btn-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Fee Status ─── */}
      <div>
        <div className="panel-section-title">
          <span>Fee Status ({monthName})</span>
        </div>
        <div className="attendance-toggle-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button
            className={`attendance-btn present ${monthData?.month_fee_status === "paid" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40 }}
            disabled={toggleFeeMutation.isPending}
            onClick={() => toggleFeeMutation.mutate("paid")}
            id="fee-paid-btn"
          >
            <CheckCircle size={15} />
            <span>Paid</span>
          </button>
          <button
            className={`attendance-btn absent ${monthData?.month_fee_status === "pending" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40 }}
            disabled={toggleFeeMutation.isPending}
            onClick={() => toggleFeeMutation.mutate("pending")}
            id="fee-pending-btn"
          >
            <Clock size={15} />
            <span>Unpaid</span>
          </button>
        </div>
        {monthData?.month_fee_status === "paid" ? (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontWeight: 500,
            }}
          >
            <CheckCircle size={13} />
            <span>
              Fee marked as paid for {monthName}
              {monthData.month_paid_date ? ` (on ${formatDisplayDate(monthData.month_paid_date)})` : ""}
            </span>
          </div>
        ) : (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontWeight: 500,
            }}
          >
            <Clock size={13} />
            <span>
              Fees unpaid for {monthName}
              {monthData?.fee_due_day ? ` (Due: ${monthData.fee_due_day}th of month)` : ""}
            </span>
          </div>
        )}
      </div>

      {/* ─── Daily Plan & Delivery ─── */}
      <div>
        <div className="panel-section-title">
          <span>Daily Plan & Delivery</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 1. Planned Topics to Teach */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--gray-500)",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                htmlFor="topics-to-teach"
                onClick={() => openModal("Planned Topics to Teach", "topics", topics)}
                title="Click to see whole text in center popup"
              >
                <span>Planned Topics to Teach</span>
              </label>
              <button
                type="button"
                className="btn-text-expand"
                onClick={() => openModal("Planned Topics to Teach", "topics", topics)}
                title="Click to view full text in center popup"
                id="expand-topics-btn"
              >
                <Maximize2 size={11} />
                <span>Expand</span>
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="topics-to-teach"
                className="form-input"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                onClick={() => openModal("Planned Topics to Teach", "topics", topics)}
                placeholder="e.g. Linear Equations in 2 Variables"
                style={{ padding: "8px 30px 8px 12px", cursor: "pointer" }}
                title="Click to expand & view full text in center popup"
              />
              <button
                type="button"
                onClick={() => openModal("Planned Topics to Teach", "topics", topics)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--brand-600, #4f46e5)",
                  cursor: "pointer",
                  padding: 3,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Open in center popup"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>

          {/* 2. Things Actually Taught Today */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--brand-600, #4f46e5)",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                htmlFor="actually-taught"
                onClick={() => openModal("Things Actually Taught Today", "actuallyTaught", actuallyTaught)}
                title="Click to see whole text in center popup"
              >
                <span>Things Actually Taught Today</span>
              </label>
              <button
                type="button"
                className="btn-text-expand"
                onClick={() => openModal("Things Actually Taught Today", "actuallyTaught", actuallyTaught)}
                title="Click to view full text in center popup"
                id="expand-actually-taught-btn"
              >
                <Maximize2 size={11} />
                <span>Expand</span>
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <textarea
                id="actually-taught"
                className="notes-textarea"
                style={{ minHeight: 65, borderColor: "var(--brand-200, #c7d2fe)", paddingRight: 32, cursor: "pointer" }}
                value={actuallyTaught}
                onChange={(e) => setActuallyTaught(e.target.value)}
                onClick={() => openModal("Things Actually Taught Today", "actuallyTaught", actuallyTaught)}
                placeholder="Record what was actually covered or completed in class today..."
                title="Click to expand & view full text in center popup"
              />
              <button
                type="button"
                onClick={() => openModal("Things Actually Taught Today", "actuallyTaught", actuallyTaught)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  background: "rgba(255,255,255,0.9)",
                  borderRadius: 4,
                  border: "1px solid var(--brand-200, #c7d2fe)",
                  color: "var(--brand-600, #4f46e5)",
                  cursor: "pointer",
                  padding: "2px 5px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 10,
                  gap: 3,
                }}
                title="Open in center popup"
              >
                <Maximize2 size={11} />
              </button>
            </div>
          </div>

          {/* 3. Teaching Notes / Remarks */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--gray-500)",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                htmlFor="plan-notes"
                onClick={() => openModal("Teaching Notes / Remarks", "notes", notes)}
                title="Click to see whole text in center popup"
              >
                <span>Teaching Notes / Remarks</span>
              </label>
              <button
                type="button"
                className="btn-text-expand"
                onClick={() => openModal("Teaching Notes / Remarks", "notes", notes)}
                title="Click to view full text in center popup"
                id="expand-notes-btn"
              >
                <Maximize2 size={11} />
                <span>Expand</span>
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <textarea
                id="plan-notes"
                className="notes-textarea"
                style={{ minHeight: 80, paddingRight: 32, cursor: "pointer" }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onClick={() => openModal("Teaching Notes / Remarks", "notes", notes)}
                placeholder="Private notes, reminders, student response..."
                title="Click to expand & view full text in center popup"
              />
              <button
                type="button"
                onClick={() => openModal("Teaching Notes / Remarks", "notes", notes)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  background: "rgba(255,255,255,0.9)",
                  borderRadius: 4,
                  border: "1px solid var(--border-color)",
                  color: "var(--brand-600, #4f46e5)",
                  cursor: "pointer",
                  padding: "2px 5px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 10,
                  gap: 3,
                }}
                title="Open in center popup"
              >
                <Maximize2 size={11} />
              </button>
            </div>
          </div>

          <button
            className="save-plan-btn"
            disabled={savePlanMutation.isPending}
            onClick={() => savePlanMutation.mutate()}
            id="save-plan-btn"
          >
            {savePlanMutation.isPending ? "Saving Daily Plan & Log..." : "Save Daily Plan & Log"}
          </button>
        </div>
      </div>

      {/* Plan Text Modal (Center Popup) */}
      <PlanTextModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        field={modalState.field}
        dateStr={dateStr}
        initialValue={modalState.value}
        onSave={handleModalSave}
        isSaving={savePlanMutation.isPending}
      />

      {/* ─── Events ─── */}
      <div>
        <div className="panel-section-title">
          <span>Calendar Events</span>
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--brand-600)",
              fontSize: 11,
              fontWeight: 600,
            }}
            onClick={() => setShowEventForm(!showEventForm)}
            id="add-event-btn"
          >
            {showEventForm ? "Cancel" : "Add Event"}
          </button>
        </div>

        {showEventForm && (
          <div className="event-form animate-fade-in">
            <input
              className="event-form-input"
              placeholder="Event Title * (e.g. Term Exam)"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              required
              id="event-title-input"
            />
            <select
              className="event-form-select"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              id="event-type-select"
            >
              <option value="class">Class Session</option>
              <option value="exam">Exam / Test</option>
              <option value="reminder">Reminder</option>
              <option value="other">Other Event</option>
            </select>
            <input
              className="event-form-input"
              placeholder="Description (Optional)"
              value={eventDesc}
              onChange={(e) => setEventDesc(e.target.value)}
            />
            <button
              className="add-event-submit"
              onClick={() => addEventMutation.mutate()}
              disabled={!eventTitle.trim() || addEventMutation.isPending}
              id="submit-event-btn"
            >
              Save Event
            </button>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          {dayData?.events && dayData.events.length > 0 ? (
            dayData.events.map((event) => (
              <div key={event.id} className={`event-item ${event.event_type}`}>
                <div className="event-info">
                  <h4>{event.title}</h4>
                  <p style={{ textTransform: "capitalize" }}>
                    {event.event_type}
                    {event.description ? ` • ${event.description}` : ""}
                  </p>
                </div>
                <button
                  className="delete-event-btn"
                  onClick={() => deleteEventMutation.mutate(event.id)}
                  title="Remove event"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 12, color: "var(--gray-400)", textAlign: "center", padding: "10px 0" }}>
              No events scheduled for this day
            </p>
          )}
        </div>
      </div>

      {/* ─── Homework Due ─── */}
      <div>
        <div className="panel-section-title">
          <span>Homework Due Today</span>
        </div>
        {dayData?.homework && dayData.homework.length > 0 ? (
          dayData.homework.map((hw) => (
            <div key={hw.id} className="homework-list-item">
              <div>
                <strong style={{ display: "block" }}>{hw.title}</strong>
                <span style={{ fontSize: 11, color: "var(--gray-400)" }}>
                  {hw.subject}
                </span>
              </div>
              <span className={`hw-badge ${hw.status}`}>{hw.status}</span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, color: "var(--gray-400)", textAlign: "center", padding: "10px 0" }}>
            No homework due on this date
          </p>
        )}
      </div>
    </div>
  );
}
