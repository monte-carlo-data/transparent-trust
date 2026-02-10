import { BulkProject, BulkRow } from "@/types/bulkProject";
import { createApiClient } from "./apiClient";

/**
 * API client for project CRUD operations
 * These functions replace the localStorage-based storage with API calls
 */

// Type for database row format
interface DbRow {
  id: string;
  rowNumber: number;
  question: string;
  response: string;
  status: string;
  error?: string;
  sourceTab?: string;
  conversationHistory?: unknown;
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  remarks?: string;
  usedSkills?: unknown;
  usedFallback?: boolean;
  showRecommendation?: boolean;
  clarifyConversation?: unknown;
  // Flagging fields
  flaggedForReview?: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagNote?: string;
  // Flag resolution fields
  flagResolved?: boolean;
  flagResolvedAt?: string;
  flagResolvedBy?: string;
  flagResolutionNote?: string;
  // Queue fields
  queuedForReview?: boolean;
  queuedAt?: string;
  queuedBy?: string;
  queuedNote?: string;
  queuedReviewerId?: string;
  queuedReviewerName?: string;
  // Review workflow fields
  reviewStatus?: string;
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewNote?: string;
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  userEditedAnswer?: string;
  // Transparency fields
  outputData?: {
    transparency?: unknown;
  };
}

// Type for database project format
interface DbProject {
  id: string;
  name: string;
  sheetName: string;
  columns: string[];
  createdAt: string;
  lastModifiedAt: string;
  ownerName?: string;
  customerName?: string;
  status: string;
  notes?: string;
  categories?: string[];
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rows: DbRow[];
}

type ProjectPayload = ReturnType<typeof transformProjectToDb>;

const projectClient = createApiClient<DbProject, ProjectPayload, ProjectPayload>({
  baseUrl: "/api/projects",
  singularKey: "project",
  pluralKey: "projects",
});

export async function fetchAllProjects(): Promise<BulkProject[]> {
  const projects = await projectClient.fetchAll({ includeRows: "true" });
  return projects.map(transformProjectFromDb);
}

export async function fetchProject(id: string): Promise<BulkProject | null> {
  const project = await projectClient.fetch(id);
  return project ? transformProjectFromDb(project) : null;
}

export async function createProject(project: BulkProject): Promise<BulkProject> {
  const payload = transformProjectToDb(project);
  const created = await projectClient.create(payload);
  return transformProjectFromDb(created);
}

export async function updateProject(project: BulkProject): Promise<BulkProject> {
  const payload = transformProjectToDb(project);
  const updated = await projectClient.update(project.id, payload);
  return transformProjectFromDb(updated);
}

export async function deleteProject(id: string): Promise<void> {
  await projectClient.delete(id);
}

/**
 * Transform database project format to frontend BulkProject type
 */
