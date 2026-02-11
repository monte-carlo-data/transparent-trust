'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trash2, ArrowRight, Loader2, Upload, Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
  rowCount: number;
  clusterCount: number;
  completedCount: number;
  errorCount: number;
  createdAt: string;
}

interface ProjectApiResponse {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  _count?: { rows?: number; clusters?: number };
  rows?: Array<{ status: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-600',
  PROCESSING: 'text-blue-600',
  ERROR: 'text-red-600',
  PARTIAL: 'text-yellow-600',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'text-gray-600';
}

function getProgressPercentage(project: Project): number {
  if (project.rowCount === 0) return 0;
  return Math.round(((project.completedCount + project.errorCount) / project.rowCount) * 100);
}

function mapApiResponseToProject(p: ProjectApiResponse): Project {
  const rows = p.rows ?? [];
  let completedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    if (row.status === 'COMPLETED') completedCount++;
    else if (row.status === 'ERROR') errorCount++;
  }

  return {
    id: p.id,
    name: p.name,
    status: p.status,
    rowCount: p._count?.rows ?? 0,
    clusterCount: p._count?.clusters ?? 0,
    completedCount,
    errorCount,
    createdAt: p.createdAt,
  };
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

interface ProjectCardProps {
  project: Project;
  isDeleting: boolean;
  onDelete: (id: string) => void;
}

function ProjectCard({ project, isDeleting, onDelete }: ProjectCardProps): React.ReactElement {
  const progress = getProgressPercentage(project);
  const processedCount = project.completedCount + project.errorCount;

  function handleDeleteClick(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    onDelete(project.id);
  }

  return (
    <Link
      href={`/v2/rfps/${project.id}`}
      className="block p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {project.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Created {new Date(project.createdAt).toLocaleDateString()}
            {project.clusterCount > 0 && (
              <span className="ml-2">
                · {project.clusterCount} {pluralize(project.clusterCount, 'section', 'sections')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded transition-colors"
            title="Delete project"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            {processedCount} of {project.rowCount} processed
          </span>
          <span className="text-gray-500 dark:text-gray-400">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs">
        <span className="text-gray-600 dark:text-gray-400">{project.completedCount} completed</span>
        {project.errorCount > 0 && (
          <span className="text-red-600 dark:text-red-400">{project.errorCount} errors</span>
        )}
        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 font-medium">
          View Project
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Projects Tab - Main entry point for RFP processing
 *
 * Contains:
 * 1. Link to /v2/rfps/new for creating new projects
 * 2. Project history list showing past projects
 */
export function ProjectsTab(): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects(): Promise<void> {
      try {
        const res = await fetch('/api/v2/projects?type=rfp&limit=50');

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          throw new Error(
            errorBody.error || `Failed to load projects (HTTP ${res.status})`
          );
        }

        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error || 'Failed to load projects from server');
        }

        if (!json.data?.projects) {
          console.error('Unexpected API response shape:', json);
          throw new Error('Unexpected response from server');
        }

        setProjects(json.data.projects.map(mapApiResponseToProject));
        setError(null); // Clear any previous errors on success
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load projects. Please check your connection and try again.'
        );
      } finally {
        setIsLoadingProjects(false);
      }
    }

    loadProjects();
  }, []);

  async function handleDeleteProject(projectId: string): Promise<void> {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    setDeletingId(projectId);
    setError(null); // Clear previous errors
    try {
      const res = await fetch(`/api/v2/projects/${projectId}`, { method: 'DELETE' });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(
          `Delete failed (HTTP ${res.status})${errorText ? ': ' + errorText : ''}`
        );
      }

      const json = await res.json();
      if (json.success) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        throw new Error(json.error || 'Failed to delete project');
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border border-blue-200 dark:border-gray-700 rounded-lg p-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Process RFP Questions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Upload your questions file (Excel or CSV), and we&apos;ll parse the questions and match them to your knowledge base.
            </p>
            <Link
              href="/v2/rfps/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Upload size={18} />
              Upload New RFP
            </Link>
          </div>
          <div className="flex-shrink-0 ml-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Plus size={40} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </section>

      {/* Project History Section */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Projects
        </h2>

        {isLoadingProjects ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              No projects yet. Use the wizard above to create your first project.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isDeleting={deletingId === project.id}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
