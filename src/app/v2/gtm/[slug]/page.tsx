/**
 * V2 GTM Skill Detail Page
 *
 * Config-driven detail page using UnifiedSkillDetail component.
 * All library-specific behavior comes from library-config.ts.
 */

import { UnifiedSkillDetail } from '@/components/v2/UnifiedSkillDetail';
import {
  getSkillWithRelations,
  getSourceAssignments,
  getPendingAssignments,
  serializeSourceAssignments,
  serializePendingSources,
} from '@/lib/v2/skill-detail-queries';
import { notFound } from 'next/navigation';

interface GTMSkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function GTMSkillDetailPage({ params }: GTMSkillDetailPageProps) {
  const { slug } = await params;

  const skill = await getSkillWithRelations(slug, 'gtm');
  if (!skill) {
    notFound();
  }

  const [rawSourceAssignments, rawPendingAssignments] = await Promise.all([
    getSourceAssignments(skill.id),
    getPendingAssignments(skill.id),
  ]);

  return (
    <UnifiedSkillDetail
      skill={skill}
      libraryId="gtm"
      sourceAssignments={serializeSourceAssignments(rawSourceAssignments)}
      pendingSources={serializePendingSources(rawPendingAssignments)}
      relatedSkills={[]}
    />
  );
}
