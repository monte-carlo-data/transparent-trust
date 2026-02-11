/**
 * V2 Knowledge Skill Detail Page
 *
 * Config-driven detail page using UnifiedSkillDetail component.
 * All library-specific behavior comes from library-config.ts.
 */

import type { SkillAttributes } from '@/types/v2';
import { UnifiedSkillDetail } from '@/components/v2/UnifiedSkillDetail';
import {
  getSkillWithRelations,
  getSourceAssignments,
  getPendingAssignments,
  getRelatedSkillsBySlug,
  serializeSourceAssignments,
  serializePendingSources,
} from '@/lib/v2/skill-detail-queries';
import { notFound } from 'next/navigation';

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const { slug } = await params;

  const skill = await getSkillWithRelations(slug, 'knowledge');
  if (!skill) {
    notFound();
  }

  const attrs = skill.attributes as SkillAttributes;

  const [rawSourceAssignments, rawPendingAssignments, relatedSkills] = await Promise.all([
    getSourceAssignments(skill.id),
    getPendingAssignments(skill.id),
    getRelatedSkillsBySlug(skill.id, attrs?.relatedSlugs || [], 'knowledge'),
  ]);

  return (
    <UnifiedSkillDetail
      skill={skill}
      libraryId="knowledge"
      sourceAssignments={serializeSourceAssignments(rawSourceAssignments)}
      pendingSources={serializePendingSources(rawPendingAssignments)}
      relatedSkills={relatedSkills}
    />
  );
}
