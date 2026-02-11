/**
 * Customers Library Metadata Bar
 *
 * Displays Health Score, Tier, and Company information.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CustomersMetadataBarProps {
  healthScore?: number;
  tier?: string;
  industry?: string;
}

export function CustomersMetadataBar({
  healthScore,
  tier,
  industry,
}: CustomersMetadataBarProps) {
  return (
    <>
      {/* Health Score */}
      {healthScore !== undefined && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            {healthScore >= 70 ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : healthScore >= 40 ? (
              <Minus className="w-5 h-5 text-yellow-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm font-medium text-gray-700">Health Score</span>
          </div>
          <div
            className={`text-2xl font-bold ${
              healthScore >= 70
                ? 'text-green-600'
                : healthScore >= 40
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {healthScore}
          </div>
          <p className="text-xs text-gray-500 mt-1">Overall health</p>
        </div>
      )}

      {/* Tier */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <span className="text-sm font-medium text-gray-700">Tier</span>
        <div className="text-2xl font-bold text-gray-900 truncate capitalize">
          {tier || 'N/A'}
        </div>
        <p className="text-xs text-gray-500 mt-1">Account tier</p>
      </div>

      {/* Industry */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <span className="text-sm font-medium text-gray-700">Industry</span>
        <div className="text-2xl font-bold text-gray-900 truncate">{industry || 'N/A'}</div>
        <p className="text-xs text-gray-500 mt-1">Sector</p>
      </div>
    </>
  );
}
