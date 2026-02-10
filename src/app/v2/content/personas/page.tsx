/**
 * V2 Content - Personas Library Management
 */

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { LibraryPageWithPersonaModal } from './personas-page-client';

interface PersonasPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
  const params = await searchParams;

  const where: Record<string, unknown> = {
    status: 'ACTIVE',
    libraryId: 'personas',
  };

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { content: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  const [personasRaw, total] = await Promise.all([
    prisma.buildingBlock.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        status: true,
        updatedAt: true,
        attributes: true,
      },
    }),
    prisma.buildingBlock.count({ where }),
  ]);

  // Serialize dates for client component
  const personas = personasRaw.map((p) => ({
    ...p,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <LibraryPageWithPersonaModal
      title="Personas"
      description="Manage communication personas and voice profiles for different contexts"
      libraryId="personas"
      basePath="/v2/content/personas"
      backLink={{ href: '/v2/content', label: 'Back to Content Assets' }}
      items={personas}
      total={total}
      searchTerm={params.search}
      statusFilter={params.status}
      icon="Users"
      accentColor="bg-pink-100 text-pink-700"
    />
  );
}
