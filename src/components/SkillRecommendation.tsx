"use client";

import Link from "next/link";
import { Skill } from "@/types/skill";

// Accept both full Skill objects and simplified skill references (from stored data)
type SkillReference = string | { id: string; title: string } | Skill;

type SkillRecommendationProps = {
  usedSkills: SkillReference[];
  question: string;
  onDismiss?: () => void;
};

// Type guard to check if a skill reference is a full Skill object
function isFullSkill(skill: SkillReference): skill is Skill {
  return typeof skill === "object" && "createdAt" in skill;
}

export default function SkillRecommendation({
  usedSkills,
  question,
  onDismiss,
}: SkillRecommendationProps) {
  // Filter to only full Skill objects that can be evaluated for age
  const fullSkills = usedSkills.filter(isFullSkill);

  // Check if no skills were used - suggest creating a new one
  const noSkillsUsed = fullSkills.length === 0;

  // Find skills that were used but might be outdated (>30 days old)
  const now = new Date();
  const outdatedUsedSkills = fullSkills.filter((skill) => {
    const lastUpdate = skill.lastRefreshedAt
      ? new Date(skill.lastRefreshedAt)
      : new Date(skill.createdAt);
    const daysSince = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 30;
  });

  // Don't show if no recommendations
  if (!noSkillsUsed && outdatedUsedSkills.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "#eff6ff",
        border: "1px solid #93c5fd",
        borderRadius: "8px",
        padding: "16px",
        marginTop: "16px",
        display: "flex",
        alignItems: "start",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "24px", lineHeight: 1 }}>💡</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600, color: "#1e3a8a" }}>
            Skill Recommendations
          </h4>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: "none",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                fontSize: "18px",
                padding: "0 4px",
              }}
              title="Dismiss"
            >
              ×
            </button>
          )}
        </div>

        {noSkillsUsed ? (
          <>
            <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#1e40af" }}>
              No relevant skills were found for this question. Consider creating a new skill to
              improve future answers on this topic.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              <span
                style={{
                  fontSize: "13px",
                  backgroundColor: "#dbeafe",
                  color: "#1e3a8a",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  fontWeight: 500,
                }}
              >
                Question: {question.length > 80 ? question.substring(0, 80) + "..." : question}
              </span>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#1e40af" }}>
              {outdatedUsedSkills.length === 1
                ? "This skill was used but hasn't been updated recently:"
                : `${outdatedUsedSkills.length} skills were used but haven't been updated recently:`}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {outdatedUsedSkills.map((skill) => {
                const lastUpdate = skill.lastRefreshedAt || skill.createdAt;
                const daysSince = Math.floor(
                  (now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24),
                );
                return (
                  <span
                    key={skill.id}
                    style={{
                      fontSize: "13px",
                      backgroundColor: "#dbeafe",
                      color: "#1e3a8a",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      fontWeight: 500,
                    }}
                  >
                    {skill.title} ({daysSince} days old)
                  </span>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          {noSkillsUsed ? (
            <Link
              href="/knowledge"
              style={{
                display: "inline-block",
                padding: "6px 14px",
                backgroundColor: "#2563eb",
                color: "var(--card)",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Create New Skill
            </Link>
          ) : (
            <Link
              href="/knowledge"
              style={{
                display: "inline-block",
                padding: "6px 14px",
                backgroundColor: "#2563eb",
                color: "var(--card)",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Update Skills
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
