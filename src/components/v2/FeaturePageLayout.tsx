'use client';

import { TabNavigation, type TabItem } from './TabNavigation';

/**
 * Reusable Feature Page Layout
 *
 * Provides consistent layout for feature pages with tabs (RFPs, Contracts, etc.)
 * Includes header with title/subtitle and tab navigation.
 *
 * Supports both route-based and callback-based tab navigation via TabNavigation.
 */

interface FeaturePageLayoutProps {
  title: string;
  subtitle?: string;
  tabs: TabItem[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;  // Optional for route-based navigation
  variant?: 'button' | 'underline';
  className?: string;
  children: React.ReactNode;
}

export function FeaturePageLayout({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  variant = 'button',
  className = '',
  children,
}: FeaturePageLayoutProps) {
  return (
    <div className={`flex flex-col h-screen bg-white ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-slate-600 text-sm">{subtitle}</p>
          )}
        </div>

        {/* Tab Navigation */}
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          variant={variant}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
