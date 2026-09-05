"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { portalApi, type AIPlan } from "@/lib/portal-api";

export default function StudentAIPlansPage() {
  const [selectedPlan, setSelectedPlan] = useState<AIPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["portal-ai-plans"],
    queryFn: () => portalApi.getAIPlans(),
    select: (res) => res.data,
  });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>AI Recommendations</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>View daily lesson plans and guidelines generated for you by AI</p>
      </div>

      {isLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading AI recommendations...
        </div>
      ) : plans.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
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
                        Generated {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div>
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
  );
}
