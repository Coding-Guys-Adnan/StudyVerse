"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi, teachersApi, type AvailableTeacher } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  User,
  Mail,
  Lock,
  Check,
  Shield,
  UserCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type Mode = "select" | "login" | "register" | "forgot" | "reset";
type Role = "teacher" | "student" | "admin";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("select");
  const [role, setRole] = useState<Role>("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Teacher selection state for registration
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  useEffect(() => {
    if (mode === "register") {
      setLoadingTeachers(true);
      teachersApi
        .getAvailable()
        .then((res) => {
          setAvailableTeachers(res.data);
          if (res.data.length > 0 && selectedTeacherIds.length === 0) {
            setSelectedTeacherIds([res.data[0].id]);
          }
        })
        .catch(() => {
          setError("Failed to load available teachers. Please try again.");
        })
        .finally(() => setLoadingTeachers(false));
    }
  }, [mode]);

  const handleSelectRole = (selectedRole: Role) => {
    setRole(selectedRole);
    setMode("login");
    setError("");
  };

  const toggleTeacherSelection = (teacherId: string) => {
    setSelectedTeacherIds((prev) => {
      if (prev.includes(teacherId)) {
        if (prev.length === 1) return prev; // keep at least 1 selected
        return prev.filter((id) => id !== teacherId);
      } else {
        return [...prev, teacherId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        if (selectedTeacherIds.length === 0) {
          setError("Please select at least one teacher to complete registration.");
          setIsSubmitting(false);
          return;
        }
        await register({
          email,
          password,
          full_name: fullName,
          role: "student",
          teacher_ids: selectedTeacherIds,
        });
      } else if (mode === "login") {
        await login({ email, password });
      } else if (mode === "forgot") {
        const res = await authApi.forgotPassword({ email });
        setSuccessMessage(res.data.message || "OTP has been sent to your email.");
        setMode("reset");
      } else if (mode === "reset") {
        const res = await authApi.resetPassword({ email, otp, new_password: password });
        setSuccessMessage(res.data.message || "Password reset successfully!");
        setMode("login");
        setPassword("");
        setOtp("");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(
        axiosError.response?.data?.detail || "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--login-bg);
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .login-theme-corner {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 10;
        }

        .login-container {
          width: 100%;
          max-width: 460px;
          position: relative;
          z-index: 1;
        }

        .login-brand {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-brand-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.25);
        }

        .login-brand h1 {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .login-brand p {
          color: var(--text-secondary);
          font-size: 15px;
          margin-top: 6px;
        }

        .login-card {
          background: var(--card-bg);
          border-radius: var(--radius-lg, 16px);
          padding: 36px;
          box-shadow: var(--shadow-xl);
          border: 1px solid var(--border-color);
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 24px 18px;
          }
          .role-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .role-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .role-card {
          padding: 20px 12px;
          border-radius: var(--radius, 12px);
          border: 2px solid var(--border-color);
          background: var(--bg-tertiary);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .role-card:hover {
          border-color: var(--brand-300);
          background: var(--brand-50);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .role-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .role-card-icon.teacher {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #2563eb;
        }

        .role-card-icon.student {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          color: #059669;
        }

        .role-card-icon.admin {
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          color: #d97706;
        }

        .role-card h3 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .form-input-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
        }

        .form-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
          z-index: 2;
        }

        .form-input {
          width: 100% !important;
          padding: 12px 14px 12px 42px !important;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm, 8px);
          font-size: 14px;
          color: var(--text-primary);
          background: var(--card-bg);
          transition: all 0.15s ease;
          font-family: inherit;
          outline: none;
        }

        .form-input.has-password-toggle {
          padding-right: 44px !important;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--brand-400);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .password-toggle:hover {
          color: var(--text-primary);
        }

        .teacher-select-box {
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm, 8px);
          padding: 12px;
          background: var(--bg-tertiary);
          max-height: 180px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .teacher-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--card-bg);
          border: 1.5px solid var(--border-color);
          cursor: pointer;
          transition: all 0.15s ease;
          color: var(--text-primary);
        }

        .teacher-item:hover {
          border-color: var(--brand-300);
          background: var(--bg-tertiary);
        }

        .teacher-item.selected {
          border-color: #10b981;
          background: var(--success-light);
        }

        .teacher-item.selected p {
          color: var(--text-primary);
        }

        .teacher-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          background: var(--card-bg);
        }

        .teacher-item.selected .teacher-checkbox {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }

        .submit-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
          color: white;
          border: none;
          border-radius: var(--radius-sm, 8px);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
          margin-top: 8px;
        }

        .submit-btn:hover:not(:disabled) {
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-msg {
          background: var(--danger-light, #fef2f2);
          color: var(--danger, #ef4444);
          padding: 10px 14px;
          border-radius: var(--radius-sm, 8px);
          font-size: 13px;
          margin-bottom: 20px;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }

        .success-msg {
          background: #ecfdf5;
          color: #065f46;
          padding: 10px 14px;
          border-radius: var(--radius-sm, 8px);
          font-size: 13px;
          margin-bottom: 20px;
          border: 1px solid rgba(16, 185, 129, 0.15);
        }

        .form-footer {
          text-align: center;
          margin-top: 20px;
          font-size: 13px;
          color: var(--gray-500);
        }

        .form-footer button {
          color: var(--brand-600);
          font-weight: 600;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
        }

        .form-footer button:hover {
          text-decoration: underline;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--gray-500);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          margin-bottom: 20px;
          font-family: inherit;
          font-weight: 500;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
          margin-bottom: 20px;
        }

        .role-badge.teacher { background: #dbeafe; color: #2563eb; }
        .role-badge.student { background: #d1fae5; color: #059669; }
        .role-badge.admin { background: #fef3c7; color: #d97706; }

        @keyframes spinner {
          to { transform: rotate(360deg); }
        }

        .btn-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
      `}</style>

      <div className="login-theme-corner">
        <ThemeToggle variant="dropdown" />
      </div>

      <div className="login-container">
        {/* Brand */}
        <motion.div
          className="login-brand"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="login-brand-icon">
            <Sparkles size={28} color="white" />
          </div>
          <h1>StudyVerse</h1>
          <p>Tuition & Academic Assistant</p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {mode === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  Welcome back
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
                  Choose your portal to sign in
                </p>

                <div className="role-grid">
                  <button className="role-card" onClick={() => handleSelectRole("teacher")} id="role-teacher">
                    <div className="role-card-icon teacher">
                      <BookOpen size={20} />
                    </div>
                    <h3>Teacher</h3>
                  </button>
                  <button className="role-card" onClick={() => handleSelectRole("student")} id="role-student">
                    <div className="role-card-icon student">
                      <GraduationCap size={20} />
                    </div>
                    <h3>Student</h3>
                  </button>
                  <button className="role-card" onClick={() => handleSelectRole("admin")} id="role-admin">
                    <div className="role-card-icon admin">
                      <Shield size={20} />
                    </div>
                    <h3>Admin</h3>
                  </button>
                </div>
              </motion.div>
            )}

            {(mode === "login" || mode === "register" || mode === "forgot" || mode === "reset") && (
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  className="back-btn"
                  onClick={() => {
                    if (mode === "reset") setMode("forgot");
                    else if (mode === "forgot") setMode("login");
                    else setMode("select");
                    setError("");
                    setSuccessMessage("");
                  }}
                >
                  {mode === "reset" ? "← Change details" : mode === "forgot" ? "← Back to Sign In" : "← Change portal"}
                </button>

                <div className={`role-badge ${mode === "register" ? "student" : role}`}>
                  {role === "admin" ? <Shield size={14} /> : role === "teacher" ? <BookOpen size={14} /> : <GraduationCap size={14} />}
                  {mode === "register" ? "Student Join" : role}
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  {mode === "login" && `Sign in as ${role}`}
                  {mode === "register" && "Join StudyVerse"}
                  {mode === "forgot" && "Forgot password"}
                  {mode === "reset" && "Reset password"}
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
                  {mode === "login" && "Enter your credentials to continue"}
                  {mode === "register" && "Create your student account and select your teacher(s)"}
                  {mode === "forgot" && "Enter your email to receive a password reset OTP"}
                  {mode === "reset" && "Enter your OTP and new password"}
                </p>

                {error && <div className="error-msg">{error}</div>}
                {successMessage && <div className="success-msg">{successMessage}</div>}

                <form onSubmit={handleSubmit}>
                  {mode === "register" && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="fullName">Full Name *</label>
                      <div className="form-input-wrapper">
                        <User size={16} className="form-input-icon" />
                        <input
                          id="fullName"
                          type="text"
                          className="form-input"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="email">Email Address *</label>
                    <div className="form-input-wrapper">
                      <Mail size={16} className="form-input-icon" />
                      <input
                        id="email"
                        type="email"
                        className="form-input"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={mode === "reset"}
                      />
                    </div>
                  </div>

                  {mode === "reset" && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="otp">One-Time Password (OTP)</label>
                      <div className="form-input-wrapper">
                        <Lock size={16} className="form-input-icon" />
                        <input
                          id="otp"
                          type="text"
                          className="form-input"
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          required
                          maxLength={6}
                        />
                      </div>
                    </div>
                  )}

                  {(mode === "login" || mode === "register" || mode === "reset") && (
                    <div className="form-group">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label className="form-label" htmlFor="password" style={{ margin: 0 }}>
                          {mode === "reset" ? "New Password *" : "Password *"}
                        </label>
                        {mode === "login" && (
                          <button
                            type="button"
                            onClick={() => { setMode("forgot"); setError(""); setSuccessMessage(""); }}
                            style={{ fontSize: 12, color: "var(--brand-600)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="form-input-wrapper">
                        <Lock size={16} className="form-input-icon" />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          className="form-input has-password-toggle"
                          placeholder={mode === "reset" ? "Enter new password" : "Enter your password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─── Teacher Selection for Registration ─── */}
                  {mode === "register" && (
                    <div className="form-group">
                      <label className="form-label">Select Your Teacher(s) *</label>
                      {loadingTeachers ? (
                        <div style={{ padding: "16px", textAlign: "center", color: "var(--gray-400)", fontSize: 13 }}>
                          Loading available teachers...
                        </div>
                      ) : availableTeachers.length > 0 ? (
                        <div className="teacher-select-box">
                          {availableTeachers.map((teacher) => {
                            const isSelected = selectedTeacherIds.includes(teacher.id);
                            return (
                              <div
                                key={teacher.id}
                                className={`teacher-item ${isSelected ? "selected" : ""}`}
                                onClick={() => toggleTeacherSelection(teacher.id)}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#dbeafe", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <UserCheck size={14} />
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-800)", margin: 0 }}>
                                      {teacher.full_name}
                                    </p>
                                  </div>
                                </div>
                                <div className="teacher-checkbox">
                                  {isSelected && <Check size={12} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: "16px", textAlign: "center", color: "#b91c1c", background: "#fef2f2", borderRadius: 8, fontSize: 13 }}>
                          No active teachers currently available for enrollment.
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={isSubmitting || (mode === "register" && (loadingTeachers || availableTeachers.length === 0))}
                    id="submit-login"
                  >
                    {isSubmitting ? (
                      <div className="btn-spinner" />
                    ) : (
                      <>
                        {mode === "login" && `Sign In as ${role}`}
                        {mode === "register" && "Complete Registration"}
                        {mode === "forgot" && "Send OTP"}
                        {mode === "reset" && "Reset Password"}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <div className="form-footer">
                  {mode === "login" && (
                    <p>
                      Are you a student?{" "}
                      <button onClick={() => { setRole("student"); setMode("register"); setError(""); setSuccessMessage(""); }}>
                        Create student account
                      </button>
                    </p>
                  )}
                  {mode === "register" && (
                    <p>
                      Already have an account?{" "}
                      <button onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}>
                        Sign in
                      </button>
                    </p>
                  )}
                  {mode === "forgot" && (
                    <p>
                      Remembered password?{" "}
                      <button onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}>
                        Sign in
                      </button>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
