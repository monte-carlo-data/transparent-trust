'use client';

/**
 * Reusable Dashboard Tab Component
 *
 * Displays library stats and quick action cards for any skill library.
 * Supports dynamic source types and library-specific branding.
 */

import Link from 'next/link';
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Clock,
  Zap,
  Megaphone,
  LayoutDashboard,
  Search,
  FileText,
  Bot,
  Ticket,
  Building2,
  BookOpen,
} from 'lucide-react';

interface DashboardTabProps {
  libraryId: 'knowledge' | 'it' | 'gtm' | 'talent' | 'customers';
  totalSkills: number;
  activeSkills: number;
  pendingReview: number;
  totalStagedSources: number;
  sourceActions: Array<{
    label: string;
    count: number;
    description: string;
    color: 'yellow' | 'blue' | 'purple' | 'pink' | 'orange' | 'gray' | 'green' | 'amber';
    icon: 'alert' | 'document' | 'megaphone' | 'search' | 'zap' | 'file' | 'bot' | 'ticket' | 'building';
    tabName: string;
  }>;
  onNavigate: (tab: string) => void;
}

const iconMap = {
  alert: AlertTriangle,
  document: LayoutDashboard,
  megaphone: Megaphone,
  search: Search,
  zap: Zap,
  file: FileText,
  bot: Bot,
  ticket: Ticket,
  building: Building2,
};

const colorMap = {
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    hover: 'hover:bg-yellow-100',
    icon: 'text-yellow-600',
    text: 'text-yellow-900',
    subtext: 'text-yellow-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hover: 'hover:bg-blue-100',
    icon: 'text-blue-600',
    text: 'text-blue-900',
    subtext: 'text-blue-700',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    hover: 'hover:bg-purple-100',
    icon: 'text-purple-600',
    text: 'text-purple-900',
    subtext: 'text-purple-700',
  },
  pink: {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    hover: 'hover:bg-pink-100',
    icon: 'text-pink-600',
    text: 'text-pink-900',
    subtext: 'text-pink-700',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    hover: 'hover:bg-orange-100',
    icon: 'text-orange-600',
    text: 'text-orange-900',
    subtext: 'text-orange-700',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100',
    icon: 'text-gray-600',
    text: 'text-gray-900',
    subtext: 'text-gray-700',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    hover: 'hover:bg-green-100',
    icon: 'text-green-600',
    text: 'text-green-900',
    subtext: 'text-green-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hover: 'hover:bg-amber-100',
    icon: 'text-amber-600',
    text: 'text-amber-900',
    subtext: 'text-amber-700',
  },
};

const statIconMap = {
  knowledge: Megaphone,
  it: Zap,
  gtm: Megaphone,
  talent: BookOpen,
  customers: Building2,
};

const libraryLabels = {
  knowledge: 'Total Skills',
  it: 'Total IT Skills',
  gtm: 'Total GTM Skills',
  talent: 'Total Talent Skills',
  customers: 'Total Customers',
};

export function DashboardTab({
  libraryId,
  totalSkills,
  activeSkills,
  pendingReview,
  totalStagedSources,
  sourceActions,
  onNavigate,
}: DashboardTabProps) {
  const StatIcon = statIconMap[libraryId];
  const statLabel = libraryLabels[libraryId];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <StatIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalSkills}</p>
              <p className="text-sm text-gray-500">{statLabel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeSkills}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingReview}</p>
              <p className="text-sm text-gray-500">Pending Review</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalStagedSources}</p>
              <p className="text-sm text-gray-500">Staged Sources</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingReview > 0 && (
          <button
            onClick={() => onNavigate('items')}
            className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div className="text-left">
                <p className="font-medium text-yellow-900">{pendingReview} items pending review</p>
                <p className="text-sm text-yellow-700">Review and approve pending items</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-yellow-600" />
          </button>
        )}

        {sourceActions.map((action) => {
          if (action.count === 0) return null;
          const Icon = iconMap[action.icon];
          const colors = colorMap[action.color];

          return (
            <button
              key={action.tabName}
              onClick={() => onNavigate(action.tabName)}
              className={`flex items-center justify-between p-4 ${colors.bg} border ${colors.border} rounded-lg ${colors.hover} transition-colors`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${colors.icon}`} />
                <div className="text-left">
                  <p className={`font-medium ${colors.text}`}>
                    {action.count} {action.label}
                  </p>
                  <p className={`text-sm ${colors.subtext}`}>{action.description}</p>
                </div>
              </div>
              <ArrowRight className={`w-5 h-5 ${colors.icon}`} />
            </button>
          );
        })}

{/* Manual creation removed - skills are created through the source wizard flow */}
      </div>

      {/* Prompt Transparency Link */}
      <div className="border-t pt-6">
        <Link
          href="/v2/prompt-registry"
          className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <p className="font-medium text-blue-900">View Prompt Library</p>
              <p className="text-sm text-blue-600">See all system prompts used for skill building</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-blue-600" />
        </Link>
      </div>
    </div>
  );
}
