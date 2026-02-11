/**
 * GTM Library - Skill Edit Page
 */

import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth-v2';
import { UnifiedSkillEditor } from '@/components/v2/UnifiedSkillEditor';
import { getSkillWithRelations } from '@/lib/v2/skill-detail-queries';
import { canAccessLibrary } from '@/lib/v2/teams';

export const dynamic = 'force-dynamic';

interface EditSkillPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditSkillPage({ params }: EditSkillPageProps) {
  const session = await getServerSession(authOptions);
  const { slug } = await params;

  // Check authentication
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Check library access
  if (!(await canAccessLibrary(session.user.id, 'gtm'))) {
    redirect('/v2');
  }

  // Fetch skill
  const skill = await getSkillWithRelations(slug, 'gtm', null);

  if (!skill) {
    notFound();
  }

  return (
    <UnifiedSkillEditor
      skill={skill}
      libraryId="gtm"
      backLink={`/v2/gtm/${slug}`}
    />
  );
}
