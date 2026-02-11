/**
 * Source Type Configuration
 *
 * Centralized configuration for source type display (icons, labels, colors).
 * Used by CustomerSourcesSection, SourceItem, and other source-related components.
 */

import {
  FileText,
  Globe,
  MessageSquare,
  Phone,
  File,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import type { SourceType } from '@/types/v2';

export interface SourceTypeConfig {
  /** Display label (singular) */
  label: string;
  /** Display label (plural) */
  labelPlural: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind color class for the icon/badge */
  colorClass: string;
  /** Tailwind background color class for badges */
  bgColorClass: string;
  /** Description for tooltips */
  description: string;
}

/**
 * Configuration for all source types
 */
export const SOURCE_TYPE_CONFIGS: Record<SourceType, SourceTypeConfig> = {
  url: {
    label: 'URL',
    labelPlural: 'URLs',
    icon: Globe,
    colorClass: 'text-blue-600',
    bgColorClass: 'bg-blue-50',
    description: 'Web pages and documentation links',
  },
  zendesk: {
    label: 'Zendesk Ticket',
    labelPlural: 'Zendesk Tickets',
    icon: MessageSquare,
    colorClass: 'text-green-600',
    bgColorClass: 'bg-green-50',
    description: 'Support tickets from Zendesk',
  },
  slack: {
    label: 'Slack Thread',
    labelPlural: 'Slack Threads',
    icon: MessageSquare,
    colorClass: 'text-purple-600',
    bgColorClass: 'bg-purple-50',
    description: 'Conversation threads from Slack',
  },
  notion: {
    label: 'Notion Page',
    labelPlural: 'Notion Pages',
    icon: FileText,
    colorClass: 'text-gray-700',
    bgColorClass: 'bg-gray-50',
    description: 'Documentation from Notion',
  },
  gong: {
    label: 'Gong Call',
    labelPlural: 'Gong Calls',
    icon: Phone,
    colorClass: 'text-orange-600',
    bgColorClass: 'bg-orange-50',
    description: 'Call recordings and transcripts from Gong',
  },
  document: {
    label: 'Document',
    labelPlural: 'Documents',
    icon: File,
    colorClass: 'text-amber-600',
    bgColorClass: 'bg-amber-50',
    description: 'Uploaded files (PDF, Word, etc.)',
  },
  looker: {
    label: 'Looker Dashboard',
    labelPlural: 'Looker Dashboards',
    icon: BarChart3,
    colorClass: 'text-indigo-600',
    bgColorClass: 'bg-indigo-50',
    description: 'Analytics dashboards from Looker',
  },
};

/**
 * Get configuration for a source type
 */
export function getSourceTypeConfig(sourceType: SourceType): SourceTypeConfig {
  return SOURCE_TYPE_CONFIGS[sourceType];
}

/**
 * Get icon component for a source type
 */
export function getSourceTypeIcon(sourceType: SourceType): LucideIcon {
  return SOURCE_TYPE_CONFIGS[sourceType].icon;
}

/**
 * Get display label for a source type
 */
export function getSourceTypeLabel(sourceType: SourceType, plural = false): string {
  const config = SOURCE_TYPE_CONFIGS[sourceType];
  return plural ? config.labelPlural : config.label;
}

/**
 * Order of source types for display (most relevant first)
 */
export const SOURCE_TYPE_DISPLAY_ORDER: SourceType[] = [
  'gong',
  'slack',
  'zendesk',
  'document',
  'notion',
  'url',
  'looker',
];
