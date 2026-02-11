/**
 * Foundational Skill Detail Page
 *
 * Shows foundational skill template details with ability to edit.
 * Uses UnifiedSkillDetail component for consistency.
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

interface FoundationalSkillDetailPageProps {
  params: Promise<{
    skillSlug: string;
  }>;
}

export default async function FoundationalSkillDetailPage({
  params,
}: FoundationalSkillDetailPageProps) {
  const { skillSlug } = await params;

  // Foundational skills have customerId=null but libraryId='customers'
  const skill = await getSkillWithRelations(skillSlug, 'customers', null);
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
      libraryId="customers"
      sourceAssignments={serializeSourceAssignments(rawSourceAssignments)}
      pendingSources={serializePendingSources(rawPendingAssignments)}
      relatedSkills={[]}
      backLink="/v2/customers?tab=foundational"
    />
  );
}
