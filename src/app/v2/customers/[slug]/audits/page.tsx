/**
 * Customer Audits Tab
 *
 * Shows audit views (Coverage, Operations, Adoption) with sub-navigation.
 */

import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import {
  getCustomerBySlug,
  getCustomerById,
  getCustomerSkills,
  getCustomerGeneratedViews,
} from '@/lib/v2/customers/customer-service';
import { getActiveViews } from '@/lib/v2/views';
import { AuditsTab } from '../components/AuditsTab';
import { prisma } from '@/lib/prisma';
import type { CustomerProfileAttributes, CustomerContact } from '@/types/v2';

interface AuditsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AuditsPage({ params }: AuditsPageProps) {
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

  // Fetch views, skills, and generated views
  const [views, customerSkills, generatedViews] = await Promise.all([
    getActiveViews(),
    getCustomerSkills(customer.id),
    getCustomerGeneratedViews(customer.id),
  ]);

  // Filter to audit views only
  const auditViews = views.filter((v) => v.category === 'audit');

  // Map generated views by viewId for easy lookup
  const generatedViewsMap = Object.fromEntries(
    generatedViews.map((g) => [g.viewId, g])
  );

  // Build customer data for context
  const customerData: Record<string, unknown> = {
    company: customer.company,
    industry: customer.industry,
    tier: customer.tier,
    contacts: customer.contacts,
    products: customer.products,
    healthScore: customer.healthScore,
    crmId: customer.crmId,
  };

  if (auditViews.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-gray-500">
          No audit views configured.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <AuditsTab
        auditViews={auditViews}
        customerId={customer.id}
        teamId={teamId}
        generatedViews={generatedViewsMap}
        customerSkills={customerSkills}
        customerData={customerData}
        libraryId="customers"
      />
    </div>
  );
}
