import { useState, useEffect } from 'react';
import type { SkillPreview } from '../types';

/**
 * Skill Selection Hook
 *
 * Manages the entire skill selection and batch processing flow:
 * - Loading skill recommendations
 * - Selecting/deselecting skills
 * - Starting batch processing
 * - Processing state
 */
export function useSkillSelection(projectId: string, projectStatus?: string) {
  const [showPanel, setShowPanel] = useState(false);
  const [skillPreviews, setSkillPreviews] = useState<SkillPreview[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState(15);
  const [error, setError] = useState<string | null>(null);

  // Auto-show panel if project is pending/draft
  useEffect(() => {
    if (projectStatus === 'PENDING' || projectStatus === 'DRAFT') {
      setShowPanel(true);
    }
    // Auto-start processing indicator
    if (projectStatus === 'PROCESSING') {
      setIsProcessing(true);
    }
  }, [projectStatus]);

  const loadSkills = async () => {
    setIsLoadingSkills(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/v2/projects/${projectId}/preview-skills?libraryId=knowledge`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load skills (${res.status})`);
      }

      const json = await res.json();

      if (json.success && json.data?.skills) {
        setSkillPreviews(json.data.skills);
        // Pre-select recommended skills (high + medium confidence)
        const recommendedIds = json.data.recommendedSkillIds;
        if (!recommendedIds || !Array.isArray(recommendedIds)) {
          console.warn('No recommendedSkillIds in preview-skills response', json.data);
        }
        setSelectedSkillIds(new Set(recommendedIds || []));
        setShowPanel(true);
      } else {
        setError(json.error || 'Failed to load skills');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const processBatch = async () => {
    if (selectedSkillIds.size === 0) {
      setError('Please select at least one skill');
      return false;
    }

    setError(null);

    try {
      const response = await fetch(`/api/v2/projects/${projectId}/process-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillIds: Array.from(selectedSkillIds),
          batchSize,
          libraryId: 'knowledge',
          modelSpeed: 'quality',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to start processing: ${response.status}`);
      }

      // Start processing indicator
      setIsProcessing(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
      return false;
    }
  };

  const generateAnswers = async () => {
    if (skillPreviews.length === 0) {
      // First click: load skills
      await loadSkills();
    } else {
      // Second click: start processing
      await processBatch();
    }
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    setShowPanel(false);
  };

  return {
    // State
    showPanel,
    skillPreviews,
    selectedSkillIds,
    isLoadingSkills,
    isProcessing,
    batchSize,
    error,

    // Actions
    setShowPanel,
    setBatchSize,
    loadSkills,
    processBatch,
    generateAnswers,
    toggleSkill,
    stopProcessing,
    setError,
  };
}
