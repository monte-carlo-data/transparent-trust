'use client';

/**
 * Hook for Add to Skill Dialog functionality
 *
 * Provides reusable state and handlers for the AddSourceToSkillDialog
 * across all library pages (Knowledge, IT, GTM, Customer tabs)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AddSourceToSkillDialog } from './AddSourceToSkillDialog';
import type { LibraryId } from '@/types/v2';

interface Source {
  id: string;
  title: string;
}

interface Skill {
  id: string;
  title: string;
  slug: string | null;
}

interface UseAddToSkillDialogProps {
  libraryId: LibraryId;
  skills: Skill[];
  sources: Source[];
}

export function useAddToSkillDialog({ libraryId, skills, sources }: UseAddToSkillDialogProps) {
  const router = useRouter();
  const [sourceToAdd, setSourceToAdd] = useState<string | null>(null);
  const [selectedSourcesToAdd, setSelectedSourcesToAdd] = useState(new Set<string>());
  const [showMultiSelectDialog, setShowMultiSelectDialog] = useState(false);

  const isOpen = !!(sourceToAdd || showMultiSelectDialog);

  const handleShowAddToSkill = useCallback((sourceId: string) => {
    setSourceToAdd(sourceId);
  }, []);

  const handleShowAddMultipleToSkill = useCallback((sourceIds: string[]) => {
    setSelectedSourcesToAdd(new Set(sourceIds));
    setShowMultiSelectDialog(true);
  }, []);

  const handleClose = useCallback(() => {
    setSourceToAdd(null);
    setSelectedSourcesToAdd(new Set());
    setShowMultiSelectDialog(false);
  }, []);

  const handleSuccess = useCallback(() => {
    handleClose();
    router.refresh();
  }, [handleClose, router]);

  // Compute dialog props
  const dialogProps = useMemo(() => {
    const sourceIds = sourceToAdd ? sourceToAdd : Array.from(selectedSourcesToAdd);
    const sourceTitle = sourceToAdd
      ? sources.find((s) => s.id === sourceToAdd)?.title
      : undefined;
    const sourceTitles = showMultiSelectDialog && selectedSourcesToAdd.size > 0
      ? Array.from(selectedSourcesToAdd).map(
          (id) => sources.find((s) => s.id === id)?.title || ''
        )
      : undefined;

    return {
      sourceIds,
      sourceTitle,
      sourceTitles,
      skills: skills.map((s) => ({ id: s.id, title: s.title, slug: s.slug })),
      libraryId,
      isOpen,
      onClose: handleClose,
      onSuccess: handleSuccess,
    };
  }, [sourceToAdd, selectedSourcesToAdd, showMultiSelectDialog, sources, skills, libraryId, isOpen, handleClose, handleSuccess]);

  // Render function for the dialog
  const renderDialog = useCallback(() => {
    if (!isOpen) return null;
    return <AddSourceToSkillDialog {...dialogProps} />;
  }, [isOpen, dialogProps]);

  return {
    // Handlers to pass to source wizards/tabs
    onShowAddToSkill: handleShowAddToSkill,
    onShowAddMultipleToSkill: handleShowAddMultipleToSkill,
    // Dialog render function
    renderDialog,
    // For manual control if needed
    isOpen,
    handleClose,
  };
}
