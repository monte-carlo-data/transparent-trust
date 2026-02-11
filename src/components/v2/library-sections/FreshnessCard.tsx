/**
 * Freshness Card Component
 *
 * Shows "Last Verified" information with color-coded freshness indicator.
 * Shared across Knowledge and IT libraries.
 *
 * Note: daysOld should be calculated by the parent server component to avoid
 * calling Date.now() during render (React purity requirement).
 */

import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FreshnessCardProps {
  daysOld: number | null;
}

function FreshnessIcon({ daysOld }: { daysOld: number | null }) {
  if (daysOld === null) return <Minus className="w-5 h-5 text-gray-400" />;
  if (daysOld < 30) return <TrendingUp className="w-5 h-5 text-green-500" />;
  if (daysOld < 90) return <TrendingDown className="w-5 h-5 text-yellow-500" />;
  return <AlertTriangle className="w-5 h-5 text-red-500" />;
}

export function FreshnessCard({ daysOld }: FreshnessCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <FreshnessIcon daysOld={daysOld} />
        <span className="text-sm font-medium text-gray-700">Last Verified</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {daysOld !== null ? `${daysOld}d` : 'Never'}
      </div>
      {daysOld !== null && (
        <p
          className={`text-xs mt-1 ${
            daysOld < 30 ? 'text-green-600' : daysOld < 90 ? 'text-yellow-600' : 'text-red-600'
          }`}
        >
          {daysOld < 30
            ? 'Recently verified'
            : daysOld < 90
              ? 'Verification due soon'
              : 'Verification overdue'}
        </p>
      )}
    </div>
  );
}

/**
 * Helper function to calculate days old from a date string.
 * Call this in a server component before rendering FreshnessCard.
 */
export function calculateDaysOld(lastVerifiedAt?: string | null): number | null {
  if (!lastVerifiedAt) return null;
  return Math.floor((Date.now() - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24));
}
