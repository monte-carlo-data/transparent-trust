/**
 * V2 Content - Templates Library Management
 */

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { LibraryPageWithTemplateModal } from './templates-page-client';

interface TemplatesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const params = await searchParams;

  const where: Record<string, unknown> = {
    status: 'ACTIVE',
    libraryId: 'templates',
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

  const [templatesRaw, total] = await Promise.all([
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
  const templates = templatesRaw.map((t) => ({
    ...t,
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <LibraryPageWithTemplateModal
      title="Templates"
      description="Manage output templates and document formats for collateral generation"
      libraryId="templates"
      basePath="/v2/content/templates"
      backLink={{ href: '/v2/content', label: 'Back to Content Assets' }}
      items={templates}
      total={total}
      searchTerm={params.search}
      statusFilter={params.status}
      icon="FileText"
      accentColor="bg-green-100 text-green-700"
    />
  );
}
