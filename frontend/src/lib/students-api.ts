import api from "./api";

// ─── Types ──────────────────────────────────────────────

export interface Student {
  id: string;
  teacher_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  parent_phone: string | null;
  class_grade: string | null;
  board: string | null;
  date_of_birth: string | null;
  notes: string | null;
  avatar_url: string | null;
  monthly_fees: number | null;
  fee_due_day: number | null;
  created_at: string;
}

export interface StudentCreate {
  name: string;
  email?: string;
  phone?: string;
  parent_phone?: string;
  class_grade?: string;
  board?: string;
  date_of_birth?: string;
  notes?: string;
  monthly_fees?: number | null;
  fee_due_day?: number | null;
}

export interface StudentUpdate {
  name?: string;
  email?: string;
  phone?: string;
  parent_phone?: string;
  class_grade?: string;
  board?: string;
  date_of_birth?: string;
  notes?: string;
  monthly_fees?: number | null;
  fee_due_day?: number | null;
}

export interface StudentListResponse {
  students: Student[];
  total: number;
}

export interface DashboardStats {
  total_students: number;
  today_classes: number;
  homework_pending: number;
  ai_plans_generated: number;
}

// ─── API ────────────────────────────────────────────────

export const studentsApi = {
  list: (params?: { search?: string; class_grade?: string }) =>
    api.get<StudentListResponse>("/students", { params }),

  get: (id: string) => api.get<Student>(`/students/${id}`),

  create: (data: StudentCreate) =>
    api.post<Student>("/students", data),

  update: (id: string, data: StudentUpdate) =>
    api.put<Student>(`/students/${id}`, data),

  delete: (id: string) => api.delete(`/students/${id}`),

  dashboardStats: () => api.get<DashboardStats>("/dashboard/stats"),
};
