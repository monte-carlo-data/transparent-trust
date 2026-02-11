import {
  FileText,
  Users,
  FolderKanban,
  Globe,
  FileCheck,
  User,
  Settings,
  Code,
  MessageSquare,
} from "lucide-react";

export type AuditEntityType =
  | "SKILL"
  | "CUSTOMER"
  | "PROJECT"
  | "DOCUMENT"
  | "REFERENCE_URL"
  | "CONTRACT"
  | "USER"
  | "SETTING"
  | "PROMPT"
  | "CONTEXT_SNIPPET"
  | "ANSWER";

export type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "VIEWED"
  | "EXPORTED"
  | "OWNER_ADDED"
  | "OWNER_REMOVED"
  | "STATUS_CHANGED"
  | "REFRESHED"
  | "MERGED"
  | "CORRECTED"
  | "APPROVED"
  | "REVIEW_REQUESTED"
  | "FLAG_RESOLVED";

export type AuditLogEntry = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityTitle: string | null;
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const entityTypeConfig: Record<
  AuditEntityType,
  { label: string; icon: typeof FileText; color: string }
> = {
  SKILL: { label: "Skill", icon: FileText, color: "#0ea5e9" },
  CUSTOMER: { label: "Customer", icon: Users, color: "#8b5cf6" },
  PROJECT: { label: "Project", icon: FolderKanban, color: "#f97316" },
  DOCUMENT: { label: "Document", icon: FileText, color: "#10b981" },
  REFERENCE_URL: { label: "URL", icon: Globe, color: "#6366f1" },
  CONTRACT: { label: "Contract", icon: FileCheck, color: "#ec4899" },
  USER: { label: "User", icon: User, color: "var(--muted-foreground)" },
  SETTING: { label: "Setting", icon: Settings, color: "var(--muted-foreground)" },
  PROMPT: { label: "Prompt", icon: Code, color: "#f59e0b" },
  CONTEXT_SNIPPET: { label: "Snippet", icon: Code, color: "#84cc16" },
  ANSWER: { label: "Answer", icon: MessageSquare, color: "#14b8a6" },
};

export const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  CREATED: { label: "Created", color: "#10b981" },
  UPDATED: { label: "Updated", color: "#0ea5e9" },
  DELETED: { label: "Deleted", color: "#ef4444" },
  VIEWED: { label: "Viewed", color: "var(--muted-foreground)" },
  EXPORTED: { label: "Exported", color: "#8b5cf6" },
  OWNER_ADDED: { label: "Owner Added", color: "#10b981" },
  OWNER_REMOVED: { label: "Owner Removed", color: "#f97316" },
  STATUS_CHANGED: { label: "Status Changed", color: "#0ea5e9" },
  REFRESHED: { label: "Refreshed", color: "#6366f1" },
  MERGED: { label: "Merged", color: "#ec4899" },
  CORRECTED: { label: "Corrected", color: "#f59e0b" },
  APPROVED: { label: "Approved", color: "#10b981" },
  REVIEW_REQUESTED: { label: "Review Requested", color: "#8b5cf6" },
  FLAG_RESOLVED: { label: "Flag Resolved", color: "#22c55e" },
};

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    if (value.length <= 3) return value.map(v => formatValue(v)).join(", ");
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value).slice(0, 100) + "...";
  }
  const str = String(value);
  return str.length > 100 ? str.slice(0, 100) + "..." : str;
}
