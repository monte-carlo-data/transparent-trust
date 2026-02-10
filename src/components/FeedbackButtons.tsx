"use client";

import { useState } from "react";

// Standard feedback categories - aligned with Prisma FeedbackCategory enum
export const FEEDBACK_CATEGORIES = [
  { id: "WRONG_SKILL_MATCHED", label: "Wrong skill", description: "AI used wrong skill(s) for this question" },
  { id: "OUTDATED_KNOWLEDGE", label: "Outdated", description: "Skill content is stale/incorrect" },
  { id: "MISSING_KNOWLEDGE", label: "Missing knowledge", description: "No skill exists for this topic" },
  { id: "HALLUCINATION", label: "Hallucination", description: "AI made up information not in sources" },
  { id: "INCOMPLETE_ANSWER", label: "Incomplete", description: "Answer was partial/missing key details" },
  { id: "WRONG_TONE", label: "Wrong tone", description: "Tone/style didn't match expectations" },
  { id: "TECHNICAL_ERROR", label: "Technical error", description: "Factual/technical mistake" },
  { id: "FORMATTING_ISSUE", label: "Formatting", description: "Structure/formatting problems" },
  { id: "OTHER", label: "Other", description: "Catch-all for uncategorized issues" },
] as const;

export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number]["id"];

type FeedbackButtonsProps = {
  feature: "questions" | "chat" | "projects";
  question: string;
  answer: string;
  confidence?: string;
  skillsUsed?: { id: string; title: string }[];
  questionHistoryId?: string;
  bulkRowId?: string;
  chatSessionId?: string;
  model?: string;
  usedFallback?: boolean;
  traceId?: string;
  // Styling options
  size?: "small" | "medium";
  showLabels?: boolean;
};

type FeedbackState = "none" | "thumbs_up" | "thumbs_down" | "submitting";

export default function FeedbackButtons({
  feature,
  question,
  answer,
  confidence,
  skillsUsed,
  questionHistoryId,
  bulkRowId,
  chatSessionId,
  model,
  usedFallback,
  traceId,
  size = "medium",
  showLabels = false,
}: FeedbackButtonsProps) {
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("none");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (categoryId: FeedbackCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((c) => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const iconSize = size === "small" ? "16px" : "20px";
  const padding = size === "small" ? "4px 8px" : "6px 12px";

  const submitFeedback = async (rating: "thumbs_up" | "thumbs_down", userComment?: string, categories?: FeedbackCategory[]) => {
    setFeedbackState("submitting");
    setError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature,
          rating,
          comment: userComment || undefined,
          categories: categories || undefined,
          question,
          answer,
          confidence,
          skillsUsed,
          questionHistoryId,
          bulkRowId,
          chatSessionId,
          model,
          usedFallback,
          traceId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setFeedbackState(rating);
      setShowCommentBox(false);
      setComment("");
      setSelectedCategories([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting feedback");
      setFeedbackState("none");
    }
  };

  const handleThumbsUp = () => {
    if (feedbackState === "none") {
      submitFeedback("thumbs_up");
    }
  };

  const handleThumbsDown = () => {
    if (feedbackState === "none") {
      setShowCommentBox(true);
    }
  };

  const handleSubmitNegative = () => {
    submitFeedback("thumbs_down", comment, selectedCategories.length > 0 ? selectedCategories : undefined);
  };

  const handleCancelComment = () => {
    setShowCommentBox(false);
    setComment("");
    setSelectedCategories([]);
  };

  // Already submitted
  if (feedbackState === "thumbs_up" || feedbackState === "thumbs_down") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: size === "small" ? "0.75rem" : "0.875rem",
          color: feedbackState === "thumbs_up" ? "var(--success)" : "#dc2626",
        }}
      >
        <span>{feedbackState === "thumbs_up" ? "\u{1F44D}" : "\u{1F44E}"}</span>
        <span>Thanks for feedback!</span>
      </div>
    );
  }

  // Comment box for negative feedback
  if (showCommentBox) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>
          What went wrong?
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {FEEDBACK_CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                title={cat.description}
                style={{
                  padding: "4px 10px",
                  borderRadius: "16px",
                  border: isSelected ? "1px solid #dc2626" : "1px solid #e2e8f0",
                  background: isSelected ? "#fef2f2" : "white",
                  color: isSelected ? "#dc2626" : "#64748b",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Additional details (optional)..."
          style={{
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            fontSize: "0.875rem",
            resize: "vertical",
            minHeight: "50px",
          }}
        />
        {error && (
          <div style={{ color: "#dc2626", fontSize: "0.75rem" }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleSubmitNegative}
            disabled={feedbackState === "submitting"}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: "#dc2626",
              color: "white",
              fontSize: "0.875rem",
              cursor: feedbackState === "submitting" ? "wait" : "pointer",
              opacity: feedbackState === "submitting" ? 0.7 : 1,
            }}
          >
            {feedbackState === "submitting" ? "Submitting..." : "Submit Feedback"}
          </button>
          <button
            onClick={handleCancelComment}
            disabled={feedbackState === "submitting"}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              background: "white",
              color: "#64748b",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Default state - show both buttons
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      {showLabels && (
        <span style={{ fontSize: size === "small" ? "0.75rem" : "0.875rem", color: "#94a3b8" }}>
          Helpful?
        </span>
      )}
      <button
        onClick={handleThumbsUp}
        disabled={feedbackState === "submitting"}
        title="This answer was helpful"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding,
          borderRadius: "6px",
          border: "1px solid #e2e8f0",
          background: "white",
          cursor: feedbackState === "submitting" ? "wait" : "pointer",
          fontSize: iconSize,
          transition: "all 0.15s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "var(--success-bg)";
          e.currentTarget.style.borderColor = "var(--success)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "white";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }}
      >
        <span role="img" aria-label="thumbs up">{"\u{1F44D}"}</span>
        {showLabels && <span style={{ fontSize: "0.75rem" }}>Yes</span>}
      </button>
      <button
        onClick={handleThumbsDown}
        disabled={feedbackState === "submitting"}
        title="This answer needs improvement"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding,
          borderRadius: "6px",
          border: "1px solid #e2e8f0",
          background: "white",
          cursor: feedbackState === "submitting" ? "wait" : "pointer",
          fontSize: iconSize,
          transition: "all 0.15s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "#fef2f2";
          e.currentTarget.style.borderColor = "#dc2626";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "white";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }}
      >
        <span role="img" aria-label="thumbs down">{"\u{1F44E}"}</span>
        {showLabels && <span style={{ fontSize: "0.75rem" }}>No</span>}
      </button>
      {error && (
        <span style={{ color: "#dc2626", fontSize: "0.75rem" }}>{error}</span>
      )}
    </div>
  );
}
