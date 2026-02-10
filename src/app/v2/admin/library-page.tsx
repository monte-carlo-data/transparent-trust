'use client';

/**
 * Generic Admin Library Page Component
 *
 * Reusable component for managing any library (prompts, personas, templates)
 */

import Link from 'next/link';
import { Search, Edit, Trash2, ArrowLeft, Users, FileText, type LucideIcon } from 'lucide-react';
import { StatusFilterForm } from './status-filter-form';
import type { LibraryId } from '@/types/v2';

// Icon map for string-based icons
const iconMap: Record<string, LucideIcon> = {
  Users,
  FileText,
};

interface LibraryPageProps {
  title: string;
  description: string;
  libraryId: LibraryId;
  basePath: string;
  backLink?: { href: string; label: string };
  items: Array<{
    id: string;
    title: string;
    slug: string | null;
    summary: string | null;
    status: string;
    updatedAt: string;
    attributes: unknown;
  }>;
  total: number;
  searchTerm?: string;
  statusFilter?: string;
  icon: 'Users' | 'FileText';
  accentColor: string;
}

export function LibraryPage({
  title,
  description,
  libraryId,
  basePath,
  backLink = { href: '/v2/admin', label: 'Back to Administration' },
  items,
  total,
  searchTerm,
  statusFilter,
  icon,
  accentColor,
}: LibraryPageProps) {
  const Icon = iconMap[icon];
  const itemTypeLabel =
    libraryId === 'prompts'
      ? 'Prompt'
      : libraryId === 'personas'
      ? 'Persona'
      : 'Template';

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href={backLink.href}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLink.label}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg text-white ${accentColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          </div>
          <p className="text-gray-600">{description}</p>
          <p className="text-sm text-gray-500 mt-2">
            {total} {total === 1 ? itemTypeLabel : `${itemTypeLabel}s`}
            {statusFilter && ` · Filtered by ${statusFilter}`}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <form action={basePath} method="GET">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <input
              type="text"
              name="search"
              placeholder={`Search ${title.toLowerCase()}...`}
              defaultValue={searchTerm}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </form>
        </div>

        {/* Status Filter */}
        <StatusFilterForm
          basePath={basePath}
          searchTerm={searchTerm}
          currentStatus={statusFilter}
        />
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className={`text-center py-12 bg-white rounded-lg border-l-4 border-t border-r border-b border-gray-200 shadow-sm`} style={{ borderLeftColor: accentColor.split(' ')[1] || '#gray' }}>
          <Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {title.toLowerCase()} found
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter ? 'Try adjusting your filters.' : `Create your first ${itemTypeLabel.toLowerCase()} to get started.`}
          </p>
        </div>
      ) : (
        <div className={`bg-white rounded-lg border-l-4 border-t border-r border-b border-gray-200 shadow-sm divide-y divide-gray-100`} style={{ borderLeftColor: accentColor.split(' ')[1] || '#gray' }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between p-4 hover:bg-opacity-30 transition-colors"
              style={{ '--hover-bg': accentColor.split(' ')[1] || '#gray' } as React.CSSProperties}
              onMouseEnter={(e) => {
                const color = accentColor.split(' ')[1] || 'var(--surface-secondary)';
                (e.currentTarget as HTMLElement).style.backgroundColor = color + '1a';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <span
                    className={`px-2 py-0.5 text-xs rounded whitespace-nowrap ${
                      item.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : item.status === 'DRAFT'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.summary && (
                  <p className="text-sm text-gray-500 line-clamp-2">{item.summary}</p>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  Updated {new Date(item.updatedAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                <Link
                  href={`${basePath}/${item.id}`}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </Link>
                <button
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Delete"
                  onClick={() => {
                    if (confirm(`Delete "${item.title}"?`)) {
                      // Would need to implement delete API
                      fetch(`/api/v2/blocks/${item.id}`, { method: 'DELETE' });
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
