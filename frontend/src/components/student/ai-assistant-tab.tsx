"use client";

import { useState } from "react";
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
} from "lucide-react";
import { academicApi, type AIPlan } from "@/lib/academic-api";

interface AIAssistantTabProps {
  studentId: string;
}

export function AIAssistantTab({ studentId }: AIAssistantTabProps) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<AIPlan | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [generateError, setGenerateError] = useState("");

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

  // ─── Mutations ───────────────────────────────────────────
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

  return (
    <div className="ai-tab">
      <style>{`
        .ai-tab {
          width: 100%;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        @media (min-width: 768px) {
          .ai-tab {
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

        @media (max-width: 480px) {
          .ai-card {
            padding: 16px;
          }
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

        @media (max-width: 480px) {
          .plan-result-card {
            padding: 16px;
          }
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

        .sidebar-panel {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          padding: 16px;
        }

        .sidebar-panel h3 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .rec-item {
          font-size: 12px;
          padding: 8px;
          border-radius: 6px;
          background: var(--bg-tertiary);
          margin-bottom: 8px;
          border: 1px solid var(--border-color);
        }

        .plan-history-item {
          padding: 10px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          cursor: pointer;
          font-size: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          transition: all 0.15s ease;
        }

        .plan-history-item:hover {
          background: var(--brand-50);
          border-color: var(--brand-300);
        }
      `}</style>

      {/* Main Content Column */}
      <div className="ai-main-col">
        <div className="ai-card">
          <div className="ai-card-header">
            <div className="ai-icon-bg">
              <Sparkles size={20} />
            </div>
            <div>
              <h2>AI Lesson Assistant</h2>
              <p>Tailor a comprehensive daily study plan utilizing academic marks, weak areas, and syllabus progress</p>
            </div>
          </div>

          <div className="prompt-input-row">
            <textarea
              placeholder="Add custom directions (e.g., Focus on basic word equations or practice radical root simplification)..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={generating}
              id="ai-prompt-input"
            />

            {generateError && (
              <div style={{ color: "var(--danger)", fontSize: 13, padding: "8px 12px", background: "var(--danger-light)", borderRadius: 6 }}>
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
                  Analyzing student record...
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
              <h3>
                <FileText size={16} style={{ color: "#8b5cf6" }} />
                Generated Lesson Plan ({new Date(activePlan.plan_date).toLocaleDateString()})
              </h3>
              {isSaved && (
                <span className="save-indicator">
                  <CheckCircle size={15} /> Saved to Daily Plan
                </span>
              )}
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
              <button
                className="btn-secondary"
                onClick={() => generateMutation.mutate(prompt || undefined)}
                disabled={generating}
                type="button"
              >
                <RefreshCw size={13} /> Regenerate
              </button>
              <button
                className="btn-save-plan"
                onClick={() =>
                  saveMutation.mutate({
                    planId: activePlan.id,
                    editedPlan: activePlan.edited_plan || activePlan.generated_plan || "",
                  })
                }
                disabled={generating || saveMutation.isPending}
                id="save-ai-plan-btn"
                type="button"
              >
                <Save size={13} /> Apply to Today
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Utilities Column */}
      <div className="ai-side-col">
        {/* Counselor Guidelines */}
        <div className="sidebar-panel">
          <h3>
            <Upload size={14} />
            Counselor Guidelines
          </h3>

          <label className="btn-secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: uploading ? "not-allowed" : "pointer", padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--card-bg)", color: "var(--text-primary)", fontWeight: 600, marginBottom: 12 }}>
            <Upload size={14} />
            {uploading ? "Uploading..." : "Upload Guidelines"}
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileUpload}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>

          {uploadError && (
            <div style={{ color: "var(--danger)", fontSize: 11, marginBottom: 8 }}>
              {uploadError}
            </div>
          )}

          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {recommendations.length > 0 ? (
              recommendations.map((rec) => (
                <div key={rec.id} className="rec-item">
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{rec.file_name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {new Date(rec.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0" }}>
                No guideline files uploaded yet.
              </div>
            )}
          </div>
        </div>

        {/* Plan History */}
        <div className="sidebar-panel">
          <h3>
            <Clock size={14} />
            Plan History
          </h3>

          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {plans.length > 0 ? (
              plans.map((p) => (
                <div
                  key={p.id}
                  className="plan-history-item"
                  onClick={() => {
                    setActivePlan(p);
                    setIsSaved(false);
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      Plan for {new Date(p.plan_date).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      Generated {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0" }}>
                No past generated plans.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
