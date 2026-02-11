'use client';

/**
 * LibraryTabs Component
 *
 * Reusable tabbed interface for per-library source staging.
 * Tabs are derived from LibraryConfig to ensure consistency across the app.
 *
 * Supports two modes:
 * 1. Route-based navigation (default): Uses Link components with basePath
 * 2. Callback-based navigation: Uses onTabChange for embedded contexts
 */

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LibraryId } from '@/types/v2/building-block';
import { getLibraryConfig } from '@/lib/library-config';
import {
  LayoutDashboard,
  BookOpen,
  Wrench,
  Globe,
  FileText,
  MessageSquare,
  Phone,
  Ticket,
  MessageCircleQuestion,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface TabDefinition {
  id: string;
  label: string;
  icon: ReactNode;
  count?: number;
  description: string;
}

interface LibraryTabsProps {
  libraryId: LibraryId;
  activeTab: string;
  /**
   * Callback for tab changes. If not provided, tabs will use Link navigation.
   */
  onTabChange?: (tab: string) => void;
  /**
   * Base path for route-based navigation (e.g., '/v2/knowledge').
   * Required when onTabChange is not provided.
   */
  basePath?: string;
  counts: {
    items: number;
    urls?: number;
    documents?: number;
    zendesk?: number;
    slack?: number;
    notion?: number;
    gong?: number;
    bot?: number;
  };
  isCustomerLibrary?: boolean;
}

// Map source types to icons
function getIconForSourceType(
  type: string
): ReactNode {
  switch (type) {
    case 'url':
      return <Globe className="h-4 w-4" />;
    case 'document':
      return <FileText className="h-4 w-4" />;
    case 'slack':
      return <MessageSquare className="h-4 w-4" />;
    case 'gong':
      return <Phone className="h-4 w-4" />;
    case 'zendesk':
      return <Ticket className="h-4 w-4" />;
    case 'notion':
      return <FileText className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

// Map source types to count keys in the counts object
function getCountKeyForSourceType(type: string): keyof LibraryTabsProps['counts'] | undefined {
  switch (type) {
    case 'url':
      return 'urls';
    case 'document':
      return 'documents';
    case 'slack':
      return 'slack';
    case 'gong':
      return 'gong';
    case 'zendesk':
      return 'zendesk';
    case 'notion':
      return 'notion';
    default:
      return undefined;
  }
}

// Get library-specific item label (Skills, IT Skills, GTM Skills, Customers)
function getItemLabel(libraryId: LibraryId, isCustomerLibrary?: boolean): string {
  // Non-embedded customer library shows customer list
  if (libraryId === 'customers' && !isCustomerLibrary) {
    return 'Customers';
  }

  const config = getLibraryConfig(libraryId);
  if (config.name === 'Customer Knowledge Base') return 'Skills';
  if (libraryId === 'it') return 'IT Skills';
  if (libraryId === 'gtm') return 'GTM Skills';
  return 'Skills';
}

// Build tabs from config
function getTabsForLibrary(
  libraryId: LibraryId,
  counts: LibraryTabsProps['counts'],
  isCustomerLibrary?: boolean
): TabDefinition[] {
  const config = getLibraryConfig(libraryId);
  const tabs: TabDefinition[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      description: 'Overview & stats',
    },
    {
      id: 'items',
      label: getItemLabel(libraryId, isCustomerLibrary),
      icon: libraryId === 'it' ? <Wrench className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />,
      count: counts.items,
      description:
        libraryId === 'customers' && !isCustomerLibrary
          ? 'Customer profiles'
          : `${config.name} items`,
    },
  ];

  // Add source tabs from config
  for (const sourceTab of config.sourceTabs) {
    const countKey = getCountKeyForSourceType(sourceTab.type);
    const count = countKey ? counts[countKey] : undefined;

    tabs.push({
      id: sourceTab.type === 'url' ? 'urls' : sourceTab.type === 'document' ? 'documents' : sourceTab.type,
      label: sourceTab.label,
      icon: getIconForSourceType(sourceTab.type),
      count,
      description: `${sourceTab.label} awaiting review`,
    });
  }

  // Add Slack Bot tab if enabled (combines former Q&A and Settings tabs)
  if (config.showQATab) {
    tabs.push({
      id: 'qa',
      label: 'Slack Bot',
      icon: <MessageCircleQuestion className="h-4 w-4" />,
      count: counts.bot,
      description: 'Bot channel config, interactions, and prompt management',
    });
  }

  return tabs;
}

/**
 * Get the route path for a tab
 */
function getTabPath(basePath: string, tabId: string): string {
  // Dashboard is the root path (no suffix)
  if (tabId === 'dashboard') {
    return basePath;
  }
  return `${basePath}/${tabId}`;
}

/**
 * Determine the active tab from the current pathname
 */
function getActiveTabFromPath(pathname: string, basePath: string, tabs: TabDefinition[]): string {
  // Check if we're at the base path (dashboard)
  if (pathname === basePath || pathname === `${basePath}/`) {
    return 'dashboard';
  }

  // Find which tab matches the current path
  for (const tab of tabs) {
    if (tab.id === 'dashboard') continue;
    const tabPath = getTabPath(basePath, tab.id);
    if (pathname === tabPath || pathname.startsWith(`${tabPath}/`)) {
      return tab.id;
    }
  }

  // Default to dashboard if no match
  return 'dashboard';
}

export function LibraryTabs({ libraryId, activeTab: activeTabProp, onTabChange, basePath, counts, isCustomerLibrary }: LibraryTabsProps) {
  const pathname = usePathname();
  const tabs = getTabsForLibrary(libraryId, counts, isCustomerLibrary);

  // Use route-based navigation when basePath is provided and no onTabChange
  const useRouteNavigation = basePath && !onTabChange;

  // Determine active tab - from path if using routes, otherwise from prop
  const activeTab = useRouteNavigation
    ? getActiveTabFromPath(pathname, basePath, tabs)
    : activeTabProp;

  return (
    <div className="flex border-b border-gray-200">
      {tabs.map(({ id, label, icon, count, description }) => {
        const isActive = activeTab === id;
        const className = cn(
          'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
          isActive
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        );

        const content = (
          <>
            {icon}
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                )}
              >
                {count}
              </span>
            )}
          </>
        );

        // Use Link for route-based navigation, button for callback-based
        if (useRouteNavigation) {
          return (
            <Link
              key={id}
              href={getTabPath(basePath, id)}
              className={className}
              title={description}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={id}
            onClick={() => onTabChange?.(id)}
            className={className}
            title={description}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
