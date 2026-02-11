/**
 * V2 Content Assets Landing Page
 *
 * Central hub for managing personas and templates.
 * Uses AdminShell for consistent layout and LandingCard for navigation.
 */

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { AdminShell, LandingCard } from '@/components/v2/admin';

async function getContentStats() {
  try {
    const [personaCount, templateCount] = await Promise.all([
      prisma.buildingBlock.count({ where: { libraryId: 'personas', status: 'ACTIVE' } }),
      prisma.buildingBlock.count({ where: { libraryId: 'templates', status: 'ACTIVE' } }),
    ]);

    return { personaCount, templateCount };
  } catch (error) {
    console.error('Failed to load content stats', error);
    return { personaCount: 0, templateCount: 0 };
  }
}

export default async function ContentAssetsPage() {
  const { personaCount, templateCount } = await getContentStats();

  return (
    <AdminShell
      title="Content Assets"
      description="Manage personas and templates for AI-generated content"
      icon="Palette"
      backLink={{ href: '/v2/admin', label: 'Back to Admin' }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LandingCard
          href="/v2/content/personas"
          title="Personas"
          description="Communication personas and voice profiles for different contexts. Define tone, style, and audience for AI responses."
          icon="Users"
          iconColor="bg-pink-100 text-pink-700"
          stat={{
            value: personaCount,
            label: personaCount === 1 ? 'persona' : 'personas',
            color: 'text-pink-600',
          }}
          actionLabel="Manage Personas"
        />

        <LandingCard
          href="/v2/content/templates"
          title="Templates"
          description="Output templates and document formats for collateral generation. Structure how AI responses are formatted."
          icon="FileText"
          iconColor="bg-green-100 text-green-700"
          stat={{
            value: templateCount,
            label: templateCount === 1 ? 'template' : 'templates',
            color: 'text-green-600',
          }}
          actionLabel="Manage Templates"
        />
      </div>
    </AdminShell>
  );
}
