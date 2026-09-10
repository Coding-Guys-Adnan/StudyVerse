import api from "./api";
import { Student, StudentEffectivePermissionsResponse, StudentPermissions } from "./students-api";
import {
  Attendance,
  DailyPlan,
  CalendarEvent,
  FeeRecord,
  Homework,
  Syllabus,
  SyllabusChapter,
  ChecklistItem,
  ChapterNote,
  SyllabusAttachment,
  Test,
  CalendarMonthResponse,
  Announcement,
  AIPlan,
  CalendarDayData,
  AIChatMessage,
  AIChatResponse,
  AIQuotaStatus,
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
  // Profile & Permissions
  getProfile: () =>
    api.get<Student>("/portal/profile"),

  getPermissions: () =>
    api.get<StudentEffectivePermissionsResponse>("/portal/permissions"),

  // Homework
  getHomeworkList: () =>
    api.get<Homework[]>("/portal/homework"),

  createHomework: (data: { subject: string; title: string; description?: string; due_date?: string; status?: string; attachment_name?: string; attachment_url?: string }) =>
    api.post<Homework>("/portal/homework", data),

  updateHomework: (id: string, data: Partial<Homework>) =>
    api.put<Homework>(`/portal/homework/${id}`, data),

  deleteHomework: (id: string) =>
    api.delete(`/portal/homework/${id}`),

  uploadHomeworkAttachment: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ filename: string; url: string }>("/portal/homework/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Syllabus
  getSyllabusList: () =>
    api.get<Syllabus[]>("/portal/syllabus"),

  toggleChecklistItem: (itemId: string, completed: boolean) =>
    api.put(`/portal/syllabus/items/${itemId}/toggle?completed=${completed}`),

  createSyllabus: (data: { subject: string; chapter: string; chapter_type?: string | null; term?: string | null; status?: string; progress?: number; sort_order?: number }) =>
    api.post<Syllabus>("/portal/syllabus", data),

  createSyllabusBulk: async (
    items: {
      subject: string;
      chapter: string;
      chapter_type?: string | null;
      term?: string | null;
      status?: string;
      progress?: number;
      sort_order?: number;
    }[]
  ) => {
    try {
      return await api.post<Syllabus[]>("/portal/syllabus/bulk", items);
    } catch (err) {
      // Fallback: create topics sequentially if bulk endpoint fails
      const results: Syllabus[] = [];
      for (const item of items) {
        const res = await api.post<Syllabus>("/portal/syllabus", item);
        results.push(res.data);
      }
      return { data: results };
    }
  },

  updateSyllabus: (id: string, data: Partial<Syllabus>) =>
    api.put<Syllabus>(`/portal/syllabus/${id}`, data),

  deleteSyllabus: (id: string) =>
    api.delete(`/portal/syllabus/${id}`),

  createChapter: (syllabusId: string, data: { title: string; order?: number }) =>
    api.post<SyllabusChapter>(`/portal/syllabus/${syllabusId}/chapters`, data),

  updateChapter: (chapterId: string, data: { title?: string; order?: number }) =>
    api.put<SyllabusChapter>(`/portal/syllabus/chapters/${chapterId}`, data),

  deleteChapter: (chapterId: string) =>
    api.delete(`/portal/syllabus/chapters/${chapterId}`),

  createChecklistItem: (chapterId: string, data: { text: string; completed?: boolean; order?: number }) =>
    api.post<ChecklistItem>(`/portal/syllabus/chapters/${chapterId}/items`, data),

  updateChecklistItem: (itemId: string, data: { text?: string; completed?: boolean; order?: number }) =>
    api.put<ChecklistItem>(`/portal/syllabus/items/${itemId}`, data),

  deleteChecklistItem: (itemId: string) =>
    api.delete(`/portal/syllabus/items/${itemId}`),

  createChapterNote: (chapterId: string, data: { text: string }) =>
    api.post<ChapterNote>(`/portal/syllabus/chapters/${chapterId}/notes`, data),

  deleteChapterNote: (noteId: string) =>
    api.delete(`/portal/syllabus/notes/${noteId}`),

  uploadSyllabusAttachment: (file: File, params?: { checklist_item_id?: string; chapter_note_id?: string }) => {
    const formData = new FormData();
    formData.append("file", file);
    let url = "/portal/syllabus/attachments";
    const qp: string[] = [];
    if (params?.checklist_item_id) qp.push(`checklist_item_id=${params.checklist_item_id}`);
    if (params?.chapter_note_id) qp.push(`chapter_note_id=${params.chapter_note_id}`);
    if (qp.length > 0) url += `?${qp.join("&")}`;
    return api.post<SyllabusAttachment>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  importSyllabus: (items: any[]) =>
    api.post<Syllabus[]>("/portal/syllabus/import", items),

  // Tests
  getTests: () =>
    api.get<Test[]>("/portal/tests"),

  createTest: (data: { subject: string; exam_name: string; exam_type: "school" | "tuition"; max_marks: number; obtained_marks: number; remarks?: string; exam_date?: string; question_paper_name?: string; question_paper_url?: string; answer_paper_name?: string; answer_paper_url?: string }) =>
    api.post<Test>("/portal/tests", data),

  updateTest: (id: string, data: Partial<Test>) =>
    api.put<Test>(`/portal/tests/${id}`, data),

  deleteTest: (id: string) =>
    api.delete(`/portal/tests/${id}`),

  uploadTestPaper: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ filename: string; url: string }>("/portal/tests/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Calendar mutations
  createCalendarEvent: (data: { event_date: string; title: string; description?: string; event_type?: string }) =>
    api.post<CalendarEvent>("/portal/calendar/events", data),

  deleteCalendarEvent: (eventId: string) =>
    api.delete(`/portal/calendar/events/${eventId}`),

  // Fees
  getFees: () =>
    api.get<FeeRecord[]>("/portal/fees"),

  // Files
  getFiles: () =>
    api.get<PortalFile[]>("/portal/files"),

  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ id: string; name: string; url: string; file_size: number }>("/portal/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

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

  // AI Chat & Quota
  sendAIChat: (
    message: string,
    history: AIChatMessage[] = [],
    attachment?: { file_data?: string; file_name?: string; mime_type?: string }
  ) =>
    api.post<AIChatResponse>("/portal/ai/chat", {
      message,
      history,
      ...attachment,
    }),

  getAIQuotaStatus: () =>
    api.get<AIQuotaStatus>("/portal/ai/quota"),
};
export type {
  Student,
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
  AIChatMessage,
  AIChatResponse,
  AIQuotaStatus,
};
