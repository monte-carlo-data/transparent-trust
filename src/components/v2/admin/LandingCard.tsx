/**
 * LandingCard Component
 *
 * Reusable card for landing pages that link to subsections.
 * Used in Admin Dashboard, Content Assets, and Prompt Registry landing pages.
 */

import Link from 'next/link';
import {
  ChevronRight,
  Users,
  FileText,
  type LucideIcon
} from 'lucide-react';

interface LandingCardProps {
  href: string;
  title: string;
  description: string;
  icon: 'Users' | 'FileText';
  iconColor?: string;
  stat?: {
    value: string | number;
    label: string;
    color?: string;
  };
  actionLabel?: string;
}

// Icon map for string-based icons
const iconMap: Record<string, LucideIcon> = {
  Users,
  FileText,
};

export function LandingCard({
  href,
  title,
  description,
  icon,
  iconColor = 'bg-gray-100 text-gray-700',
  stat,
  actionLabel = 'View',
}: LandingCardProps) {
  const Icon = iconMap[icon];
  return (
    <Link
      href={href}
      className="block bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`p-3 rounded-lg ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {stat && (
            <p className={`text-2xl font-bold ${stat.color || 'text-gray-900'}`}>
              {stat.value}
              {stat.label && (
                <span className="text-sm font-normal text-gray-500 ml-1">
                  {stat.label}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <span className="text-sm font-medium text-gray-900">{actionLabel}</span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </Link>
  );
}
