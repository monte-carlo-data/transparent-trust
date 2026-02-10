/**
 * V2 Accuracy & Metrics Page
 *
 * AI accuracy tracking and feedback analysis.
 * Native V2 implementation with dashboard, RFPs, and feedback tabs.
 */

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Loader2 } from 'lucide-react';
import { AccuracyDashboard } from '@/components/v2/AccuracyDashboard';
import { FeedbackList } from '@/components/v2/FeedbackList';

type TabId = 'dashboard' | 'feedback' | 'rfps';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'feedback', label: 'Feedback & Corrections' },
  { id: 'rfps', label: 'RFP Accuracy' },
] as const;

function AccuracyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'dashboard'
  );
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    router.push(`/v2/accuracy?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/v2/admin"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Admin
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">AI Accuracy & Metrics</h1>
        </div>
        <p className="text-gray-500">
          Track answer quality, review corrections, and monitor system accuracy
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b-2 border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors -mb-0.5 ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'dashboard' && (
          <AccuracyDashboard days={days} onDaysChange={setDays} />
        )}

        {activeTab === 'feedback' && (
          <FeedbackList sourceFilter="all" />
        )}

        {activeTab === 'rfps' && (
          <div className="space-y-6">
            <AccuracyDashboard libraryId="rfp" days={days} onDaysChange={setDays} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">RFP Feedback</h2>
              <FeedbackList sourceFilter="rfp" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccuracyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <AccuracyContent />
    </Suspense>
  );
}
