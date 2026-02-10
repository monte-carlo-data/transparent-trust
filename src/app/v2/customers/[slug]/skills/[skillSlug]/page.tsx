/**
 * Customer Skill Detail Page
 *
 * Shows customer-specific skill details with proper back navigation.
 * Uses UnifiedSkillDetail component for consistency with global skill libraries.
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
import { prisma } from '@/lib/prisma';

interface CustomerSkillDetailPageProps {
  params: Promise<{
    slug: string;
    skillSlug: string;
  }>;
}

export default async function CustomerSkillDetailPage({
  params,
}: CustomerSkillDetailPageProps) {
  const { slug, skillSlug } = await params;

  // First fetch the customer to get the customer ID
  const customer = await prisma.customer.findFirst({
    where: {
      slug,
      isActive: true,
    },
    select: { id: true },
  });

  if (!customer) {
    notFound();
  }

  // Then fetch the customer skill with the correct customerId
  const skill = await getSkillWithRelations(skillSlug, 'customers', customer.id);
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
      backLink={`/v2/customers/${slug}`}
      customerSlug={slug}
    />
  );
}
