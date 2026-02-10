import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/projectApi";
import { BulkProject } from "@/types/bulkProject";

// Query keys for cache management
export const projectQueryKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

// Fetch all projects
export function useProjects() {
  return useQuery({
    queryKey: projectQueryKeys.all,
    queryFn: fetchAllProjects,
  });
}

// Fetch single project
export function useProject(id: string) {
  return useQuery({
    queryKey: projectQueryKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

// Create project mutation
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}

// Update project mutation
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(data.id) });
    },
  });
}

// Delete project mutation
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}

// Helper function to calculate project stats
export function getProjectStats(project: BulkProject) {
  const rows = project.rows;
  const total = rows.length;
  let completed = 0,
    high = 0,
    medium = 0,
    low = 0,
    errors = 0,
    flagged = 0;

  for (const row of rows) {
    if (row.response && row.response.trim().length > 0) completed++;
    if (row.confidence) {
      const conf = row.confidence.toLowerCase();
      if (conf.includes("high")) high++;
      else if (conf.includes("medium")) medium++;
      else if (conf.includes("low")) low++;
    }
    if (row.status === "error") errors++;
    if (row.flaggedForReview) flagged++;
  }

  return { total, completed, high, medium, low, errors, flagged };
}

// Status display helpers
export function getStatusColor(status: BulkProject["status"]) {
  switch (status) {
    case "draft":
      return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
    case "in_progress":
      return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" };
    case "needs_review":
      return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" };
    case "finalized":
      return { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
  }
}

export function getStatusLabel(status: BulkProject["status"]) {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_progress":
      return "In Progress";
    case "needs_review":
      return "Needs Review";
    case "finalized":
      return "Finalized";
    default:
      return status;
  }
}
