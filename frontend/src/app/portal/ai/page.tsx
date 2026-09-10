"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Bot,
  Send,
  RotateCcw,
  RefreshCw,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  Printer,
  Paperclip,
  X,
  FileText,
} from "lucide-react";
import { portalApi, type AIPlan, type AIChatMessage } from "@/lib/portal-api";
import { exportPlanToPrintablePDF } from "@/lib/plan-pdf-export";

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

export default function StudentAIPage() {
  const [activeTab, setActiveTab] = useState<"chat" | "plans">("chat");
  const [selectedPlan, setSelectedPlan] = useState<AIPlan | null>(null);

  // ─── Chat State ──────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! 🌟 I'm your StudyBuddy AI tutor! I'm here to help you understand tricky topics, practice fun questions, and answer anything you want to learn. What are we studying today? 🚀",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState<string | null>(null);
  const [chatAttachment, setChatAttachment] = useState<{
    file: File;
    name: string;
    type: string;
    previewUrl: string | null;
    base64Data: string;
  } | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ─────────────────────────────────────────────
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["portal-ai-plans"],
    queryFn: () => portalApi.getAIPlans(),
    select: (res) => res.data,
  });

  const { data: quotaStatus, refetch: refetchQuota } = useQuery({
    queryKey: ["portal-ai-quota"],
    queryFn: () => portalApi.getAIQuotaStatus(),
    select: (res) => res.data,
  });

  // ─── Chat Mutation ───────────────────────────────────────
  const chatMutation = useMutation({
    mutationFn: ({
      msg,
      attachment,
    }: {
      msg: string;
      attachment?: { file_data?: string; file_name?: string; mime_type?: string };
    }) => portalApi.sendAIChat(msg, chatMessages, attachment),
    onSuccess: (res) => {
      const reply = res.data.response;
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (res.data.quota_exceeded) {
        setQuotaNotice(
          res.data.quota_notice ||
            "⚠️ StudyBuddy is currently running in offline smart mode."
        );
      }
    },
    onError: () => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "🌟 Oops! I couldn't think of an answer right now. Please check your internet or try asking again in a moment!",
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
      content: textToSend || `[Sent picture / file: ${chatAttachment?.name}]`,
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
        `Please look at this attached image / file (${prevAttachment?.name}) and help explain it to me!`,
      attachment: attachmentPayload,
    });
  };

  const studentChips = [
    "Tell me a fun Science fact! 🚀",
    "Explain subtraction with chocolates 🍫",
    "What are the 3 parts of an insect? 🐜",
    "How does simple past tense work? 📖",
    "Quiz me on 4 times table! 🧮",
  ];

  return (
    <div className="portal-ai-container">
      <style>{`
        .portal-ai-container {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Top Header & Sub-Tabs */
        .portal-ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .portal-ai-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .portal-ai-header p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .portal-tabs-nav {
          display: flex;
          gap: 8px;
          background: var(--card-bg);
          padding: 6px;
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
        }

        .portal-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .portal-tab-btn:hover {
          color: var(--text-primary);
        }

        .portal-tab-btn.active {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
        }

        /* Quota Alert */
        .portal-quota-alert {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: var(--radius);
          color: #92400e;
          font-size: 12px;
        }

        /* ─── Chat Window ─── */
        .student-chat-box {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          height: 600px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .student-chat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .buddy-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .buddy-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        .buddy-title h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .buddy-title p {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .messages-container {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .bubble-row {
          display: flex;
          gap: 10px;
          max-width: 85%;
        }

        .bubble-row.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .bubble-row.assistant {
          align-self: flex-start;
        }

        .chat-text {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 13.5px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .bubble-row.user .chat-text {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border-bottom-right-radius: 2px;
        }

        .bubble-row.assistant .chat-text {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-bottom-left-radius: 2px;
        }

        .chips-scroll {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          overflow-x: auto;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
        }

        .student-chip {
          white-space: nowrap;
          font-size: 12px;
          padding: 6px 14px;
          border-radius: 100px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .student-chip:hover {
          border-color: #10b981;
          color: #10b981;
          background: #ecfdf5;
        }

        .student-input-form {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid var(--border-color);
          background: var(--card-bg);
        }

        .student-input-form input {
          flex: 1;
          padding: 11px 16px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 13.5px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .student-input-form input:focus {
          outline: none;
          border-color: #10b981;
          background: var(--card-bg);
        }

        .student-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 11px 20px;
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .student-send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
        }

        .student-send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .student-attach-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: var(--radius-sm);
          border: 1.5px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .student-attach-btn:hover:not(:disabled) {
          border-color: #10b981;
          color: #10b981;
          background: var(--card-bg);
        }

        .student-attach-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .student-attachment-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
          gap: 12px;
        }
      `}</style>

      {/* Header */}
      <div className="portal-ai-header">
        <div>
          <h1>AI Learning Hub</h1>
          <p>Chat with your personal AI study buddy or view daily teacher lesson plans</p>
        </div>

        {/* Tab Switcher */}
        <div className="portal-tabs-nav">
          <button
            className={`portal-tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
            type="button"
          >
            <Bot size={16} />
            <span>Chat with StudyBuddy</span>
          </button>
          <button
            className={`portal-tab-btn ${activeTab === "plans" ? "active" : ""}`}
            onClick={() => setActiveTab("plans")}
            type="button"
          >
            <BookOpen size={16} />
            <span>Lesson Plans ({plans.length})</span>
          </button>
        </div>
      </div>

      {/* Quota Notice Banner */}
      {quotaNotice && (
        <div className="portal-quota-alert">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} />
            <span>{quotaNotice}</span>
          </div>
          <button
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
            onClick={() => setQuotaNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── TAB 1: STUDYBUDDY CHATBOT ─── */}
      {activeTab === "chat" && (
        <div className="student-chat-box">
          <div className="student-chat-top">
            <div className="buddy-title">
              <div className="buddy-icon">
                <Bot size={22} />
              </div>
              <div>
                <h3>StudyBuddy AI Tutor</h3>
                <p>Always here to explain lessons & help with tricky homework!</p>
              </div>
            </div>

            <button
              className="btn-secondary"
              style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() =>
                setChatMessages([
                  {
                    role: "assistant",
                    content:
                      "Chat reset! 🌟 Ask me any question about your lessons, math, or science!",
                  },
                ])
              }
              type="button"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          </div>

          {/* Chat Messages */}
          <div className="messages-container">
            {chatMessages.map((m, idx) => (
              <div key={idx} className={`bubble-row ${m.role}`}>
                <div className="chat-text">
                  {m.attachment_data && (m.attachment_type?.startsWith("image/") || m.attachment_data.startsWith("data:image/")) && (
                    <div style={{ marginBottom: m.content ? 8 : 0 }}>
                      <img
                        src={
                          m.attachment_data.startsWith("data:")
                            ? m.attachment_data
                            : `data:${m.attachment_type || "image/png"};base64,${m.attachment_data}`
                        }
                        alt={m.attachment_name || "Uploaded image"}
                        style={{
                          maxWidth: "100%",
                          maxHeight: 220,
                          borderRadius: 10,
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
              <div className="bubble-row assistant">
                <div
                  className="chat-text"
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <RefreshCw size={14} className="animate-spin" />
                  <span>StudyBuddy is thinking... 🌟</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Questions Chips */}
          <div className="chips-scroll">
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-tertiary)",
              }}
            >
              Try asking:
            </span>
            {studentChips.map((c, i) => (
              <button
                key={i}
                className="student-chip"
                onClick={() => handleSendChat(c)}
                type="button"
              >
                {c}
              </button>
            ))}
          </div>

          {/* Selected Attachment Preview Strip */}
          {chatAttachment && (
            <div className="student-attachment-preview">
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
                      background: "rgba(16, 185, 129, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#10b981",
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
                    {(chatAttachment.file.size / 1024).toFixed(1)} KB • Ready to send
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

          {/* Input Form */}
          <form
            className="student-input-form"
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
              className="student-attach-btn"
              onClick={() => chatFileInputRef.current?.click()}
              title="Attach question photo or document"
              disabled={chatSending}
              id="student-chat-attach-btn"
            >
              <Paperclip size={16} />
            </button>
            <input
              placeholder="Ask StudyBuddy anything or send a question photo..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
              id="student-chat-input"
            />
            <button
              className="student-send-btn"
              type="submit"
              disabled={(!chatInput.trim() && !chatAttachment) || chatSending}
              id="student-chat-send-btn"
            >
              <Send size={15} />
              <span>Ask</span>
            </button>
          </form>
        </div>
      )}

      {/* ─── TAB 2: LESSON PLANS ─── */}
      {activeTab === "plans" && (
        <div>
          {isLoading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
              Loading lesson plans...
            </div>
          ) : plans.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              {plans.map((p) => {
                const isExpanded = selectedPlan?.id === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: "var(--card-bg)",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border-color)",
                      padding: 20,
                      cursor: "pointer",
                      boxShadow: isExpanded ? "var(--shadow-md)" : "none",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setSelectedPlan(isExpanded ? null : p)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "var(--brand-50)",
                            color: "var(--brand-600)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                            Lesson Plan for {new Date(p.plan_date).toLocaleDateString("default", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </h3>
                          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                            Generated {formatPlanDateTime(p.created_at)}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportPlanToPrintablePDF({
                              planText: p.edited_plan || p.generated_plan || "",
                              planDate: p.plan_date,
                              createdAt: p.created_at,
                            });
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--border-color)",
                            background: "var(--surface)",
                            color: "var(--brand-600)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          title="Preview or Download this plan in PDF format"
                        >
                          <Printer size={13} />
                          <span>PDF</span>
                        </button>
                        {isExpanded ? <ChevronUp size={16} color="var(--text-tertiary)" /> : <ChevronDown size={16} color="var(--text-tertiary)" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 16,
                          borderTop: "1px solid var(--border-color)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.edited_plan || p.generated_plan}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius)",
                padding: "48px 32px",
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
                <Sparkles size={24} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                No recommendations yet
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto" }}>
                When your tutor generates an AI study guideline or lesson plan for you, it will show up here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
