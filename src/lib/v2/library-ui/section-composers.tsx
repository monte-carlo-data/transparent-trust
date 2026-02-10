/**
 * Sidebar Section Composers
 *
 * Functions that compose sidebar sections for different libraries.
 */

import { AlertTriangle, LinkIcon } from 'lucide-react';
import type { SidebarSectionComponent } from './types';
import { isKnowledgeSkillBlock } from '@/types/v2';
import type { ScopeDefinition } from '@/types/v2';
import { ScopeCard } from '@/components/v2/ScopeCard';
import {
  IncorporatedSourcesSection,
  PendingSourcesSection,
  RelatedSkillsSection,
} from '@/components/v2/library-sections';

/**
 * Scope section - displays scopeDefinition
 */
export const scopeSection: SidebarSectionComponent = (context) => {
  const scopeDefinition = (context.block.attributes as { scopeDefinition?: ScopeDefinition })?.scopeDefinition;

  return <ScopeCard scope={scopeDefinition} skillTitle={context.skillTitle} />;
};

/**
 * Incorporated sources section
 */
export const incorporatedSourcesSection: SidebarSectionComponent = (context) => {
  return <IncorporatedSourcesSection incorporatedSources={context.incorporatedSources} />;
};

/**
 * Pending sources section
 */
export const pendingSourcesSection: SidebarSectionComponent = (context) => {
  return (
    <PendingSourcesSection
      pendingSources={context.pendingSources}
      blockId={context.skillId}
      blockTitle={context.skillTitle}
    />
  );
};

/**
 * Related skills section
 */
export const relatedSkillsSection: SidebarSectionComponent = (context) => {
  const linkHref = (skill: { id: string; slug: string | null }) => {
    const path =
      context.libraryId === 'knowledge'
        ? '/v2/knowledge'
        : context.libraryId === 'it'
          ? '/v2/it'
          : '/v2/gtm';
    return `${path}/${skill.slug || skill.id}`;
  };

  const title =
    context.libraryId === 'it'
      ? 'Related IT Skills'
      : context.libraryId === 'gtm'
        ? 'Related GTM Skills'
        : 'Related Skills';

  return (
    <RelatedSkillsSection title={title} skills={context.relatedSkills} linkHref={linkHref} />
  );
};

/**
 * Citations section (Knowledge-specific)
 */
export const citationsSection: SidebarSectionComponent = (context) => {
  if (!isKnowledgeSkillBlock(context.block)) return null;

  const citations = context.block.attributes.citations || [];
  if (citations.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <LinkIcon className="w-4 h-4 text-blue-600" />
        Source Citations
      </h3>
      <div className="space-y-2">
        {citations.map((citation) => (
          <div key={citation.id} className="text-sm">
            <div className="font-medium text-gray-700">{citation.label}</div>
            {citation.url && (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline block mt-1"
              >
                {citation.url.replace(/^https?:\/\//, '')}
              </a>
            )}
            {citation.reference && (
              <div className="text-xs text-gray-500 mt-1">{citation.reference}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Contradictions section (Knowledge-specific)
 */
export const contradictionsSection: SidebarSectionComponent = (context) => {
  if (!isKnowledgeSkillBlock(context.block)) return null;

  const contradictions = context.block.attributes.contradictions || [];
  if (contradictions.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        Contradictions Detected
      </h3>
      <div className="space-y-3">
        {contradictions.map((contradiction, idx) => (
          <div key={idx} className="text-sm border-l-2 border-yellow-300 pl-3">
            <div className="font-medium text-yellow-900">
              {contradiction.type.replace(/_/g, ' ')}
            </div>
            <div className="text-xs text-yellow-800 mt-1">{contradiction.description}</div>
            <div className="text-xs text-yellow-700 mt-2 space-y-1">
              <p className="font-medium">Source A: {contradiction.sourceA.label}</p>
              <p className="italic">&quot;{contradiction.sourceA.excerpt}&quot;</p>
              <p className="font-medium mt-2">Source B: {contradiction.sourceB.label}</p>
              <p className="italic">&quot;{contradiction.sourceB.excerpt}&quot;</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

