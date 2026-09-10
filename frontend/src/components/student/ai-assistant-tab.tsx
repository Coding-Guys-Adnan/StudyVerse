"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  BrainCircuit,
  RefreshCw,
  Save,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  MessageSquare,
  Bot,
  Send,
  AlertTriangle,
  RotateCcw,
  Zap,
  CheckCircle2,
  Info,
  Printer,
  FileDown,
  Paperclip,
  X,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { academicApi, type AIPlan, type AIChatMessage } from "@/lib/academic-api";
import { PlanPDFPreviewModal } from "./plan-pdf-preview-modal";
import { useAuth } from "@/lib/auth-context";

interface AIAssistantTabProps {
  studentId: string;
  studentName?: string;
}

function formatPlanDateTime(dateStr: string) {
  try {
    const s =
      dateStr.includes("Z") || dateStr.includes("+")
        ? dateStr
        : dateStr + "Z";
    const d = new Date(s);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeFormatted = d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateFormatted} at ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

export function AIAssistantTab({ studentId, studentName }: AIAssistantTabProps) {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"planner" | "chat">("planner");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<AIPlan | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [quotaNotice, setQuotaNotice] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfModalPlan, setPdfModalPlan] = useState<AIPlan | null>(null);

  // ─── Chat State ──────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
    {
      role: "assistant",
      content: `Hello! 🌟 I'm your AI Teaching Consultant. Ask me anything about lesson planning, curriculum topics, breaking down tricky concepts for ${studentName || "your student"}, or managing learning strategies!`,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatAttachment, setChatAttachment] = useState<{
    file: File;
    name: string;
    type: string;
    previewUrl: string | null;
    base64Data: string;
  } | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (studentName) {
      setChatMessages((prev) => {
        if (prev.length === 1 && prev[0].role === "assistant") {
          return [
            {
              role: "assistant",
              content: `Hello! 🌟 I'm your AI Teaching Consultant. Ask me anything about lesson planning, curriculum topics, breaking down tricky concepts for ${studentName}, or managing learning strategies!`,
            },
          ];
        }
        return prev;
      });
    }
  }, [studentName]);

  // ─── Queries ─────────────────────────────────────────────
  const { data: plans = [], refetch: refetchPlans } = useQuery({
    queryKey: ["ai-plans", studentId],
    queryFn: () => academicApi.getAIPlans(studentId),
    select: (res) => res.data,
  });

  const { data: recommendations = [], refetch: refetchRecs } = useQuery({
    queryKey: ["recommendations", studentId],
    queryFn: () => academicApi.getRecommendations(studentId),
    select: (res) => res.data,
  });

  const {
    data: quotaStatus,
    refetch: refetchQuota,
    isFetching: isCheckingQuota,
  } = useQuery({
    queryKey: ["ai-quota", studentId],
    queryFn: () => academicApi.getAIQuotaStatus(studentId),
    select: (res) => res.data,
  });

  // ─── Plan Mutations ──────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: (customInstructions?: string) =>
      academicApi.generateAIPlan(studentId, customInstructions),
    onMutate: () => {
      setGenerating(true);
      setIsSaved(false);
      setGenerateError("");
    },
    onSuccess: (res) => {
      setActivePlan(res.data);
      refetchPlans();
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      if (res.data.quota_exceeded) {
        setQuotaNotice(
          res.data.quota_notice ||
            "⚠️ Gemini API Quota reached. Plan generated using the Smart Fallback Assistant. A reminder has been added to the calendar."
        );
      }
    },
    onError: (err: any) => {
      setGenerateError(err.response?.data?.detail || "Failed to generate AI study plan");
    },
    onSettled: () => {
      setGenerating(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ planId, editedPlan }: { planId: string; editedPlan: string }) =>
      academicApi.saveAIPlan(studentId, planId, editedPlan),
    onSuccess: (res) => {
      setIsSaved(true);
      setActivePlan(res.data);
      refetchPlans();
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => academicApi.deleteAIPlan(studentId, planId),
    onMutate: (planId) => {
      setDeletingPlanId(planId);
    },
    onSuccess: (_, planId) => {
      if (activePlan?.id === planId) {
        setActivePlan(null);
        setIsSaved(false);
      }
      refetchPlans();
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to delete lesson plan.");
    },
    onSettled: () => {
      setDeletingPlanId(null);
    },
  });

  const clearPlansMutation = useMutation({
    mutationFn: () => academicApi.clearAIPlans(studentId),
    onSuccess: () => {
      setActivePlan(null);
      setIsSaved(false);
      refetchPlans();
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to clear plan history.");
    },
  });

  const handleDeletePlan = (planId: string) => {
    if (!isTeacher) return;
    if (window.confirm("Are you sure you want to delete this lesson plan from history?")) {
      deletePlanMutation.mutate(planId);
    }
  };

  const handleClearAllPlans = () => {
    if (!isTeacher) return;
    if (
      window.confirm(
        "Are you sure you want to delete ALL lesson plan history for this student? This action cannot be undone."
      )
    ) {
      clearPlansMutation.mutate();
    }
  };

  // ─── Chat Mutation ───────────────────────────────────────
  const chatMutation = useMutation({
    mutationFn: ({
      msg,
      attachment,
    }: {
      msg: string;
      attachment?: { file_data?: string; file_name?: string; mime_type?: string };
    }) => academicApi.sendAIChat(studentId, msg, chatMessages, attachment),
    onSuccess: (res) => {
      const reply = res.data.response;
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (res.data.quota_exceeded) {
        setQuotaNotice(
          res.data.quota_notice ||
            "⚠️ Gemini API quota limit reached. The AI consultant is running in smart offline mode."
        );
      }
    },
    onError: () => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "⚠️ Sorry, I could not complete that request right now. Please check your network or try again.",
        },
      ]);
    },
    onSettled: () => {
      setChatSending(false);
    },
  });

  const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = reader.result as string;
      const base64Data = base64Str.split(",")[1];
      setChatAttachment({
        file,
        name: file.name,
        type: file.type || "application/octet-stream",
        previewUrl: file.type.startsWith("image/") ? base64Str : null,
        base64Data,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSendChat = (presetText?: string) => {
    const textToSend = (presetText || chatInput).trim();
    if ((!textToSend && !chatAttachment) || chatSending) return;

    const attachmentPayload = chatAttachment
      ? {
          file_data: chatAttachment.base64Data,
          file_name: chatAttachment.name,
          mime_type: chatAttachment.type,
        }
      : undefined;

    const userMsg: AIChatMessage = {
      role: "user",
      content: textToSend || `[Sent attachment: ${chatAttachment?.name}]`,
      attachment_name: chatAttachment?.name,
      attachment_type: chatAttachment?.type,
      attachment_data:
        chatAttachment?.previewUrl ||
        (chatAttachment?.base64Data
          ? `data:${chatAttachment.type};base64,${chatAttachment.base64Data}`
          : undefined),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    const prevAttachment = chatAttachment;
    setChatAttachment(null);
    setChatSending(true);

    chatMutation.mutate({
      msg:
        textToSend ||
        `Please review this attached file (${prevAttachment?.name}) and provide your pedagogical recommendations.`,
      attachment: attachmentPayload,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");
    try {
      await academicApi.uploadRecommendation(studentId, file);
      refetchRecs();
    } catch (err: any) {
      setUploadError(
        err.response?.data?.detail || "Failed to upload recommendation document."
      );
    } finally {
      setUploading(false);
    }
  };

  const sampleQuestions = [
    `How to engage ${studentName || "the student"} effectively during sessions?`,
    "Give 5 fun interactive practice problems for today",
    "Explain tricky concepts with a quick real-world game",
    "Create 3 oral quiz questions to test comprehension",
  ];

  return (
    <div className="ai-assistant-wrapper">
      <style>{`
        .ai-assistant-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Top Nav & Quota Bar */
        .ai-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 12px 18px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .ai-tabs-nav {
          display: flex;
          gap: 8px;
        }

        .ai-nav-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-nav-btn:hover {
          background: var(--border-color);
          color: var(--text-primary);
        }

        .ai-nav-btn.active {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
        }

        .quota-status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 100px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .quota-status-pill:hover {
          border-color: #8b5cf6;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.active {
          background: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
        }

        .status-dot.warning {
          background: #f59e0b;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
        }

        .status-dot.error {
          background: #ef4444;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
        }

        /* Quota Alert Banner */
        .quota-alert-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: linear-gradient(135deg, #fffbeb, #fef3c7);
          border: 1px solid #fde68a;
          border-radius: var(--radius);
          color: #92400e;
          font-size: 13px;
          gap: 12px;
        }

        /* Two column layout for planner */
        .ai-tab-content {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        @media (min-width: 768px) {
          .ai-tab-content {
            grid-template-columns: 2fr 1fr;
          }
        }

        .ai-main-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .ai-side-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ai-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }

        .ai-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ai-icon-bg {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #a78bfa, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 10px rgba(139, 92, 246, 0.15);
          flex-shrink: 0;
        }

        .ai-card-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .ai-card-header p {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 1px;
        }

        .prompt-input-row {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .prompt-input-row textarea {
          width: 100%;
          min-height: 80px;
          padding: 12px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 13px;
          background: var(--card-bg);
          color: var(--text-primary);
          font-family: inherit;
          resize: vertical;
        }

        .prompt-input-row textarea:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        .generate-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 44px;
        }

        .generate-btn:hover:not(:disabled) {
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
          transform: translateY(-1px);
        }

        .generate-btn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .plan-result-card {
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }

        .plan-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 14px;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .plan-header-row h3 {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .plan-editor {
          width: 100%;
          min-height: 280px;
          padding: 14px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius);
          font-size: 13px;
          font-family: inherit;
          line-height: 1.6;
          resize: vertical;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          margin-bottom: 14px;
        }

        .plan-editor:focus {
          outline: none;
          background: var(--card-bg);
          border-color: #8b5cf6;
        }

        .plan-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-save-plan {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: #8b5cf6;
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 38px;
        }

        .btn-save-plan:hover {
          background: #7c3aed;
        }

        .save-indicator {
          font-size: 12px;
          color: var(--success);
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Guidelines & History */
        .guidelines-dropzone {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius);
          padding: 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .guidelines-dropzone:hover {
          border-color: #8b5cf6;
          background: var(--bg-tertiary);
        }

        .guideline-file-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 6px;
          background: var(--bg-tertiary);
          margin-bottom: 6px;
        }

        .plan-history-item {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          cursor: pointer;
          margin-bottom: 8px;
          transition: all 0.15s ease;
        }

        .plan-history-item:hover {
          background: var(--brand-50);
          border-color: var(--brand-300);
        }

        /* ─── Chatbot Styles ─── */
        .chat-container {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          height: 620px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .chat-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
        }

        .chat-header-info h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .chat-header-info p {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .chat-messages-area {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chat-bubble-wrapper {
          display: flex;
          gap: 10px;
          max-width: 85%;
        }

        .chat-bubble-wrapper.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .chat-bubble-wrapper.assistant {
          align-self: flex-start;
        }

        .chat-bubble {
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .chat-bubble.user {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          border-bottom-right-radius: 2px;
        }

        .chat-bubble.assistant {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-bottom-left-radius: 2px;
        }

        .chat-chips-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          overflow-x: auto;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
        }

        .chat-chip {
          white-space: nowrap;
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 100px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .chat-chip:hover {
          border-color: #8b5cf6;
          color: #8b5cf6;
          background: var(--brand-50);
        }

        .chat-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid var(--border-color);
          background: var(--card-bg);
        }

        .chat-input-row input {
          flex: 1;
          padding: 10px 14px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 13px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .chat-input-row input:focus {
          outline: none;
          border-color: #8b5cf6;
          background: var(--card-bg);
        }

        .chat-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          border: none;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .chat-send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
        }

        .chat-send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chat-attach-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: var(--radius-sm);
          border: 1.5px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .chat-attach-btn:hover:not(:disabled) {
          border-color: #8b5cf6;
          color: #8b5cf6;
          background: var(--card-bg);
        }

        .chat-attach-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chat-attachment-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
          gap: 12px;
        }
      `}</style>

      {/* Top Bar: Tabs & Live Quota Pill */}
      <div className="ai-top-bar">
        <div className="ai-tabs-nav">
          <button
            className={`ai-nav-btn ${activeTab === "planner" ? "active" : ""}`}
            onClick={() => setActiveTab("planner")}
            type="button"
          >
            <BrainCircuit size={16} />
            <span>Lesson Planner & Pacing</span>
          </button>
          <button
            className={`ai-nav-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
            type="button"
          >
            <MessageSquare size={16} />
            <span>Teaching Assistant Bot</span>
          </button>
        </div>

        {/* Live Quota Pill */}
        <div
          className="quota-status-pill"
          onClick={() => refetchQuota()}
          title="Click to check Gemini API status"
        >
          <div
            className={`status-dot ${
              quotaStatus?.quota_exceeded
                ? "warning"
                : quotaStatus?.is_active
                ? "active"
                : "error"
            }`}
          />
          <span>
            {isCheckingQuota
              ? "Checking..."
              : quotaStatus?.quota_exceeded
              ? "⚠️ Quota Reached (Offline Mode)"
              : quotaStatus?.is_active
              ? "Gemini API Active"
              : "API Disconnected"}
          </span>
          <RefreshCw size={12} className={isCheckingQuota ? "animate-spin" : ""} />
        </div>
      </div>

      {/* Quota Notice Banner */}
      {quotaNotice && (
        <div className="quota-alert-banner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} />
            <span>{quotaNotice}</span>
          </div>
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: "4px 8px", background: "white" }}
            onClick={() => setQuotaNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── TAB 1: LESSON PLANNER ─── */}
      {activeTab === "planner" && (
        <div className="ai-tab-content">
          <div className="ai-main-col">
            <div className="ai-card">
              <div className="ai-card-header">
                <div className="ai-icon-bg">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2>AI Lesson Assistant</h2>
                  <p>
                    Tailor a comprehensive daily or weekly study plan based on marks, weak
                    areas, and syllabus progress
                  </p>
                </div>
              </div>

              <div className="prompt-input-row">
                <textarea
                  placeholder="Add custom directions (e.g., 'Generate number-wise: 1. Teach Math Addition 2. Grammar' or 'Finish SEM 1 syllabus before 15th Sep')..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={generating}
                  id="ai-prompt-input"
                />

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "2px 0 6px" }}>
                  {[
                    "Generate number-wise: 1. Teach Math Addition 2. Grammar",
                    "Finish SEM 1 syllabus before 15th Sep",
                    "Targeted practice drills & weak area revision",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPrompt(suggestion)}
                      style={{
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 100,
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-tertiary)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>

                {generateError && (
                  <div
                    style={{
                      color: "var(--danger)",
                      fontSize: 13,
                      padding: "8px 12px",
                      background: "var(--danger-light)",
                      borderRadius: 6,
                    }}
                  >
                    {generateError}
                  </div>
                )}

                <button
                  className="generate-btn"
                  onClick={() => generateMutation.mutate(prompt || undefined)}
                  disabled={generating}
                  id="generate-plan-btn"
                  type="button"
                >
                  {generating ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Analyzing student record & distributing to calendar...
                    </>
                  ) : (
                    <>
                      <BrainCircuit size={15} />
                      Generate Tailored Plan
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Display Active Generated Plan */}
            {activePlan && (
              <div className="plan-result-card">
                <div className="plan-header-row">
                  <div>
                    <h3>
                      <FileText size={16} style={{ color: "#8b5cf6" }} />
                      Generated Lesson Plan (
                      {new Date(activePlan.plan_date).toLocaleDateString()})
                    </h3>
                    {activePlan.created_at && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 3,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={12} />
                        Generated {formatPlanDateTime(activePlan.created_at)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfModalPlan(activePlan);
                        setIsPdfModalOpen(true);
                      }}
                      className="btn-secondary"
                      style={{
                        padding: "5px 12px",
                        fontSize: 12,
                        gap: 5,
                        borderColor: "var(--brand-200, #ddd6fe)",
                        color: "var(--brand-600, #7c3aed)",
                        background: "var(--brand-50, #f5f3ff)",
                      }}
                      title="Preview or Download plan in PDF format"
                      id="header-pdf-btn"
                    >
                      <Printer size={13} /> PDF Preview / Export
                    </button>
                    {isSaved && (
                      <span className="save-indicator">
                        <CheckCircle size={15} /> Distributed to Calendar
                      </span>
                    )}
                  </div>
                </div>

                <textarea
                  className="plan-editor"
                  value={activePlan.edited_plan || activePlan.generated_plan || ""}
                  onChange={(e) =>
                    setActivePlan({ ...activePlan, edited_plan: e.target.value })
                  }
                  disabled={generating}
                  id="ai-plan-editor"
                />

                <div className="plan-actions">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-secondary"
                      onClick={() => generateMutation.mutate(prompt || undefined)}
                      disabled={generating}
                      type="button"
                    >
                      <RefreshCw size={13} /> Regenerate
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setPdfModalPlan(activePlan);
                        setIsPdfModalOpen(true);
                      }}
                      type="button"
                      id="preview-plan-pdf-btn"
                      style={{
                        borderColor: "var(--brand-200, #ddd6fe)",
                        color: "var(--brand-600, #7c3aed)",
                      }}
                    >
                      <FileDown size={13} /> PDF Preview / Download
                    </button>
                    {isTeacher && (
                      <button
                        className="btn-secondary"
                        onClick={() => handleDeletePlan(activePlan.id)}
                        type="button"
                        id="delete-active-plan-btn"
                        style={{
                          borderColor: "rgba(239, 68, 68, 0.3)",
                          color: "#dc2626",
                        }}
                        disabled={deletePlanMutation.isPending}
                        title="Delete this plan from history (Teacher only)"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                  <button
                    className="btn-save-plan"
                    onClick={() =>
                      saveMutation.mutate({
                        planId: activePlan.id,
                        editedPlan:
                          activePlan.edited_plan || activePlan.generated_plan || "",
                      })
                    }
                    disabled={generating || saveMutation.isPending}
                    id="save-ai-plan-btn"
                    type="button"
                  >
                    <Save size={13} /> Apply to Calendar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Side Column: Upload Guidelines & Plan History */}
          <div className="ai-side-col">
            <div className="ai-card">
              <div className="ai-card-header">
                <Upload size={18} style={{ color: "var(--brand-600)" }} />
                <h3>Counselor Guidelines</h3>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                }}
              >
                Upload counselor or psychologist evaluation notes (PDF/DOCX) to guide
                teaching strategy.
              </p>

              <label className="guidelines-dropzone" style={{ display: "block" }}>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  disabled={uploading}
                />
                <Upload
                  size={24}
                  style={{ color: "var(--text-tertiary)", margin: "0 auto 8px" }}
                />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {uploading ? "Uploading..." : "Upload Guidelines"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  PDF or DOCX
                </div>
              </label>

              {uploadError && (
                <div
                  style={{
                    color: "var(--danger)",
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  {uploadError}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                {recommendations.length > 0 ? (
                  recommendations.map((r) => (
                    <div key={r.id} className="guideline-file-item">
                      <FileText size={14} style={{ color: "var(--brand-600)" }} />
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.file_name}
                      </span>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      textAlign: "center",
                      padding: "8px 0",
                    }}
                  >
                    No guideline files uploaded yet.
                  </div>
                )}
              </div>
            </div>

            <div className="ai-card">
              <div
                className="ai-card-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={18} style={{ color: "var(--brand-600)" }} />
                  <h3>Plan History</h3>
                  {plans.length > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        background: "var(--brand-50, #f5f3ff)",
                        color: "var(--brand-700, #6d28d9)",
                        padding: "1px 6px",
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {plans.length}
                    </span>
                  )}
                </div>
                {isTeacher && plans.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllPlans}
                    disabled={clearPlansMutation.isPending || deletePlanMutation.isPending}
                    style={{
                      padding: "3px 8px",
                      fontSize: 11,
                      borderRadius: "5px",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      background: "rgba(239, 68, 68, 0.05)",
                      color: "#dc2626",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 600,
                      transition: "all 0.15s ease",
                    }}
                    title="Delete all plan history for this student (Teacher only)"
                    id="clear-all-plans-btn"
                  >
                    <Trash2 size={11} /> Clear All
                  </button>
                )}
              </div>
              {plans.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxHeight: 380,
                    overflowY: "auto",
                    paddingRight: 2,
                  }}
                >
                  {plans.map((p) => {
                    const isCurrentActive = activePlan?.id === p.id;
                    const isDeletingThis = deletingPlanId === p.id;
                    return (
                      <div
                        key={p.id}
                        className="plan-history-item"
                        onClick={() => {
                          setActivePlan(p);
                          setIsSaved(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          cursor: "pointer",
                          borderColor: isCurrentActive ? "var(--brand-400, #a78bfa)" : undefined,
                          background: isCurrentActive ? "var(--brand-50, #faf5ff)" : undefined,
                          opacity: isDeletingThis ? 0.4 : 1,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            Plan for {p.plan_date}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-tertiary)",
                              marginTop: 2,
                            }}
                          >
                            Generated {formatPlanDateTime(p.created_at)}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPdfModalPlan(p);
                              setIsPdfModalOpen(true);
                            }}
                            style={{
                              padding: "3px 8px",
                              fontSize: 11,
                              borderRadius: "5px",
                              border: "1px solid var(--border-subtle)",
                              background: "var(--surface)",
                              color: "var(--brand-600, #7c3aed)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontWeight: 600,
                            }}
                            title="Preview or Download this plan as PDF"
                          >
                            <Printer size={11} /> PDF
                          </button>
                          {isTeacher && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePlan(p.id);
                              }}
                              disabled={deletePlanMutation.isPending || clearPlansMutation.isPending}
                              style={{
                                padding: "4px 6px",
                                fontSize: 11,
                                borderRadius: "5px",
                                border: "1px solid rgba(239, 68, 68, 0.25)",
                                background: "var(--surface)",
                                color: "#dc2626",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease",
                              }}
                              title="Delete this plan from history (Teacher only)"
                              id={`delete-plan-btn-${p.id}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    textAlign: "center",
                    padding: "16px 0",
                  }}
                >
                  No previous plans generated.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: AI TEACHING CONSULTANT CHATBOT ─── */}
      {activeTab === "chat" && (
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-title">
              <div className="chat-avatar">
                <Bot size={22} />
              </div>
              <div className="chat-header-info">
                <h3>StudyVerse Teaching Consultant</h3>
                <p>Equipped with student syllabus, test records & behavioral profile</p>
              </div>
            </div>

            <button
              className="btn-secondary"
              style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() =>
                setChatMessages([
                  {
                    role: "assistant",
                    content: `Chat reset. How can I help you teach ${studentName || "your student"} today? Ask any question!`,
                  },
                ])
              }
              type="button"
            >
              <RotateCcw size={13} />
              <span>Reset Chat</span>
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="chat-messages-area">
            {chatMessages.map((m, idx) => (
              <div key={idx} className={`chat-bubble-wrapper ${m.role}`}>
                <div className={`chat-bubble ${m.role}`}>
                  {m.attachment_data && (m.attachment_type?.startsWith("image/") || m.attachment_data.startsWith("data:image/")) && (
                    <div style={{ marginBottom: m.content ? 8 : 0 }}>
                      <img
                        src={
                          m.attachment_data.startsWith("data:")
                            ? m.attachment_data
                            : `data:${m.attachment_type || "image/png"};base64,${m.attachment_data}`
                        }
                        alt={m.attachment_name || "Attached image"}
                        style={{
                          maxWidth: "100%",
                          maxHeight: 220,
                          borderRadius: 8,
                          objectFit: "contain",
                          display: "block",
                          background: "rgba(0,0,0,0.05)",
                        }}
                      />
                    </div>
                  )}
                  {m.attachment_name && !(m.attachment_type?.startsWith("image/") || m.attachment_data?.startsWith("data:image/")) && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: m.role === "user" ? "rgba(255,255,255,0.2)" : "var(--bg-secondary)",
                        fontSize: 12,
                        marginBottom: m.content ? 8 : 0,
                        fontWeight: 600,
                      }}
                    >
                      <FileText size={14} />
                      <span>{m.attachment_name}</span>
                    </div>
                  )}
                  <div>{m.content}</div>
                </div>
              </div>
            ))}
            {chatSending && (
              <div className="chat-bubble-wrapper assistant">
                <div
                  className="chat-bubble assistant"
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompt Suggestion Chips */}
          <div className="chat-chips-row">
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-tertiary)",
              }}
            >
              Quick prompts:
            </span>
            {sampleQuestions.map((q, i) => (
              <button
                key={i}
                className="chat-chip"
                onClick={() => handleSendChat(q)}
                type="button"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Selected Attachment Preview Strip */}
          {chatAttachment && (
            <div className="chat-attachment-preview">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflow: "hidden" }}>
                {chatAttachment.previewUrl ? (
                  <img
                    src={chatAttachment.previewUrl}
                    alt="preview"
                    style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      background: "var(--brand-50, #f5f3ff)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#8b5cf6",
                    }}
                  >
                    <FileText size={18} />
                  </div>
                )}
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    {chatAttachment.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {(chatAttachment.file.size / 1024).toFixed(1)} KB • Attached
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChatAttachment(null)}
                style={{
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Remove attachment"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Input Area */}
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
          >
            <input
              type="file"
              ref={chatFileInputRef}
              style={{ display: "none" }}
              accept="image/*,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleChatFileSelect}
            />
            <button
              type="button"
              className="chat-attach-btn"
              onClick={() => chatFileInputRef.current?.click()}
              title="Attach image or document"
              disabled={chatSending}
              id="teacher-chat-attach-btn"
            >
              <Paperclip size={16} />
            </button>
            <input
              placeholder="Ask anything or discuss attached image / file..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
              id="teacher-chat-input"
            />
            <button
              className="chat-send-btn"
              type="submit"
              disabled={(!chatInput.trim() && !chatAttachment) || chatSending}
              id="teacher-chat-send-btn"
            >
              <Send size={15} />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* Plan PDF Preview & Export Modal */}
      <PlanPDFPreviewModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        plan={pdfModalPlan}
        studentName={studentName}
      />
    </div>
  );
}
