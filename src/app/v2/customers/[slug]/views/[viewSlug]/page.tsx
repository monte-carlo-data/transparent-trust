/**
 * Customer View Tab (Dynamic)
 *
 * Shows generated analysis views for a customer (non-audit views).
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
import { ViewTab } from '../../components/ViewTab';
import { prisma } from '@/lib/prisma';

interface ViewPageProps {
  params: Promise<{ slug: string; viewSlug: string }>;
}

export default async function ViewPage({ params }: ViewPageProps) {
  const { slug, viewSlug } = await params;
  const session = await getServerSession(authOptions);

  const customer = await getCustomerBySlug(slug) || await getCustomerById(slug);
  if (!customer) {
    notFound();
  }

  // Get user's first team
  let teamId: string | undefined;
  if (session?.user?.id) {
    const membership = await prisma.teamMembership.findFirst({
      where: { userId: session.user.id },
    });
    teamId = membership?.teamId;
  }

  // Fetch views and find the matching one
  const [views, customerSkills, generatedViews] = await Promise.all([
    getActiveViews(),
    getCustomerSkills(customer.id),
    getCustomerGeneratedViews(customer.id),
  ]);

  // Find the view by slug (non-audit views only)
  const viewDef = views.find((v) => v.slug === viewSlug && v.category !== 'audit');
  if (!viewDef) {
    notFound();
  }

  // Map generated views by viewId
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

  return (
    <div className="p-8">
      <ViewTab
        viewId={viewDef.id}
        customerId={customer.id}
        teamId={teamId}
        cachedContent={generatedViewsMap[viewDef.id]}
        viewSummary={viewDef.summary}
        compositionId={viewDef.compositionId}
        customerSkills={customerSkills}
        customerData={customerData}
        libraryId="customers"
      />
    </div>
  );
}
