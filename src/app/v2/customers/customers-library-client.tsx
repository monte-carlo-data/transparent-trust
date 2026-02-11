'use client';

/**
 * Customers Library Client Component
 *
 * Displays customer profiles with filtering and source staging tabs.
 * Customer profiles include company information and intelligence sources.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Building2, TrendingUp, TrendingDown, Minus, Layers } from 'lucide-react';
import { DashboardTab } from '@/components/v2/DashboardTab';
import { FoundationalSkillsList } from '@/components/v2/foundational-skills';
import { CreateSkillModal } from '@/components/v2/CreateSkillModal';
import type { CustomerProfileAttributes } from '@/types/v2';

interface CustomerItem {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  attributes: unknown;
  status: string;
  updatedAt: Date;
}

interface CustomersLibraryClientProps {
  customers: CustomerItem[];
  totalCustomers: number;
  activeCustomers: number;
  pendingReview: number;
  industries: string[];
  searchParams: {
    search?: string;
    tier?: string;
    industry?: string;
    review?: string;
  };
}

function HealthIndicator({ score }: { score?: number }) {
  if (score === undefined || score === null) {
    return <Minus className="w-4 h-4 text-gray-400" />;
  }
  if (score >= 70) {
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  }
  if (score >= 40) {
    return <Minus className="w-4 h-4 text-yellow-500" />;
  }
  return <TrendingDown className="w-4 h-4 text-red-500" />;
}

const tierColors: Record<string, string> = {
  enterprise: 'bg-purple-100 text-purple-700',
  'mid-market': 'bg-blue-100 text-blue-700',
  smb: 'bg-gray-100 text-gray-700',
};

export function CustomersLibraryClient({
  customers,
  totalCustomers,
  activeCustomers,
  pendingReview,
  industries,
  searchParams,
}: CustomersLibraryClientProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateFoundationalModal, setShowCreateFoundationalModal] = useState(false);
  const [foundationalRefreshKey, setFoundationalRefreshKey] = useState(0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-600">
            {totalCustomers} customers · {pendingReview} pending review · {activeCustomers} active
          </p>
        </div>
        <Link
          href="/v2/customers/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dashboard'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'items'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Customers
          <span className={`px-1.5 py-0.5 text-xs rounded-full ${
            activeTab === 'items' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'
          }`}>
            {totalCustomers}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('foundational-skills')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'foundational-skills'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Layers className="h-4 w-4" />
          Foundational Skills
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            libraryId="customers"
            totalSkills={totalCustomers}
            activeSkills={activeCustomers}
            pendingReview={pendingReview}
            totalStagedSources={0}
            sourceActions={[]}
            onNavigate={setActiveTab}
          />
        )}

        {/* Customers Tab */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <form action="/v2/customers" method="GET">
                  {searchParams.tier && <input type="hidden" name="tier" value={searchParams.tier} />}
                  {searchParams.industry && <input type="hidden" name="industry" value={searchParams.industry} />}
                  <input
                    type="text"
                    name="search"
                    placeholder="Search customers..."
                    defaultValue={searchParams.search}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </form>
              </div>

              {/* Tier Filter */}
              <form action="/v2/customers" method="GET" className="flex gap-2">
                {searchParams.search && <input type="hidden" name="search" value={searchParams.search} />}
                {searchParams.industry && <input type="hidden" name="industry" value={searchParams.industry} />}
                <select
                  name="tier"
                  defaultValue={searchParams.tier || ''}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">All Tiers</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="mid-market">Mid-Market</option>
                  <option value="smb">SMB</option>
                </select>
              </form>

              {/* Industry Filter */}
              {industries.length > 0 && (
                <form action="/v2/customers" method="GET">
                  {searchParams.search && <input type="hidden" name="search" value={searchParams.search} />}
                  {searchParams.tier && <input type="hidden" name="tier" value={searchParams.tier} />}
                  <select
                    name="industry"
                    defaultValue={searchParams.industry || ''}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">All Industries</option>
                    {industries.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </form>
              )}
            </div>

            {/* Customer Grid */}
            {customers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                <p className="text-gray-500 mb-4">
                  {searchParams.search || searchParams.tier || searchParams.industry
                    ? 'Try adjusting your filters.'
                    : 'Add your first customer profile to get started.'}
                </p>
                <Link
                  href="/v2/customers/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Customer
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map((customer) => {
                  const attrs = customer.attributes as CustomerProfileAttributes;
                  const tier = attrs?.tier;
                  const industry = attrs?.industry;
                  const healthScore = attrs?.healthScore;
                  const company = attrs?.company || customer.title;

                  return (
                    <Link
                      key={customer.id}
                      href={`/v2/customers/${customer.slug || customer.id}`}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-amber-300 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{company}</h3>
                            {industry && (
                              <p className="text-sm text-gray-500">{industry}</p>
                            )}
                          </div>
                        </div>
                        <HealthIndicator score={healthScore} />
                      </div>

                      {customer.summary && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {customer.summary}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {tier && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded capitalize ${
                                tierColors[tier] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {tier}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              customer.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {customer.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(customer.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Foundational Skills Tab */}
        {activeTab === 'foundational-skills' && (
          <div className="space-y-4">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-1 mr-4">
                <h3 className="text-sm font-medium text-blue-900 mb-1">About Foundational Skills</h3>
                <p className="text-sm text-blue-700">
                  Foundational skills are templates that define a title and scope. Apply them to customers
                  to create customer-specific skills that extract relevant content from sources.
                </p>
              </div>
              <button
                onClick={() => setShowCreateFoundationalModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Create Foundational Skill
              </button>
            </div>
            <FoundationalSkillsList key={foundationalRefreshKey} />
          </div>
        )}
      </div>

      {/* Create Foundational Skill Modal */}
      <CreateSkillModal
        isOpen={showCreateFoundationalModal}
        libraryId="customers"
        isFoundational={true}
        onClose={() => setShowCreateFoundationalModal(false)}
        onSuccess={() => {
          setShowCreateFoundationalModal(false);
          setFoundationalRefreshKey(prev => prev + 1);
        }}
      />
    </div>
  );
}
