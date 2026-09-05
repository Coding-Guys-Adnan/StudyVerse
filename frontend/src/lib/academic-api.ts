import api from "./api";
import { Student } from "./students-api";

// ─── Academic Types ─────────────────────────────────────

export interface Attendance {
  id: string;
  student_id: string;
  date: string; // ISO Date YYYY-MM-DD
  status: "present" | "absent" | "leave";
}

export interface DailyPlan {
  id: string;
  student_id: string;
  date: string;
  topics_to_teach: string | null;
  notes: string | null;
}

export interface CalendarEvent {
  id: string;
  student_id: string;
  event_date: string;
  title: string;
  description: string | null;
  event_type: "exam" | "class" | "reminder" | "other";
}

export interface FeeRecord {
  id: string;
  student_id: string;
  fee_month: string; // YYYY-MM
  amount: number;
  status: "paid" | "pending";
  paid_date: string | null;
  notes: string | null;
  month?: string | null;
  year?: number | null;
}

export interface Homework {
  id: string;
  student_id: string;
  subject: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "assigned" | "completed" | "incomplete";
  attachment_name?: string | null;
  attachment_url?: string | null;
  created_at: string;
}

export interface SyllabusAttachment {
  id: string;
  checklist_item_id?: string | null;
  chapter_note_id?: string | null;
  filename: string;
  stored_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  chapter_id: string;
  text: string;
  completed: boolean;
  order: number;
  created_at: string;
  updated_at: string;
  attachments?: SyllabusAttachment[];
}

export interface ChapterNote {
  id: string;
  chapter_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  attachments?: SyllabusAttachment[];
}

export interface SyllabusChapter {
  id: string;
  syllabus_id: string;
  title: string;
  order: number;
  created_at: string;
  updated_at: string;
  checklist_items?: ChecklistItem[];
  notes?: ChapterNote[];
}

export interface Syllabus {
  id: string;
  student_id: string;
  subject: string;
  chapter: string;
  chapter_type?: string | null;
  term?: string | null;
  status: "pending" | "teaching" | "revision" | "completed";
  progress: number; // 0 to 100
  sort_order: number;
  chapters?: SyllabusChapter[];
}

export interface Test {
  id: string;
  student_id: string;
  subject: string;
  exam_name: string;
  exam_type: "school" | "tuition";
  max_marks: number;
  obtained_marks: number;
  remarks: string | null;
  exam_date: string | null;
  question_paper_name?: string | null;
  question_paper_url?: string | null;
  answer_paper_name?: string | null;
  answer_paper_url?: string | null;
  created_at: string;
}

export interface CalendarDayData {
  date: string;
  attendance: Attendance | null;
  daily_plan: DailyPlan | null;
  homework: Homework[];
  events: CalendarEvent[];
  fee_status: "paid" | "pending" | null;
  is_birthday?: boolean;
}

export interface CalendarMonthResponse {
  year: number;
  month: number;
  days: Record<string, CalendarDayData>;
  month_fee_status?: "paid" | "pending" | null;
  month_paid_date?: string | null;
  month_fee_amount?: number | null;
  fee_due_day?: number | null;
}

export interface SyllabusDocument {
  id: string;
  student_id: string;
  file_name: string;
  extracted_text: string | null;
  uploaded_at: string;
}

export interface SyllabusUploadResponse {
  document: SyllabusDocument;
  extracted_chapters: { subject: string; chapter: string }[];
}

export interface Recommendation {
  id: string;
  student_id: string;
  file_name: string;
  extracted_text: string | null;
  uploaded_at: string;
}

export interface AIPlan {
  id: string;
  student_id: string;
  plan_date: string;
  generated_plan: string | null;
  edited_plan: string | null;
  prompt_used: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  teacher_id: string;
  title: string;
  message: string | null;
  channel: string;
  created_at: string;
}

// ─── API Methods ────────────────────────────────────────

