/**
 * V2 Customer Detail Page - Profile Tab (Default)
 *
 * Shows the customer profile information:
 * - Company info, contacts, products, health score
 */

import { notFound } from 'next/navigation';
import {
  getCustomerBySlug,
  getCustomerById,
} from '@/lib/v2/customers/customer-service';
import { ProfileTab } from './components/ProfileTab';
import type { CustomerProfileAttributes, CustomerContact } from '@/types/v2';

interface CustomerDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { slug } = await params;

  const customer = await getCustomerBySlug(slug) || await getCustomerById(slug);
  if (!customer) {
    notFound();
  }

  const attributes: CustomerProfileAttributes = {
    company: customer.company,
    industry: customer.industry ?? undefined,
    tier: customer.tier as CustomerProfileAttributes['tier'],
    contacts: (customer.contacts as unknown) as CustomerContact[] | undefined,
    products: customer.products,
    healthScore: customer.healthScore ?? undefined,
    crmId: customer.crmId ?? undefined,
  };

  return (
    <div className="p-8">
      <ProfileTab
        customer={{
          id: customer.id,
          title: customer.company,
          status: customer.status,
          summary: customer.summary,
        }}
        attributes={attributes}
      />
    </div>
  );
}
