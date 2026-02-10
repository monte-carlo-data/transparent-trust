'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Reusable Tab Navigation Component
 *
 * Provides consistent tab UI across pages (RFPs, Contracts, Accuracy, Reviews, etc.)
 * Handles icon rendering, active state, badge counts, and URL sync.
 *
 * Supports two navigation modes:
 * 1. Callback-based: Use onTabChange for state-based navigation
 * 2. Route-based: Use href on each tab for Next.js Link navigation
 */


export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;  // If provided, renders Link instead of button
  count?: number;
  badge?: string;
  disabled?: boolean;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;  // Optional for route-based navigation
  variant?: 'button' | 'underline'; // button = RFPs style, underline = Contracts style
  className?: string;
}

export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  variant = 'button',
  className = '',
}: TabNavigationProps) {
  if (variant === 'button') {
    return (
      <div className={`flex gap-2 ${className}`}>
        {tabs.map((tab) => {
          const content = (
            <>
              {tab.icon && <tab.icon size={16} />}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {tab.count}
                </span>
              )}
            </>
          );

          const baseClasses = `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            activeTab === tab.id
              ? 'bg-blue-500 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`;

          // Route-based navigation (Link)
          if (tab.href) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={baseClasses}
                aria-disabled={tab.disabled}
                onClick={(e) => tab.disabled && e.preventDefault()}
              >
                {content}
              </Link>
            );
          }

          // Callback-based navigation (button)
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              disabled={tab.disabled}
              className={baseClasses}
            >
              {content}
            </button>
          );
        })}
      </div>
    );
  }

  // underline variant
  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="flex gap-6">
        {tabs.map((tab) => {
          const content = (
            <>
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  {tab.count}
                </span>
              )}
            </>
          );

          const baseClasses = `flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`;

          // Route-based navigation (Link)
          if (tab.href) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={baseClasses}
                aria-disabled={tab.disabled}
                onClick={(e) => tab.disabled && e.preventDefault()}
              >
                {content}
              </Link>
            );
          }

          // Callback-based navigation (button)
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              disabled={tab.disabled}
              className={baseClasses}
            >
              {content}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
