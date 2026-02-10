/**
 * Customer Activity Tab
 *
 * Shows customer-related projects and chat sessions.
 */

import { notFound } from 'next/navigation';
import {
  getCustomerBySlug,
  getCustomerById,
} from '@/lib/v2/customers/customer-service';
import { ActivityTab } from '../components/ActivityTab';
import { prisma } from '@/lib/prisma';

interface ActivityPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { slug } = await params;

  const customer = await getCustomerBySlug(slug) || await getCustomerById(slug);
  if (!customer) {
    notFound();
  }

  // Fetch activity data
  const [projects, chatSessions] = await Promise.all([
    prisma.bulkProject.findMany({
      where: { customerId: customer.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        projectType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { rows: true } },
      },
    }),
    prisma.chatSession.findMany({
      where: { customerId: customer.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        sessionType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return (
    <div className="p-8">
      <ActivityTab
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          projectType: p.projectType,
          status: p.status,
          rowCount: p._count.rows,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }))}
        chatSessions={chatSessions.map((s) => ({
          id: s.id,
          title: s.title,
          sessionType: s.sessionType,
          status: s.status,
          messageCount: s._count.messages,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }))}
      />
    </div>
  );
}
