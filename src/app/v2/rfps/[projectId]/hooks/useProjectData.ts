import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types';

/**
 * Project Data Hook
 *
 * Handles loading and refreshing project data.
 * Returns project state with refresh capability.
 */
export function useProjectData(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/v2/projects/${projectId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.project) {
          setProject(result.data.project);
          return result.data.project;
        } else {
          setError(result.error || 'Project data was missing from response');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || `Failed to load project (${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [projectId]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/v2/projects/${projectId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.project) {
          setProject(result.data.project);
          return result.data.project;
        } else {
          console.error('Failed to refresh project - invalid response:', result);
          setError(result.error || 'Project data was missing from response');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to refresh project:', response.status, errorData);
        setError(errorData.error || `Failed to refresh project (${response.status})`);
      }
    } catch (err) {
      console.error('Failed to refresh project:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh project data');
    }
    return null;
  }, [projectId]);

  // Load on mount
  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId, loadProject]);

  return {
    project,
    isLoading,
    error,
    setError,
    refresh,
  };
}
