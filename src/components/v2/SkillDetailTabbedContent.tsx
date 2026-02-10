'use client';

/**
 * Skill Detail Tabbed Content
 *
 * Client component that manages tab state for skill detail pages.
 * Provides tab navigation while keeping sidebar always visible.
 * Supports multiple tabs (Content, LLM Trace, History, etc.)
 */

import { useState, ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SkillDetailTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: ReactNode;
}

interface SkillDetailTabbedContentProps {
  tabs: SkillDetailTab[];
  defaultTab?: string;
  sidebar: ReactNode;
}

export function SkillDetailTabbedContent({
  tabs,
  defaultTab,
  sidebar,
}: SkillDetailTabbedContentProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || 'content');

  const activeTabData = tabs.find((t) => t.id === activeTab);

  if (tabs.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">No content available to display.</p>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-6">{sidebar}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main Content Area with Tabs */}
      <div className="lg:col-span-2">
        {/* Tab Navigation */}
        {tabs.length > 1 && (
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-6">
              {tabs.map((tab) => {
                const Icon = tab.icon || FileText;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Tab Content */}
        {activeTabData && <div>{activeTabData.content}</div>}
      </div>

      {/* Sidebar - Always Visible */}
      <div className="lg:col-span-2 space-y-6">{sidebar}</div>
    </div>
  );
}
