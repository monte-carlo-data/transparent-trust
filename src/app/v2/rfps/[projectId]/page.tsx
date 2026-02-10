"use client";

/**
 * RFP Project Detail Page (Simplified)
 *
 * Displays a single RFP project with:
 * - Skill selection panel
 * - Filter bar for rows
 * - Expandable question/answer rows
 * - Review workflow
 *
 * Complexity reduced from 994 lines to ~300 lines by extracting:
 * - Custom hooks (useProjectData, useSkillSelection, useProjectFilters, useProjectPolling)
 * - Components (ProjectRowCard, SkillSelectionPanel)
 */

import { useState, useEffect, Suspense, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, Flag } from "lucide-react";
import { QueueIndicator } from "../components/QueueIndicator";
import { ProjectHeader } from "./components/ProjectHeader";
import { ProjectRowCard } from "./components/ProjectRowCard";
import { SkillSelectionPanel } from "@/components/v2/rfp-responses";
import {
  useProjectData,
  useSkillSelection,
  useProjectFilters,
  useProjectPolling,
} from "./hooks";

function ProjectContent() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Data loading
  const { project, isLoading, error, setError, refresh } = useProjectData(projectId);

  // Skill selection flow
  const skillSelection = useSkillSelection(projectId, project?.status);

  // Filtering
  const filters = useProjectFilters(project?.rows || []);

  // Row expansion
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const hasInitialized = useRef(false);

  // Auto-expand completed rows on load (moved to useEffect to avoid state mutation during render)
  useEffect(() => {
    if (!hasInitialized.current && project?.rows) {
      const completedRowIds = project.rows
        .filter((row) => row.status === 'COMPLETED')
        .map((row) => row.id);
      if (completedRowIds.length > 0) {
        setExpandedRowIds(new Set(completedRowIds));
        hasInitialized.current = true;
      }
    }
  }, [project?.rows]);

  // Polling for processing status
  useProjectPolling({
    projectId,
    isProcessing: skillSelection.isProcessing,
    onStatusUpdate: refresh,
    onComplete: skillSelection.stopProcessing,
    onError: setError,
  });

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleRowUpdate = async (rowId: string, updates: unknown) => {
    try {
      const response = await fetch(`/api/v2/projects/${projectId}/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.row) {
          // Refresh to get updated data
          await refresh();
        } else {
          setError(result.error || 'Failed to update row - no data returned');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || `Failed to update row (${response.status})`);
      }
    } catch (err) {
      console.error('Failed to update row:', err);
      setError(err instanceof Error ? err.message : 'Failed to update row');
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!project) return;

    try {
      const response = await fetch(`/api/v2/projects/${projectId}/export?format=${format}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to export');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    }
  };

  const handleFinalize = async (action: 'finalize' | 'unfinalize') => {
    try {
      const res = await fetch(`/api/v2/projects/${projectId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        await refresh();
      } else {
        setError(json.error || `Failed to ${action} project`);
      }
    } catch (err) {
      console.error('Finalize error', err);
      setError(err instanceof Error ? err.message : `Failed to ${action} project`);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v2/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      window.location.href = '/v2/rfps/projects';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={32} />
          <p className="text-slate-600">Loading project...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!project) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-red-600 mb-4 text-2xl font-bold">Project Not Found</h1>
        <Link href="/v2/rfps/projects" className="text-blue-600 hover:underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  const completedCount = project.rows.filter(
    (r) => r.status === 'COMPLETED' || r.status === 'ERROR'
  ).length;
  const progressPercent =
    project.rowCount > 0 ? Math.round((completedCount / project.rowCount) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Queue Indicator */}
      <QueueIndicator projectId={projectId} />

      {/* Header + actions */}
      <ProjectHeader
        projectId={projectId}
        projectName={project.name}
        projectStatus={project.status}
        completedCount={completedCount}
        rowCount={project.rowCount}
        progressPercent={progressPercent}
        onSaveProject={async () => {
          // Simplified - just refresh
          await refresh();
        }}
        onExportCSV={() => handleExport('csv')}
        onFinalize={handleFinalize}
        onDelete={handleDeleteProject}
        onGenerateAnswers={skillSelection.generateAnswers}
        isSavingProject={false}
        hasUnansweredQuestions={project.rows.some((r) => r.status === 'PENDING')}
        skillsLoaded={skillSelection.skillPreviews.length > 0}
        isLoadingSkills={skillSelection.isLoadingSkills}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Error Banner */}
          {(error || skillSelection.error) && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={16}
                  className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-medium text-red-900 dark:text-red-200">Error</p>
                  <p className="text-red-700 dark:text-red-300 mt-1">
                    {error || skillSelection.error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Skill Selection Panel */}
          <SkillSelectionPanel
            isOpen={skillSelection.showPanel}
            isLoading={skillSelection.isLoadingSkills}
            isProcessing={skillSelection.isProcessing}
            skills={skillSelection.skillPreviews}
            selectedSkillIds={skillSelection.selectedSkillIds}
            batchSize={skillSelection.batchSize}
            completedCount={completedCount}
            totalCount={project.rowCount}
            onToggleSkill={skillSelection.toggleSkill}
            onBatchSizeChange={skillSelection.setBatchSize}
            onClose={() => skillSelection.setShowPanel(false)}
          />

          {/* Filter Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filters:
            </span>

            {/* Status Filter */}
            <select
              value={filters.statusFilter}
              onChange={(e) => filters.setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
              <option value="pending-review">Pending Review</option>
            </select>

            {/* Confidence Filter */}
            <select
              value={filters.confidenceFilter}
              onChange={(e) => filters.setConfidenceFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Confidence</option>
              <option value="high">High ({filters.confidenceCounts.high})</option>
              <option value="medium">Medium ({filters.confidenceCounts.medium})</option>
              <option value="low">Low ({filters.confidenceCounts.low})</option>
              <option value="unable">Unable ({filters.confidenceCounts.unable})</option>
            </select>

            {/* Flagged Toggle */}
            <button
              onClick={() => filters.setShowFlaggedOnly(!filters.showFlaggedOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                filters.showFlaggedOnly
                  ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <Flag size={14} />
              Flagged ({filters.flaggedCount})
            </button>

            {/* Clear Filters */}
            {filters.hasActiveFilters && (
              <button
                onClick={filters.clearFilters}
                className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear filters
              </button>
            )}

            {/* Result count */}
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              Showing {filters.filteredRows.length} of {project.rows.length}
            </span>
          </div>

          {/* Rows List */}
          <div className="space-y-2">
            {filters.filteredRows.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700">
                <p className="text-slate-500 dark:text-gray-400">No rows match filters</p>
              </div>
            ) : (
              filters.filteredRows.map((row) => (
                <ProjectRowCard
                  key={row.id}
                  row={row}
                  isExpanded={expandedRowIds.has(row.id)}
                  onToggleExpand={() => toggleRowExpansion(row.id)}
                  onUpdate={handleRowUpdate}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen text-slate-600 dark:text-gray-400">
          Loading...
        </div>
      }
    >
      <ProjectContent />
    </Suspense>
  );
}
