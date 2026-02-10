'use client';

/**
 * Unified Skill Detail Component
 *
 * Config-driven detail page for all skill libraries: knowledge, IT, GTM, and customer-scoped skills.
 * All library-specific behavior comes from library-config.ts, not hardcoded.
 * This ensures consistency across all skill libraries and eliminates duplication.
 */

import { FileText, Zap } from 'lucide-react';
import { SkillDetailLayout } from '@/components/v2/SkillDetailLayout';
import { SkillDetailTabbedContent, type SkillDetailTab } from '@/components/v2/SkillDetailTabbedContent';
import { UnifiedMetadataBar, UnifiedSidebar } from '@/components/v2/library-sections';
import { LLMTraceTab } from './tabs/LLMTraceTab';
import { EditSkillButton } from './EditSkillButton';
import { mapIncorporatedSources, mapPendingSources, mapRelatedSkills } from '@/lib/v2/library-ui/mappers';
import { getLibraryConfig, getIconColorClass } from '@/lib/library-config';
import { renderIcon } from '@/lib/icon-utils';
import type { TypedBuildingBlock, LibraryId } from '@/types/v2';

export interface UnifiedSkillDetailProps {
  /** The skill/block to display */
  skill: TypedBuildingBlock;
  /** The library this skill belongs to */
  libraryId: LibraryId;
  /** Source assignments (incorporated sources) */
  sourceAssignments: Array<{
    id: string;
    stagedSourceId: string;
    incorporatedAt?: string | null;
    title: string;
    sourceType: string;
    content?: string;
    contentLength?: number;
  }>;
  /** Pending sources awaiting incorporation (assigned but not yet refreshed) */
  pendingSources: Array<{
    id: string;
    title: string;
    sourceType: string;
    content?: string;
    contentLength?: number;
  }>;
  /** Related skills (for the sidebar) */
  relatedSkills?: Array<{
    id: string;
    title: string;
    slug: string | null;
  }>;
  /** Custom back link (uses library config default if not provided) */
  backLink?: string;
  /** Custom delete redirect URL (uses library config basePath if not provided) */
  deleteRedirectUrl?: string;
  /** Customer slug for customer-scoped skills */
  customerSlug?: string;
}

export function UnifiedSkillDetail({
  skill,
  libraryId,
  sourceAssignments,
  pendingSources,
  relatedSkills = [],
  backLink,
  deleteRedirectUrl,
  customerSlug,
}: UnifiedSkillDetailProps) {
  const config = getLibraryConfig(libraryId);

  // Map source assignments to incorporated/pending format
  const incorporatedSourcesForSidebar = mapIncorporatedSources(sourceAssignments);
  const mappedPendingSources = mapPendingSources(pendingSources);
  const mappedRelatedSkills = mapRelatedSkills(relatedSkills);

  // Map incorporated sources for refresh dialog (includes content for token calculation)
  const incorporatedSourcesForRefresh = sourceAssignments
    .filter((sa) => sa.incorporatedAt !== null && sa.incorporatedAt !== undefined)
    .map((sa) => ({
      id: sa.stagedSourceId,
      title: sa.title,
      sourceType: sa.sourceType,
      content: sa.content,
      contentLength: sa.contentLength ?? sa.content?.length ?? 0,
    }));

  // Use provided values or defaults from config
  const finalBackLink = backLink || config.basePath;
  const finalDeleteRedirectUrl = deleteRedirectUrl || config.basePath;

  // Extract LLM trace from attributes
  const attributes = skill.attributes as {
    llmTrace?: {
      systemPrompt: string;
      userPrompt: string;
      rawResponse: string;
      compositionId: string;
      blockIds: string[];
      model: string;
      tokens: {
        input: number;
        output: number;
      };
      timestamp: string;
    };
  };
  const llmTrace = attributes?.llmTrace;

  // Build tabs array
  const tabs: SkillDetailTab[] = [
    {
      id: 'content',
      label: 'Content',
      icon: FileText,
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{config.mainContentHeading}</h2>
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto">
              {skill.content}
            </pre>
          </div>
        </div>
      ),
    },
    {
      id: 'trace',
      label: 'LLM Trace',
      icon: Zap,
      content: <LLMTraceTab trace={llmTrace} />,
    },
  ];

  return (
    <SkillDetailLayout
      libraryId={libraryId}
      skill={skill}
      backLink={finalBackLink}
      backLabel={config.backLabel}
      icon={renderIcon(config.iconId, `w-8 h-8 ${getIconColorClass(config.iconId)}`)}
      iconBgColor={config.iconBgColor}
      metadataBar={<UnifiedMetadataBar block={skill} libraryId={libraryId} />}
      pendingSources={pendingSources}
      incorporatedSources={incorporatedSourcesForRefresh}
      tabbedContent={
        <SkillDetailTabbedContent
          tabs={tabs}
          defaultTab="content"
          sidebar={
            <UnifiedSidebar
              block={skill}
              libraryId={libraryId}
              skillId={skill.id}
              skillTitle={skill.title}
              incorporatedSources={incorporatedSourcesForSidebar}
              pendingSources={mappedPendingSources}
              relatedSkills={mappedRelatedSkills}
            />
          }
        />
      }
      editButton={<EditSkillButton skill={skill} libraryId={libraryId} customerSlug={customerSlug} />}
      deleteRedirectUrl={finalDeleteRedirectUrl}
    />
  );
}

