/**
 * New Customer Profile Page
 *
 * Dedicated form for creating customer profiles.
 * Captures company information, contacts, and basic metadata.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CustomerProfileForm } from '../components/customer-profile-form';

export default function NewCustomerPage() {
  return (
    <div className="p-8 max-w-3xl">
      {/* Back link */}
      <Link
        href="/v2/customers"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customers
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Customer Profile</h1>
        <p className="mt-1 text-gray-500">
          Add a new customer profile with company information and contacts.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <CustomerProfileForm />
      </div>
    </div>
  );
}
