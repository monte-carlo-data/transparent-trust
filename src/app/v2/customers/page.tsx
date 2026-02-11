/**
 * V2 Customers Page
 *
 * Displays customer profiles with filtering and search.
 * Links to detailed customer profile pages.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { queryCustomers } from '@/lib/v2/customers/customer-service';
import { CustomersLibraryClient } from './customers-library-client';
import { redirect } from 'next/navigation';

interface CustomersPageProps {
  searchParams: Promise<{
    search?: string;
    tier?: string;
    industry?: string;
    review?: string;
  }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;

  // Check authentication
  if (!session?.user?.id) {
    redirect('/v2');
  }

  // Query customers with search/filter support
  const { customers, total } = await queryCustomers({
    search: params.search,
    tier: params.tier,
    limit: 50,
    offset: 0,
    orderBy: 'company',
    orderDir: 'asc',
  });

  // Get all customers for stats (no filter)
  const { customers: allCustomers } = await queryCustomers({
    limit: 1000,
    offset: 0,
  });

  // Count by status
  const activeCount = allCustomers.filter((c) => c.status === 'ACTIVE').length;
  const pendingCount = allCustomers.filter((c) => c.status === 'PROSPECT').length;

  // Get unique industries for filter
  const industries = [
    ...new Set(allCustomers.map((c) => c.industry).filter((ind): ind is string => Boolean(ind))),
  ].sort();

  return (
    <CustomersLibraryClient
      customers={customers.map((c) => ({
        id: c.id,
        title: c.company,
        slug: c.slug,
        summary: c.summary,
        attributes: c,
        status: c.status,
        updatedAt: c.updatedAt,
      }))}
      totalCustomers={total}
      activeCustomers={activeCount}
      pendingReview={pendingCount}
      industries={industries}
      searchParams={{
        search: params.search,
        tier: params.tier,
        industry: params.industry,
        review: params.review,
      }}
    />
  );
}
