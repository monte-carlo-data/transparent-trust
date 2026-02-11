"use client";

type ReviewStatusBannerProps = {
  status: "REQUESTED" | "APPROVED" | "CORRECTED" | "PROJECT_ACCEPTED" | null;
  reviewedBy?: string | null;
};

// Using CSS variables for theme-aware colors
const statusConfig = {
  REQUESTED: {
    icon: "📨",
    label: "Sent for review",
    message: "Awaiting expert review",
    backgroundColor: "var(--warning-bg)",
    color: "var(--warning-text)",
    borderColor: "var(--warning-border)",
  },
  APPROVED: {
    icon: "✓",
    label: "Verified",
    message: "This answer has been verified",
    backgroundColor: "var(--success-bg)",
    color: "var(--success-text)",
    borderColor: "var(--success-border)",
  },
  CORRECTED: {
    icon: "✓",
    label: "Corrected",
    message: "This answer has been corrected",
    backgroundColor: "var(--info-bg)",
    color: "var(--info-text)",
    borderColor: "var(--info-border)",
  },
  PROJECT_ACCEPTED: {
    icon: "✓",
    label: "Accepted",
    message: "This answer has been accepted",
    backgroundColor: "var(--info-bg)",
    color: "var(--info-text)",
    borderColor: "var(--info-border)",
  },
};

export default function ReviewStatusBanner({ status, reviewedBy }: ReviewStatusBannerProps) {
  if (!status || status === "REQUESTED") {
    // For REQUESTED, we show a different style - handle separately if needed
    if (status === "REQUESTED") {
      const config = statusConfig.REQUESTED;
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            marginBottom: "12px",
            borderRadius: "6px",
            fontSize: "0.85rem",
            backgroundColor: config.backgroundColor,
            color: config.color,
            border: `1px solid ${config.borderColor}`,
          }}
        >
          <span>{config.icon}</span>
          <span>
            <strong>{config.label}</strong> - {config.message}
          </span>
        </div>
      );
    }
    return null;
  }

  const config = statusConfig[status];
  if (!config) return null;

  const byText = reviewedBy ? ` by ${reviewedBy}` : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        marginBottom: "12px",
        borderRadius: "6px",
        fontSize: "0.85rem",
        backgroundColor: config.backgroundColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <span>{config.icon}</span>
      <span>
        <strong>{config.label}</strong> - {config.message}
        {byText}
      </span>
    </div>
  );
}

// Helper function to determine which status to show
export function getEffectiveReviewStatus(
  rowReviewStatus: string | null | undefined,
  projectStatus: string | null | undefined
): "REQUESTED" | "APPROVED" | "CORRECTED" | "PROJECT_ACCEPTED" | null {
  if (rowReviewStatus === "APPROVED") return "APPROVED";
  if (rowReviewStatus === "CORRECTED") return "CORRECTED";
  if (rowReviewStatus === "REQUESTED") return "REQUESTED";
  if (projectStatus === "finalized") return "PROJECT_ACCEPTED";
  return null;
}

// Helper to get the reviewer name based on status
export function getReviewerName(
  rowReviewStatus: string | null | undefined,
  rowReviewedBy: string | null | undefined,
  projectReviewedBy: string | null | undefined
): string | null {
  if (rowReviewStatus === "APPROVED" || rowReviewStatus === "CORRECTED") {
    return rowReviewedBy || null;
  }
  return projectReviewedBy || null;
}
