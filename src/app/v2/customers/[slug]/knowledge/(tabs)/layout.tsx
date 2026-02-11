/**
 * Customer Knowledge Base Layout
 *
 * Shared layout for customer-scoped knowledge base tabs.
 * Fetches customer data and provides it via context.
 */

import { notFound } from 'next/navigation';
import {
  getCustomerBySlug,
  getCustomerById,
  getCustomerSkills,
} from '@/lib/v2/customers/customer-service';
import { prisma } from '@/lib/prisma';
import { CustomerKnowledgeProvider } from './context';

export const dynamic = 'force-dynamic';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function CustomerKnowledgeLayout({ children, params }: LayoutProps) {
  const { slug } = await params;

  const customer = await getCustomerBySlug(slug) || await getCustomerById(slug);
  if (!customer) {
    notFound();
  }

  // Helper to fetch staged sources with consistent query structure
  function fetchStagedSourcesByType(sourceType: string) {
    return prisma.stagedSource.findMany({
      where: {
        customerId: customer!.id,
        sourceType,
      },
      orderBy: { stagedAt: 'desc' },
      include: {
        assignments: {
          where: { incorporatedAt: { not: null }, block: { status: 'ACTIVE' } },
          include: {
            block: {
              select: { id: true, title: true, slug: true, status: true },
            },
          },
        },
      },
    });
  }

  // Fetch skills and sources in parallel
  const [customerSkills, urlSources, documentSources, slackSources, gongSources] =
    await Promise.all([
      getCustomerSkills(customer.id),
      fetchStagedSourcesByType('url'),
      fetchStagedSourcesByType('document'),
      fetchStagedSourcesByType('slack'),
      fetchStagedSourcesByType('gong'),
    ]);

  const contextValue = {
    customerSlug: slug,
    customerId: customer.id,
    customerTitle: customer.company,
    skills: customerSkills,
    totalSkills: customerSkills.length,
    sourcesByType: {
      url: urlSources,
      document: documentSources,
      slack: slackSources,
      gong: gongSources,
    },
  };

  return <CustomerKnowledgeProvider value={contextValue}>{children}</CustomerKnowledgeProvider>;
}
