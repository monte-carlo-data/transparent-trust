/**
 * Customer Detail Layout
 *
 * Shared layout for all customer detail tabs with:
 * - Back navigation
 * - Customer header (name, tier, status)
 * - Tab navigation (Profile, Knowledge Base, Activity, Audits, Views)
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import {
  getCustomerBySlug,
  getCustomerById,
} from '@/lib/v2/customers/customer-service';
import { getActiveViews } from '@/lib/v2/views';
import { CustomerTabNavigation } from './components/CustomerTabNavigation';
import type { CustomerProfileAttributes } from '@/types/v2';
import { prisma } from '@/lib/prisma';

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function CustomerLayout({ children, params }: CustomerLayoutProps) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  const customer = await getCustomerBySlug(slug) || await getCustomerById(slug);
  if (!customer) {
    notFound();
  }

  // Get user's first team for configuration UI
  let teamId: string | undefined;
  if (session?.user?.id) {
    const membership = await prisma.teamMembership.findFirst({
      where: { userId: session.user.id },
    });
    teamId = membership?.teamId;
  }

  // Fetch views for tab navigation and activity count
  const [views, projects, chatSessions] = await Promise.all([
    getActiveViews(),
    prisma.bulkProject.count({ where: { customerId: customer.id } }),
    prisma.chatSession.count({ where: { customerId: customer.id } }),
  ]);

  const activityCount = projects + chatSessions;

  // Separate audit views from other views
  const auditViews = views.filter((v) => v.category === 'audit');
  const nonAuditViews = views.filter((v) => v.category !== 'audit');

  const attributes = {
    company: customer.company,
    industry: customer.industry ?? undefined,
    tier: customer.tier as CustomerProfileAttributes['tier'],
    crmId: customer.crmId ?? undefined,
  };

  return (
    <div>
      {/* Back link */}
      <div className="p-8 pb-0">
        <Link
          href="/v2/customers"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Link>
      </div>

      {/* Customer Header and Tabs */}
      <CustomerTabNavigation
        customerSlug={slug}
        customer={{
          id: customer.id,
          title: customer.company,
          status: customer.status,
        }}
        attributes={attributes}
        activityCount={activityCount}
        hasAuditViews={auditViews.length > 0}
        nonAuditViews={nonAuditViews}
      />

      {/* Tab Content */}
      {children}
    </div>
  );
}
