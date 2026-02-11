/**
 * V2 Talent Skill Detail Page
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

interface TalentSkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TalentSkillDetailPage({ params }: TalentSkillDetailPageProps) {
  const { slug } = await params;

  const skill = await getSkillWithRelations(slug, 'talent');
  if (!skill) {
    notFound();
  }

  const attrs = skill.attributes as SkillAttributes;

  const [rawSourceAssignments, rawPendingAssignments, relatedSkills] = await Promise.all([
    getSourceAssignments(skill.id),
    getPendingAssignments(skill.id),
    getRelatedSkillsBySlug(skill.id, attrs?.relatedSlugs || [], 'talent'),
  ]);

  return (
    <UnifiedSkillDetail
      skill={skill}
      libraryId="talent"
      sourceAssignments={serializeSourceAssignments(rawSourceAssignments)}
      pendingSources={serializePendingSources(rawPendingAssignments)}
      relatedSkills={relatedSkills}
    />
  );
}