export const academicApi = {
  // Calendar aggregation
  getCalendarMonth: (studentId: string, year: number, month: number) =>
    api.get<CalendarMonthResponse>(`/students/${studentId}/calendar`, {
      params: { year, month },
    }),

  // Attendance
  markAttendance: (studentId: string, date: string, status: "present" | "absent" | "leave") =>
    api.post<Attendance>(`/students/${studentId}/attendance`, { date, status }),

  removeAttendance: (studentId: string, date: string) =>
    api.delete(`/students/${studentId}/attendance`, { params: { attendance_date: date } }),

  // Daily Plans
  saveDailyPlan: (studentId: string, date: string, topics_to_teach?: string, notes?: string) =>
    api.post<DailyPlan>(`/students/${studentId}/daily-plans`, { date, topics_to_teach, notes }),

  // Calendar Events
  addEvent: (studentId: string, data: { event_date: string; title: string; description?: string; event_type: string }) =>
    api.post<CalendarEvent>(`/students/${studentId}/events`, data),

  updateEvent: (studentId: string, eventId: string, data: Partial<CalendarEvent>) =>
    api.put<CalendarEvent>(`/students/${studentId}/events/${eventId}`, data),

  deleteEvent: (studentId: string, eventId: string) =>
    api.delete(`/students/${studentId}/events/${eventId}`),

  // Fee Records
  toggleFee: (studentId: string, data: { fee_month: string; status: "paid" | "pending"; paid_date?: string; amount?: number }) =>
    api.post<FeeRecord>(`/students/${studentId}/fees/toggle`, data),

  addFee: (studentId: string, data: { fee_month: string; amount: number; status: string; paid_date?: string; notes?: string; month?: string; year?: number }) =>
    api.post<FeeRecord>(`/students/${studentId}/fees`, data),

  updateFee: (studentId: string, feeId: string, data: Partial<FeeRecord>) =>
    api.put<FeeRecord>(`/students/${studentId}/fees/${feeId}`, data),

  getFees: (studentId: string, year?: number) =>
    api.get<FeeRecord[]>(`/students/${studentId}/fees`, { params: { year } }),

  // Homework
  addHomework: (studentId: string, data: { subject: string; title: string; description?: string; due_date?: string; status: string; attachment_name?: string; attachment_url?: string }) =>
    api.post<Homework>(`/students/${studentId}/homework`, data),

  updateHomework: (studentId: string, hwId: string, data: Partial<Homework>) =>
    api.put<Homework>(`/students/${studentId}/homework/${hwId}`, data),

  deleteHomework: (studentId: string, hwId: string) =>
    api.delete(`/students/${studentId}/homework/${hwId}`),

  getHomeworkList: (studentId: string) =>
    api.get<Homework[]>(`/students/${studentId}/homework`),

  // Syllabus
  addSyllabus: (studentId: string, data: { subject: string; chapter: string; chapter_type?: string | null; term?: string | null; status: string; progress: number; sort_order?: number }) =>
    api.post<Syllabus>(`/students/${studentId}/syllabus`, data),

  updateSyllabus: (studentId: string, syllabusId: string, data: Partial<Syllabus>) =>
    api.put<Syllabus>(`/students/${studentId}/syllabus/${syllabusId}`, data),

  deleteSyllabus: (studentId: string, syllabusId: string) =>
    api.delete(`/students/${studentId}/syllabus/${syllabusId}`),

  getSyllabusList: (studentId: string) =>
    api.get<Syllabus[]>(`/students/${studentId}/syllabus`),

  // Syllabus Chapters
  createSyllabusChapter: (studentId: string, syllabusId: string, data: { title: string; order?: number }) =>
    api.post<SyllabusChapter>(`/students/${studentId}/syllabus/${syllabusId}/chapters`, data),

  updateSyllabusChapter: (studentId: string, chapterId: string, data: { title?: string; order?: number }) =>
    api.put<SyllabusChapter>(`/students/${studentId}/syllabus/chapters/${chapterId}`, data),

  deleteSyllabusChapter: (studentId: string, chapterId: string) =>
    api.delete(`/students/${studentId}/syllabus/chapters/${chapterId}`),

  // Checklist Items
  createChecklistItem: (studentId: string, chapterId: string, data: { text: string; completed?: boolean; order?: number }) =>
    api.post<ChecklistItem>(`/students/${studentId}/syllabus/chapters/${chapterId}/items`, data),

  updateChecklistItem: (studentId: string, itemId: string, data: { text?: string; completed?: boolean; order?: number }) =>
    api.put<ChecklistItem>(`/students/${studentId}/syllabus/items/${itemId}`, data),

  deleteChecklistItem: (studentId: string, itemId: string) =>
    api.delete(`/students/${studentId}/syllabus/items/${itemId}`),

  // Chapter Notes
  createChapterNote: (studentId: string, chapterId: string, data: { text: string }) =>
    api.post<ChapterNote>(`/students/${studentId}/syllabus/chapters/${chapterId}/notes`, data),

  updateChapterNote: (studentId: string, noteId: string, data: { text: string }) =>
    api.put<ChapterNote>(`/students/${studentId}/syllabus/notes/${noteId}`, data),

  deleteChapterNote: (studentId: string, noteId: string) =>
    api.delete(`/students/${studentId}/syllabus/notes/${noteId}`),

  // Syllabus Attachments
  uploadSyllabusAttachment: (studentId: string, file: File, params?: { checklist_item_id?: string; chapter_note_id?: string }) => {
    const formData = new FormData();
    formData.append("file", file);
    let url = `/students/${studentId}/syllabus/attachments`;
    const qp: string[] = [];
    if (params?.checklist_item_id) qp.push(`checklist_item_id=${params.checklist_item_id}`);
    if (params?.chapter_note_id) qp.push(`chapter_note_id=${params.chapter_note_id}`);
    if (qp.length > 0) url += `?${qp.join("&")}`;
    return api.post<SyllabusAttachment>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  deleteSyllabusAttachment: (studentId: string, attachmentId: string) =>
    api.delete(`/students/${studentId}/syllabus/attachments/${attachmentId}`),

  // Syllabus Documents (Phase 5)
  uploadSyllabusDocument: (studentId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<SyllabusUploadResponse>(`/students/${studentId}/syllabus/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getSyllabusDocuments: (studentId: string) =>
    api.get<SyllabusDocument[]>(`/students/${studentId}/syllabus/documents`),

  // Tests
  addTest: (
    studentId: string,
    data: {
      subject: string;
      exam_name: string;
      exam_type: string;
      max_marks: number;
      obtained_marks: number;
      remarks?: string;
      exam_date?: string;
      question_paper_name?: string;
      question_paper_url?: string;
      answer_paper_name?: string;
      answer_paper_url?: string;
    }
  ) => api.post<Test>(`/students/${studentId}/tests`, data),

  updateTest: (studentId: string, testId: string, data: Partial<Test>) =>
    api.put<Test>(`/students/${studentId}/tests/${testId}`, data),

  deleteTest: (studentId: string, testId: string) =>
    api.delete(`/students/${studentId}/tests/${testId}`),

  getTests: (studentId: string) =>
    api.get<Test[]>(`/students/${studentId}/tests`),

  // Recommendations (Phase 6)
  uploadRecommendation: (studentId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<Recommendation>(`/students/${studentId}/recommendations/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getRecommendations: (studentId: string) =>
    api.get<Recommendation[]>(`/students/${studentId}/recommendations`),

  // AI Plans (Phase 6)
  generateAIPlan: (studentId: string, customInstructions?: string) =>
    api.post<AIPlan>(`/students/${studentId}/ai/generate`, { custom_instructions: customInstructions }),

  getAIPlans: (studentId: string) =>
    api.get<AIPlan[]>(`/students/${studentId}/ai/plans`),

  saveAIPlan: (studentId: string, planId: string, editedPlan: string) =>
    api.put<AIPlan>(`/students/${studentId}/ai/plans/${planId}`, { edited_plan: editedPlan }),

  // Announcements (Phase 8)
  createAnnouncement: (data: { title: string; message?: string }) =>
    api.post<Announcement>("/announcements", data),

  getAnnouncements: () =>
    api.get<Announcement[]>("/announcements"),

  deleteAnnouncement: (announcementId: string) =>
    api.delete(`/announcements/${announcementId}`),
};

