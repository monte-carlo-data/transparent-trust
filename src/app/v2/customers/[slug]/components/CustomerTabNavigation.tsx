'use client';

/**
 * Customer Tab Navigation Component
 *
 * Renders the customer header and tab navigation using route-based links.
 * Active tab is determined by current pathname.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ExternalLink } from 'lucide-react';
import type { CustomerProfileAttributes } from '@/types/v2';

interface ViewDefinition {
  id: string;
  title: string;
  slug: string;
}

interface CustomerTabNavigationProps {
  customerSlug: string;
  customer: {
    id: string;
    title: string;
    status: string;
  };
  attributes: Pick<CustomerProfileAttributes, 'company' | 'tier' | 'crmId'>;
  activityCount: number;
  hasAuditViews: boolean;
  nonAuditViews: ViewDefinition[];
}

export function CustomerTabNavigation({
  customerSlug,
  customer,
  attributes,
  activityCount,
  hasAuditViews,
  nonAuditViews,
}: CustomerTabNavigationProps) {
  const pathname = usePathname();
  const basePath = `/v2/customers/${customerSlug}`;

  const company = attributes?.company || customer.title;
  const tier = attributes?.tier;
  const crmId = attributes?.crmId;

  // Determine active tab from pathname
  const getActiveTab = (): string => {
    if (pathname === basePath || pathname === `${basePath}/`) {
      return 'profile';
    }
    if (pathname.startsWith(`${basePath}/knowledge`)) {
      return 'knowledge';
    }
    if (pathname.startsWith(`${basePath}/activity`)) {
      return 'activity';
    }
    if (pathname.startsWith(`${basePath}/audits`)) {
      return 'audits';
    }
    // Check for view routes
    for (const view of nonAuditViews) {
      if (pathname.startsWith(`${basePath}/views/${view.slug}`)) {
        return `view_${view.id}`;
      }
    }
    return 'profile';
  };

  const activeTab = getActiveTab();

  // Build tab list
  const tabs = [
    { id: 'profile', label: 'Profile', href: basePath },
    { id: 'knowledge', label: 'Knowledge Base', href: `${basePath}/knowledge` },
    { id: 'activity', label: `Activity${activityCount > 0 ? ` (${activityCount})` : ''}`, href: `${basePath}/activity` },
    ...(hasAuditViews ? [{ id: 'audits', label: 'Audits', href: `${basePath}/audits` }] : []),
    ...nonAuditViews.map((v) => ({
      id: `view_${v.id}`,
      label: v.title,
      href: `${basePath}/views/${v.slug}`,
    })),
  ];

  return (
    <div className="p-8 pb-0">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{company}</h1>
              {tier && (
                <span
                  className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                    tier === 'enterprise'
                      ? 'bg-purple-100 text-purple-700'
                      : tier === 'mid-market'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tier}
                </span>
              )}
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${
                  customer.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {customer.status}
              </span>
            </div>
          </div>
        </div>

        {crmId && (
          <a
            href={`https://app.salesforce.com/${crmId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4" />
            Salesforce
          </a>
        )}
      </div>

      {/* Top-Level Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
