import axios from "axios";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005").replace(/\/+$/, "");

export const getFileUrl = (storedPath: string): string => {
  if (!storedPath) return "";
  if (storedPath.startsWith("http://") || storedPath.startsWith("https://") || storedPath.startsWith("data:")) {
    return storedPath;
  }
  const cleanPath = storedPath.startsWith("/") ? storedPath : `/${storedPath}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth API ───────────────────────────────────────────

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: "student";
  teacher_ids: string[];
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "teacher" | "student";
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  email: string;
  otp: string;
  new_password: string;
}

export interface AvailableTeacher {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

export interface AssignedTeacherInfo {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface AdminTeacher {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  student_count: number;
}

export interface CreateTeacherData {
  email: string;
  password: string;
  full_name: string;
}

export interface UpdateTeacherData {
  full_name?: string;
  email?: string;
  is_active?: boolean;
}

export interface AdminStudent {
  id: string;
  user_id?: string | null;
  email?: string | null;
  name: string;
  phone?: string | null;
  parent_phone?: string | null;
  class_grade?: string | null;
  board?: string | null;
  notes?: string | null;
  is_active: boolean;
  teacher_id?: string | null;
  teacher_name?: string | null;
  assigned_teachers: AssignedTeacherInfo[];
  created_at: string;
}

export interface UpdateStudentData {
  name?: string;
  email?: string;
  phone?: string;
  parent_phone?: string;
  class_grade?: string;
  board?: string;
  notes?: string;
  is_active?: boolean;
}

export const authApi = {
  register: (data: RegisterData) =>
    api.post<User>("/auth/register", data),

  login: (data: LoginData) =>
    api.post<TokenResponse>("/auth/login", data),

  me: () =>
    api.get<User>("/auth/me"),

  forgotPassword: (data: ForgotPasswordData) =>
    api.post<{ message: string }>("/auth/forgot-password", data),

  resetPassword: (data: ResetPasswordData) =>
    api.post<{ message: string }>("/auth/reset-password", data),
};

export const teachersApi = {
  getAvailable: () =>
    api.get<AvailableTeacher[]>("/teachers/available"),
};

export interface LastBackupInfo {
  created_at: string;
  backup_type: string;
  file_size_bytes: number;
  admin_id?: string | null;
  total_records: number;
  files_count: number;
}

export interface BackupStats {
  total_records: number;
  total_files: number;
  estimated_size_bytes: number;
  last_backup_generated: LastBackupInfo | null;
  tables_summary: Record<string, number>;
  schema_revision?: string | null;
  environment: string;
  database_type: string;
  file_storage: string;
}

export interface SchemaCompatibility {
  status: "fully_compatible" | "partially_compatible";
  matching_tables_count: number;
  missing_tables_count: number;
  extra_tables_count: number;
  missing_tables: string[];
  extra_tables: string[];
}

export interface RestorePreviewResponse {
  session_id: string;
  is_valid: boolean;
  errors: string[];
  created_at?: string | null;
  backup_version?: number | null;
  source_environment?: string | null;
  source_database_type?: string | null;
  tables_count: number;
  total_records: number;
  files_count: number;
  estimated_size_bytes: number;
  integrity_status: string;
  schema_compatibility: SchemaCompatibility | Record<string, any>;
  records_to_insert: number;
  records_to_update: number;
  records_unchanged: number;
  conflicts: string[];
  files_to_restore: number;
  files_to_replace: number;
}

export interface ExecuteRestoreRequest {
  session_id: string;
  mode: "merge" | "replace";
  confirmation?: string;
}

export interface ExecuteRestoreResponse {
  success: boolean;
  mode: string;
  records_restored: number;
  files_restored: number;
  safety_backup_path?: string | null;
  message: string;
}

export const adminApi = {
  getTeachers: () =>
    api.get<AdminTeacher[]>("/admin/teachers"),

  createTeacher: (data: CreateTeacherData) =>
    api.post<AdminTeacher>("/admin/teachers", data),

  updateTeacher: (teacherId: string, data: UpdateTeacherData) =>
    api.put<AdminTeacher>(`/admin/teachers/${teacherId}`, data),

  updateTeacherStatus: (teacherId: string, isActive: boolean) =>
    api.patch<AdminTeacher>(`/admin/teachers/${teacherId}/status`, { is_active: isActive }),

  deleteTeacher: (teacherId: string) =>
    api.delete<{ message: string; id: string }>(`/admin/teachers/${teacherId}`),

  resetTeacherPassword: (teacherId: string, newPassword: string) =>
    api.post<{ message: string }>(
      `/admin/teachers/${teacherId}/reset-password`,
      { new_password: newPassword }
    ),

  resetUserPassword: (userId: string, newPassword: string) =>
    api.post<{ message: string; email: string; full_name: string }>(
      `/admin/users/${userId}/reset-password`,
      { new_password: newPassword }
    ),

  getStudents: (params?: {
    search?: string;
    class_grade?: string;
    board?: string;
    is_active?: boolean;
  }) =>
    api.get<AdminStudent[]>("/admin/students", { params }),

  updateStudent: (studentId: string, data: UpdateStudentData) =>
    api.put<AdminStudent>(`/admin/students/${studentId}`, data),

  updateStudentStatus: (studentId: string, isActive: boolean) =>
    api.patch<AdminStudent>(`/admin/students/${studentId}/status`, { is_active: isActive }),

  deleteStudent: (studentId: string) =>
    api.delete<{ message: string; id: string }>(`/admin/students/${studentId}`),

  resetStudentPassword: (studentId: string, newPassword: string) =>
    api.post<{ message: string }>(
      `/admin/students/${studentId}/reset-password`,
      { new_password: newPassword }
    ),

  getStudentTeachers: (studentId: string) =>
    api.get<AssignedTeacherInfo[]>(`/admin/students/${studentId}/teachers`),

  addStudentTeacher: (studentId: string, teacherId: string) =>
    api.post<AssignedTeacherInfo[]>(`/admin/students/${studentId}/teachers/${teacherId}`),

  removeStudentTeacher: (studentId: string, teacherId: string) =>
    api.delete<AssignedTeacherInfo[]>(`/admin/students/${studentId}/teachers/${teacherId}`),

  getBackupStats: () =>
    api.get<BackupStats>("/admin/backup/stats"),

  downloadBackup: async (type: "full" | "database" | "files" = "full") => {
    const response = await api.get(`/admin/backup/download?type=${type}`, {
      responseType: "blob",
    });

    let filename = `StudyVerse_Backup_${type}.zip`;
    const disposition = response.headers["content-disposition"];
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = new Blob([response.data], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  uploadBackupPreview: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<RestorePreviewResponse>("/admin/backup/upload-preview", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  executeRestore: (data: ExecuteRestoreRequest) =>
    api.post<ExecuteRestoreResponse>("/admin/backup/execute-restore", data),
};




