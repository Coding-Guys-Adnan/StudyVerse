import api from "./api";
import { Student } from "./students-api";
import {
  Attendance,
  DailyPlan,
  CalendarEvent,
  FeeRecord,
  Homework,
  Syllabus,
  Test,
  CalendarMonthResponse,
  Announcement,
  AIPlan,
  CalendarDayData,
} from "./academic-api";

export interface PortalFile {
  id: string;
  name: string;
  url: string;
  category: "homework" | "syllabus" | "exams" | "recommendations";
  source_label: string;
  file_size?: number | null;
  created_at: string;
}

export const portalApi = {
  // Profile
  getProfile: () =>
    api.get<Student>("/portal/profile"),

  // Homework
  getHomeworkList: () =>
    api.get<Homework[]>("/portal/homework"),

  // Syllabus
  getSyllabusList: () =>
    api.get<Syllabus[]>("/portal/syllabus"),

  toggleChecklistItem: (itemId: string, completed: boolean) =>
    api.put(`/portal/syllabus/items/${itemId}/toggle?completed=${completed}`),

  // Tests
  getTests: () =>
    api.get<Test[]>("/portal/tests"),

  // Fees
  getFees: () =>
    api.get<FeeRecord[]>("/portal/fees"),

  // Files
  getFiles: () =>
    api.get<PortalFile[]>("/portal/files"),

  // Calendar aggregation
  getCalendarMonth: (year: number, month: number) =>
    api.get<CalendarMonthResponse>("/portal/calendar", {
      params: { year, month },
    }),

  // Announcements
  getAnnouncements: () =>
    api.get<Announcement[]>("/announcements"), // reused global announcements endpoint

  // AI Plans
  getAIPlans: () =>
    api.get<AIPlan[]>("/portal/ai/plans"),
};
export type { Student, Attendance, DailyPlan, CalendarEvent, FeeRecord, Homework, Syllabus, Test, CalendarMonthResponse, Announcement, AIPlan, CalendarDayData };
