'use client';

/**
 * RFP Tab Navigation
 *
 * Route-based tab navigation for RFP pages.
 * Uses pathname to determine active tab and Link components for navigation.
 */

import { usePathname } from 'next/navigation';
import { MessageSquare, FolderOpen, History, LayoutDashboard } from 'lucide-react';
import { TabNavigation, type TabItem } from '@/components/v2/TabNavigation';

const TABS: TabItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/v2/rfps/dashboard',
  },
  {
    id: 'ask',
    label: 'Ask',
    icon: MessageSquare,
    href: '/v2/rfps/ask',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderOpen,
    href: '/v2/rfps/projects',
  },
  {
    id: 'history',
    label: 'History',
    icon: History,
    href: '/v2/rfps/history',
  },
];

export function RFPTabNavigation() {
  const pathname = usePathname();

  const getActiveTab = (): string => {
    if (pathname.startsWith('/v2/rfps/ask')) return 'ask';
    if (pathname.startsWith('/v2/rfps/projects')) return 'projects';
    if (pathname.startsWith('/v2/rfps/history')) return 'history';
    if (pathname.startsWith('/v2/rfps/dashboard')) return 'dashboard';
    return 'ask'; // Default
  };

  const activeTab = getActiveTab();

  return <TabNavigation tabs={TABS} activeTab={activeTab} variant="button" />;
}
