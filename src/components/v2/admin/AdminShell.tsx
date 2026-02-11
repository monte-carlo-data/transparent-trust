/**
 * AdminShell Component
 *
 * Shared layout wrapper for admin and content management pages.
 * Provides consistent back navigation, breadcrumbs, and header styling.
 */

import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Palette,
  Users,
  FileText,
  type LucideIcon
} from 'lucide-react';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface AdminShellProps {
  title: string;
  description: string;
  icon: 'Palette' | 'Users' | 'FileText';
  backLink?: { href: string; label: string };
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

// Icon map for string-based icons
const iconMap: Record<string, LucideIcon> = {
  Palette,
  Users,
  FileText,
};

export function AdminShell({
  title,
  description,
  icon,
  backLink,
  breadcrumbs,
  actions,
  children,
}: AdminShellProps) {
  const Icon = iconMap[icon];
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back link */}
      {backLink && (
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLink.label}
        </Link>
      )}

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.label} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-gray-700">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-900 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Icon className="w-6 h-6 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-500 mt-1">{description}</p>
            </div>
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
