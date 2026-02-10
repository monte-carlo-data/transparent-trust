"use client";

import Link from "next/link";
import { Skill } from "@/types/skill";

type SkillUpdateBannerProps = {
  skills: Skill[];
};

const STALE_DAYS = 90; // Skills older than 90 days are considered stale

export default function SkillUpdateBanner({ skills }: SkillUpdateBannerProps) {
  const activeSkills = skills.filter((skill) => skill.isActive);

  if (activeSkills.length === 0) {
    return null;
  }

  // Find stale skills (older than STALE_DAYS)
  const now = new Date();
  const staleSkills = activeSkills.filter((skill) => {
    const createdDate = new Date(skill.createdAt);
    const lastRefreshedDate = skill.lastRefreshedAt
      ? new Date(skill.lastRefreshedAt)
      : createdDate;
    const daysSinceUpdate =
      (now.getTime() - lastRefreshedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > STALE_DAYS;
  });

  if (staleSkills.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "#fef3c7",
        border: "1px solid #fbbf24",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "start",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "24px", lineHeight: 1 }}>⚠️</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600, color: "#92400e" }}>
          Skills Need Updating
        </h3>
        <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#78350f" }}>
          You have {staleSkills.length} skill{staleSkills.length === 1 ? "" : "s"} that{" "}
          {staleSkills.length === 1 ? "hasn't" : "haven't"} been updated in over {STALE_DAYS}{" "}
          days. Consider refreshing {staleSkills.length === 1 ? "it" : "them"} to ensure accurate
          answers.
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {staleSkills.slice(0, 3).map((skill) => {
            const lastUpdate = skill.lastRefreshedAt || skill.createdAt;
            const daysSince = Math.floor(
              (now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24),
            );
            return (
              <span
                key={skill.id}
                style={{
                  fontSize: "12px",
                  backgroundColor: "#fde68a",
                  color: "#78350f",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontWeight: 500,
                }}
              >
                {skill.title} ({daysSince} days old)
              </span>
            );
          })}
          {staleSkills.length > 3 && (
            <span
              style={{
                fontSize: "12px",
                color: "#92400e",
                padding: "4px 8px",
                fontWeight: 500,
              }}
            >
              +{staleSkills.length - 3} more
            </span>
          )}
        </div>
        <div style={{ marginTop: "12px" }}>
          <Link
            href="/knowledge"
            style={{
              display: "inline-block",
              padding: "8px 16px",
              backgroundColor: "#f59e0b",
              color: "var(--card)",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Review Skills in Library
          </Link>
        </div>
      </div>
    </div>
  );
}
