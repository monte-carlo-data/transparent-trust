/**
 * Unified skill detail layout component
 *
 * Provides consistent structure across all library detail pages:
 * - Header with icon, title, status badges
 * - Metadata bar (library-specific)
 * - Two-column layout: main content + sidebar sections
 *
 * Accepts library-specific content via slots/children pattern
 */

import Link from 'next/link';
import { ArrowLeft, CheckCircle, Zap } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { LibraryId } from '@/types/v2';
import { SkillRefreshButton } from './SkillRefreshButton';
import { SkillFormatRefreshButton } from './SkillFormatRefreshButton';
import { DeleteSkillButton } from './DeleteSkillButton';
import { cn } from '@/lib/utils';

interface SkillDetailLayoutProps {
  libraryId: LibraryId;
  skill: {
    id: string;
    title: string;
    summary: string | null;
    status: string;
    content: string;
  };
  backLink: string;
  backLabel: string;
  icon: ReactNode;
  iconBgColor: string;
  metadataBar: ReactNode;
  tabbedContent: ReactNode;
  /** Pending sources for skill refresh (lazy incorporation) */
  pendingSources?: Array<{
    id: string;
    title: string;
    sourceType: string;
    content?: string;
    contentLength?: number;
  }>;
  /** Already incorporated sources */
  incorporatedSources?: Array<{
    id: string;
    title: string;
    sourceType: string;
    content?: string;
    contentLength?: number;
  }>;
  /** Edit button component (self-contained with modal) */
  editButton?: ReactNode;
  showDeleteButton?: boolean;
  deleteRedirectUrl?: string;
  onPublish?: (skillId: string) => Promise<void>;
  onArchive?: (skillId: string) => Promise<void>;
}

export function SkillDetailLayout({
  libraryId,
  skill,
  backLink,
  backLabel,
  icon,
  iconBgColor,
  metadataBar,
  tabbedContent,
  pendingSources = [],
  incorporatedSources = [],
  editButton,
  showDeleteButton = true,
  deleteRedirectUrl,
  onPublish,
  onArchive,
}: SkillDetailLayoutProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handlePublish = async () => {
    if (!onPublish) return;
    setIsPublishing(true);
    try {
      await onPublish(skill.id);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;
    setIsArchiving(true);
    try {
      await onArchive(skill.id);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href={backLink}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div
            className={cn('w-16 h-16 rounded-xl flex items-center justify-center', iconBgColor)}
          >
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{skill.title}</h1>
              {skill.status === 'DRAFT' && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700">
                  Pending Review
                </span>
              )}
              {skill.status === 'ACTIVE' && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Active
                </span>
              )}
            </div>
            {skill.summary && <p className="text-gray-600">{skill.summary}</p>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {skill.status === 'DRAFT' && onPublish && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
          {skill.status === 'ACTIVE' && onArchive && (
            <button
              onClick={handleArchive}
              disabled={isArchiving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
            >
              Archive
            </button>
          )}
          <SkillRefreshButton
            skillId={skill.id}
            skillTitle={skill.title}
            libraryId={libraryId}
            pendingSources={pendingSources}
            skillContent={skill.content || ''}
            incorporatedSources={incorporatedSources}
          />
          <SkillFormatRefreshButton
            skillId={skill.id}
            skillTitle={skill.title}
          />
          {editButton}
          {showDeleteButton && deleteRedirectUrl && (
            <DeleteSkillButton
              skillId={skill.id}
              skillTitle={skill.title}
              libraryId={libraryId}
              redirectUrl={deleteRedirectUrl}
            />
          )}
        </div>
      </div>

      {/* Metadata Bar - Library-specific */}
      <div className="grid grid-cols-3 gap-4 mb-8">{metadataBar}</div>

      {/* Tabbed Content - includes sidebar */}
      {tabbedContent}
    </div>
  );
}
