'use client';

/**
 * SkillDetailCard
 *
 * Displays skill metadata: categories, owners, audit history, sync status.
 * Reusable across all libraries (Knowledge, IT, GTM, Customers).
 * Replaces scattered metadata display with consolidated view.
 */

import { useState } from 'react';
import { History, Users, Tag, Zap, AlertCircle, TrendingUp } from 'lucide-react';
import { SkillAuditDialog } from './SkillAuditDialog';
import type { AuditLogEntry } from '@/lib/v2/audit';

interface Owner {
  userId?: string;
  name: string;
  email?: string;
}

interface SkillDetailCardProps {
  // Metadata fields
  categories?: string[];
  owners?: Owner[];

  // Audit and sync information
  auditLog?: AuditLogEntry[];
  syncStatus?: 'synced' | 'pending' | 'failed';

  // Usage statistics
  usageCount?: number;
  lastUsedAt?: string;

  // Context
  skillTitle: string;
  availableCategories?: Array<{ id: string; name: string }>;
}

const syncStatusColors: Record<string, { bg: string; text: string; icon: string }> = {
  synced: { bg: 'bg-green-50', text: 'text-green-700', icon: '✓' },
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '○' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', icon: '✕' },
};

function getCategoryName(categoryId: string, availableCategories?: Array<{ id: string; name: string }>): string {
  return availableCategories?.find((c) => c.id === categoryId)?.name || categoryId;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Unknown date';
  }
}

export function SkillDetailCard({
  categories = [],
  owners = [],
  auditLog = [],
  syncStatus,
  usageCount,
  lastUsedAt,
  skillTitle,
  availableCategories,
}: SkillDetailCardProps) {
  const [showAuditDialog, setShowAuditDialog] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Skill Details</h3>

      <div className="space-y-6">
        {/* Categories */}
        {categories.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((catId) => {
                const catName = getCategoryName(catId, availableCategories);
                return (
                  <span key={catId} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm">
                    {catName}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Owners */}
        {owners.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Users className="w-4 h-4" />
              Owners
            </label>
            <div className="space-y-1">
              {owners.map((owner) => (
                <div key={owner.userId || owner.name} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="font-medium">{owner.name}</span>
                  {owner.email && <span className="text-gray-500">({owner.email})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Status */}
        {syncStatus && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Sync Status
            </label>
            <div
              className={`px-3 py-2 rounded-lg text-sm font-medium inline-block ${
                syncStatusColors[syncStatus].bg
              } ${syncStatusColors[syncStatus].text}`}
            >
              {syncStatusColors[syncStatus].icon} {syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1)}
            </div>
          </div>
        )}

        {/* Usage Statistics */}
        {(usageCount !== undefined || lastUsedAt) && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Usage
            </label>
            <div className="space-y-1">
              {usageCount !== undefined && (
                <p className="text-sm text-gray-700">
                  Used <span className="font-semibold">{usageCount}</span> time{usageCount !== 1 ? 's' : ''}
                </p>
              )}
              {lastUsedAt && <p className="text-xs text-gray-500">Last used {formatDate(lastUsedAt)}</p>}
            </div>
          </div>
        )}

        {/* Audit History */}
        {auditLog && auditLog.length > 0 && (
          <div>
            <button
              onClick={() => setShowAuditDialog(true)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 py-2"
            >
              <History className="w-4 h-4" />
              View History ({auditLog.length} entries)
            </button>
          </div>
        )}

        {/* No metadata message */}
        {categories.length === 0 &&
          owners.length === 0 &&
          !syncStatus &&
          (!auditLog || auditLog.length === 0) && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <AlertCircle className="w-4 h-4" />
              No metadata configured yet
            </div>
          )}
      </div>

      {/* Audit Dialog */}
      {auditLog && auditLog.length > 0 && (
        <SkillAuditDialog
          isOpen={showAuditDialog}
          onClose={() => setShowAuditDialog(false)}
          auditLog={auditLog}
          skillTitle={skillTitle}
        />
      )}
    </div>
  );
}
