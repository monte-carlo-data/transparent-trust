'use client';

/**
 * Generic Library Context Factory
 *
 * Creates context providers and hooks for any library's route-based navigation.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { SkillItem, StagedSourceItem } from '@/components/v2/UnifiedLibraryClient';
import type { BotInteraction } from '@/lib/v2/bot-interactions';
import type { LibraryId } from '@/types/v2/building-block';
import type { SourceType } from '@/lib/library-config';

export interface LibraryContextValue {
  libraryId: LibraryId;
  skills: SkillItem[];
  totalSkills: number;
  pendingReview: number;
  activeSkills: number;
  sourcesByType: Partial<Record<SourceType, StagedSourceItem[]>>;
  pendingBot: BotInteraction[];
  currentUser: {
    id: string;
    name: string;
    email?: string;
    image?: string;
  } | null;
  isAdmin: boolean;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({
  value,
  children,
}: {
  value: LibraryContextValue;
  children: ReactNode;
}) {
  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraryContext(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibraryContext must be used within a LibraryProvider');
  }
  return context;
}
