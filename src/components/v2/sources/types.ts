/**
 * Shared types for source wizard components
 */

import type { LibraryId } from '@/types/v2';

export interface SourceWizardProps {
  libraryId: LibraryId;
  customerId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  buttonColor?: 'blue' | 'purple' | 'green' | 'orange';
  buttonLabel?: string;
  onShowAddToSkill?: (sourceId: string) => void;
  onShowAddMultipleToSkill?: (sourceIds: string[]) => void;
}

export interface StagedSourceItem {
  id: string;
  title: string;
  content: string | null;
  contentPreview?: string | null;
  sourceType: string;
  stagedAt: Date;
  metadata: unknown;
  ignoredAt?: Date | null;
  ignoredBy?: string | null;
  assignments?: Array<{
    id: string;
    incorporatedAt: Date | null;
    incorporatedBy: string | null;
    block: {
      id: string;
      title: string;
      slug: string | null;
      isActive?: boolean;
    };
  }>;
}

// Helper to compute source status from StagedSourceItem
export function getSourceStatus(source: StagedSourceItem): 'NEW' | 'REVIEWED' | 'IGNORED' {
  if (source.ignoredAt) return 'IGNORED';
  if (
    source.assignments?.some(
      (a) => a.incorporatedAt && (a.block?.isActive ?? true)
    )
  )
    return 'REVIEWED';
  return 'NEW';
}
