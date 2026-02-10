'use client';

/**
 * CustomerContextCard Component
 *
 * Displays selected customer profile with key attributes.
 * Reusable across Chat, Collateral, RFPs, Contracts, and other contexts.
 */

import { Building2, X } from 'lucide-react';

interface CustomerAttributes {
  company?: string;
  industry?: string;
  tier?: string;
  [key: string]: unknown;
}

interface Customer {
  id: string;
  title: string;
  attributes?: CustomerAttributes;
}

interface CustomerContextCardProps {
  customer: Customer;
  onRemove?: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

export function CustomerContextCard({
  customer,
  onRemove,
  isLoading = false,
  compact = false,
}: CustomerContextCardProps) {
  const attrs = customer.attributes as CustomerAttributes | undefined;
  const companyName = attrs?.company || customer.title;
  const industry = attrs?.industry;
  const tier = attrs?.tier;

  if (compact) {
    // Compact mode - single line
    return (
      <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 truncate">{companyName}</span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 flex-shrink-0"
            aria-label="Remove customer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className="p-1.5 bg-green-100 rounded flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{companyName}</p>
            {industry && <p className="text-xs text-gray-600 mt-0.5">{industry}</p>}
          </div>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 flex-shrink-0"
            aria-label="Remove customer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Attributes */}
      {(tier || industry) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tier && (
            <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded capitalize">
              {tier}
            </span>
          )}
          {industry && (
            <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              {industry}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
