// codex: unit tests for question helper utilities
import { randomUUID } from "crypto";
import { describe, it, expect } from "vitest";
import { parseAnswerSections, selectRelevantSkills } from "@/lib/questionHelpers";
import type { Skill } from "@/types/skill";

const makeSkill = (overrides: Partial<Skill>): Skill => ({
  id: randomUUID(),
  title: "Placeholder",
  content: "",
  quickFacts: [],
  edgeCases: [],
  sourceUrls: [],
  isActive: true,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("parseAnswerSections", () => {
  it("codex: splits structured sections correctly", () => {
    const answer = [
      "Answer: Main body",
      "",
      "Confidence: High",
      "Sources:",
      "- https://example.com",
      "Reasoning: matched skills",
      "Inference: Some deduction",
      "Remarks: none",
    ].join("\n");

    const parsed = parseAnswerSections(answer);
    expect(parsed.response).toBe("Main body");
    expect(parsed.confidence).toBe("High");
    expect(parsed.sources).toContain("example.com");
    expect(parsed.reasoning).toContain("matched");
    expect(parsed.inference).toContain("deduction");
    expect(parsed.remarks).toBe("none");
  });

  it("codex: falls back to pre-section text when headers missing", () => {
    const answer = "This is a plain paragraph without sections.";
    const parsed = parseAnswerSections(answer);
    expect(parsed.response).toBe(answer);
    expect(parsed.confidence).toBe("");
    expect(parsed.sources).toBe("");
  });
});

describe("selectRelevantSkills", () => {
  it("codex: scores active skills and returns top matches", () => {
    const skills = [
      makeSkill({
        id: "s1",
        title: "Data Encryption Overview",
        content: "Explains AES-256 encryption and key rotation.",
      }),
      makeSkill({
        id: "s2",
        title: "Access Control",
        content: "Role based access with SSO.",
      }),
      makeSkill({
        id: "s3",
        title: "Legacy Skill",
        isActive: false,
        status: 'ARCHIVED',
        content: "Should not appear because inactive. Uses encryption.",
      }),
    ];

    const results = selectRelevantSkills(
      "How does your encryption key rotation work?",
      skills,
    );

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("s1");
  });
});