function transformProjectFromDb(dbProject: DbProject): BulkProject {
  return {
    id: dbProject.id,
    name: dbProject.name,
    sheetName: dbProject.sheetName,
    columns: dbProject.columns,
    createdAt: dbProject.createdAt,
    lastModifiedAt: dbProject.lastModifiedAt,
    ownerName: dbProject.ownerName,
    customerName: dbProject.customerName,
    status: dbProject.status.toLowerCase() as "draft" | "in_progress" | "needs_review" | "finalized",
    notes: dbProject.notes,
    categories: dbProject.categories,
    reviewRequestedAt: dbProject.reviewRequestedAt,
    reviewRequestedBy: dbProject.reviewRequestedBy,
    reviewedAt: dbProject.reviewedAt,
    reviewedBy: dbProject.reviewedBy,
    rows: dbProject.rows.map((row): BulkRow => ({
      id: row.id,
      rowNumber: row.rowNumber,
      question: row.question,
      response: row.response,
      status: row.status.toLowerCase() as "pending" | "completed" | "error",
      error: row.error,
      sourceTab: row.sourceTab,
      conversationHistory: row.conversationHistory as { role: string; content: string }[] | undefined,
      confidence: row.confidence,
      sources: row.sources,
      reasoning: row.reasoning,
      inference: row.inference,
      remarks: row.remarks,
      usedSkills: row.usedSkills as BulkRow["usedSkills"],
      usedFallback: row.usedFallback,
      showRecommendation: row.showRecommendation,
      clarifyConversation: row.clarifyConversation as BulkRow["clarifyConversation"],
      // Flagging fields
      flaggedForReview: row.flaggedForReview,
      flaggedAt: row.flaggedAt,
      flaggedBy: row.flaggedBy,
      flagNote: row.flagNote,
      // Flag resolution fields
      flagResolved: row.flagResolved,
      flagResolvedAt: row.flagResolvedAt,
      flagResolvedBy: row.flagResolvedBy,
      flagResolutionNote: row.flagResolutionNote,
      // Queue fields
      queuedForReview: row.queuedForReview,
      queuedAt: row.queuedAt,
      queuedBy: row.queuedBy,
      queuedNote: row.queuedNote,
      queuedReviewerId: row.queuedReviewerId,
      queuedReviewerName: row.queuedReviewerName,
      // Review workflow fields
      reviewStatus: row.reviewStatus as BulkRow["reviewStatus"],
      reviewRequestedAt: row.reviewRequestedAt,
      reviewRequestedBy: row.reviewRequestedBy,
      reviewNote: row.reviewNote,
      assignedReviewerId: row.assignedReviewerId,
      assignedReviewerName: row.assignedReviewerName,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      userEditedAnswer: row.userEditedAnswer,
      // Transparency fields from outputData
      transparency: row.outputData?.transparency as BulkRow["transparency"],
    })),
  };
}

/**
 * Transform frontend BulkProject type to database format
 */
function transformProjectToDb(project: BulkProject) {
  return {
    name: project.name,
    sheetName: project.sheetName,
    columns: project.columns,
    ownerId: project.ownerId,
    notes: project.notes,
    status: project.status,
    categories: project.categories,
    // Review workflow fields
    reviewRequestedAt: project.reviewRequestedAt,
    reviewRequestedBy: project.reviewRequestedBy,
    reviewedAt: project.reviewedAt,
    reviewedBy: project.reviewedBy,
    rows: project.rows.map((row) => ({
      rowNumber: row.rowNumber,
      question: row.question,
      response: row.response,
      status: row.status,
      error: row.error,
      sourceTab: row.sourceTab,
      conversationHistory: row.conversationHistory,
      confidence: row.confidence,
      sources: row.sources,
      reasoning: row.reasoning,
      inference: row.inference,
      remarks: row.remarks,
      usedSkills: row.usedSkills,
      usedFallback: row.usedFallback,
      showRecommendation: row.showRecommendation,
      clarifyConversation: row.clarifyConversation,
      // Flagging fields
      flaggedForReview: row.flaggedForReview,
      flaggedAt: row.flaggedAt,
      flaggedBy: row.flaggedBy,
      flagNote: row.flagNote,
      // Flag resolution fields
      flagResolved: row.flagResolved,
      flagResolvedAt: row.flagResolvedAt,
      flagResolvedBy: row.flagResolvedBy,
      flagResolutionNote: row.flagResolutionNote,
      // Queue fields
      queuedForReview: row.queuedForReview,
      queuedAt: row.queuedAt,
      queuedBy: row.queuedBy,
      queuedNote: row.queuedNote,
      queuedReviewerId: row.queuedReviewerId,
      queuedReviewerName: row.queuedReviewerName,
      // Review workflow fields
      reviewStatus: row.reviewStatus,
      reviewRequestedAt: row.reviewRequestedAt,
      reviewRequestedBy: row.reviewRequestedBy,
      reviewNote: row.reviewNote,
      assignedReviewerId: row.assignedReviewerId,
      assignedReviewerName: row.assignedReviewerName,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      userEditedAnswer: row.userEditedAnswer,
      // Transparency fields
      transparency: row.transparency,
    })),
  };
}
