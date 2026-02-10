/**
 * Customer Skills - Skill Edit Page
 */

import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { UnifiedSkillEditor } from '@/components/v2/UnifiedSkillEditor';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';
import { getSkillWithRelations } from '@/lib/v2/skill-detail-queries';

export const dynamic = 'force-dynamic';

interface EditSkillPageProps {
  params: Promise<{ slug: string; skillSlug: string }>;
}

export default async function EditSkillPage({ params }: EditSkillPageProps) {
  const session = await getServerSession(authOptions);
  const { slug, skillSlug } = await params;

  // Check authentication
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Fetch customer to get ID
  const customer = await prisma.customer.findUnique({
    where: { slug },
  });

  if (!customer) {
    notFound();
  }

  // Check customer access
  if (!(await canAccessCustomer(session.user.id, customer.id))) {
    redirect('/v2');
  }

  // Fetch skill using shared helper for proper typing
  const skill = await getSkillWithRelations(skillSlug, 'customers', customer.id);

  if (!skill) {
    notFound();
  }

  return (
    <UnifiedSkillEditor
      skill={skill}
      libraryId="customers"
      backLink={`/v2/customers/${slug}/skills/${skillSlug}`}
    />
  );
}
