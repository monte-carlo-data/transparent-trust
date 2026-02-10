/**
 * V2 Reviews Page
 *
 * Review inbox for AI-generated answers across all sources:
 * - RFP Project rows
 * - Quick Questions
 * - Collateral outputs
 */

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Flag,
  MessageSquare,
  Clock,
  Briefcase,
  HelpCircle,
} from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import {
  getConfidenceStyles,
  getReviewStatusStyles,
  getReviewStatusLabel,
  formatTimeAgo,
} from '@/lib/v2/status-utils';

interface ReviewItem {
  id: string;
  source: 'project' | 'question';
  sourceId: string;
  rowNumber: number | null;
  question: string | null;
  response: string | null;
  confidence: string | null;
  reviewStatus: string | null;
  reviewRequestedAt: string | null;
  reviewRequestedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  flaggedForReview: boolean;
  flaggedAt: string | null;
  flaggedBy: string | null;
  flagNote: string | null;
  flagResolved: boolean;
  flagResolvedAt: string | null;
  flagResolvedBy: string | null;
  flagResolutionNote: string | null;
  userEditedAnswer: string | null;
  projectName: string | null;
  customerName: string | null;
  createdAt: string;
}

interface ReviewCounts {
  pending: number;
  approved: number;
  corrected: number;
  flagged: number;
  resolved: number;
}

type TabType = 'pending' | 'flagged' | 'resolved' | 'approved' | 'corrected';

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'project':
      return <Briefcase className="w-4 h-4" />;
    case 'question':
      return <HelpCircle className="w-4 h-4" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
}

function ReviewsContent() {
  useSession(); // Auth check
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'pending');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'project' | 'question'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/v2/reviews?tab=${tab}`, { scroll: false });
  };

  // Build query params for unified API
  const getQueryParams = () => {
    const params: Record<string, string> = { limit: '100', type: activeTab };
    if (sourceFilter !== 'all') {
      params.source = sourceFilter;
    }
    return params;
  };

  const {
    data: reviewsData,
    isLoading,
    error,
  } = useApiQuery<{ reviews: ReviewItem[]; counts: ReviewCounts }>({
    queryKey: ['reviews', activeTab, sourceFilter],
    url: '/api/v2/reviews',
    params: getQueryParams(),
    staleTime: 30 * 1000,
  });

  const reviews = reviewsData?.reviews || [];
  const counts = reviewsData?.counts || { pending: 0, approved: 0, corrected: 0, flagged: 0, resolved: 0 };

  // Approve mutation
  const approveMutation = useApiMutation<
    void,
    { id: string; reviewStatus: string; source: string; projectId?: string }
  >({
    url: (vars) => `/api/v2/reviews/${vars.id}`,
    method: 'PATCH',
    onSuccess: () => toast.success('Answer approved!'),
    onError: () => toast.error('Failed to approve'),
  });

  const handleApprove = (review: ReviewItem) => {
    approveMutation.mutate({
      id: review.id,
      reviewStatus: 'APPROVED',
      source: review.source,
      projectId: review.sourceId,
    });
  };

  // Mark corrected mutation
  const correctMutation = useApiMutation<
    void,
    { id: string; reviewStatus: string; source: string; projectId?: string }
  >({
    url: (vars) => `/api/v2/reviews/${vars.id}`,
    method: 'PATCH',
    onSuccess: () => toast.success('Marked as corrected!'),
    onError: () => toast.error('Failed to mark as corrected'),
  });

  const handleMarkCorrected = (review: ReviewItem) => {
    correctMutation.mutate({
      id: review.id,
      reviewStatus: 'CORRECTED',
      source: review.source,
      projectId: review.sourceId,
    });
  };

  // Resolve flag mutation
  const resolveFlagMutation = useApiMutation<
    void,
    { id: string; source: string; projectId?: string; note: string }
  >({
    url: (vars) => `/api/v2/reviews/${vars.id}`,
    method: 'PATCH',
    onSuccess: () => {
      toast.success('Flag resolved!');
      setResolvingId(null);
      setResolutionNote('');
    },
    onError: () => toast.error('Failed to resolve flag'),
  });

  const handleResolveFlag = (review: ReviewItem) => {
    resolveFlagMutation.mutate({
      id: review.id,
      source: review.source,
      projectId: review.sourceId,
      note: resolutionNote,
    });
  };

  const tabs = [
    { id: 'pending' as const, label: 'Need Help', count: counts.pending, icon: AlertTriangle, color: 'yellow' },
    { id: 'flagged' as const, label: 'Flagged', count: counts.flagged, icon: Flag, color: 'red' },
    { id: 'resolved' as const, label: 'Resolved', count: counts.resolved, icon: CheckCircle, color: 'green' },
    { id: 'approved' as const, label: 'Approved', count: counts.approved, icon: CheckCircle, color: 'green' },
    { id: 'corrected' as const, label: 'Corrected', count: counts.corrected, icon: MessageSquare, color: 'blue' },
  ];

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href="/v2"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Review Inbox</h1>
        </div>
        <p className="text-gray-500">
          Review and approve AI-generated answers from projects, questions, and collateral
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-l-4 border-l-yellow-500 p-4">
          <div className="text-2xl font-bold text-gray-900">{counts.pending}</div>
          <div className="text-sm text-gray-500">Need Help</div>
        </div>
        <div className="bg-white rounded-lg border border-l-4 border-l-red-500 p-4">
          <div className="text-2xl font-bold text-gray-900">{counts.flagged}</div>
          <div className="text-sm text-gray-500">Flagged</div>
        </div>
        <div className="bg-white rounded-lg border border-l-4 border-l-green-500 p-4">
          <div className="text-2xl font-bold text-gray-900">{counts.approved}</div>
          <div className="text-sm text-gray-500">Approved</div>
        </div>
        <div className="bg-white rounded-lg border border-l-4 border-l-blue-500 p-4">
          <div className="text-2xl font-bold text-gray-900">{counts.corrected}</div>
          <div className="text-sm text-gray-500">Corrected</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Source Filter */}
      <div className="flex gap-2 mb-6">
        <span className="text-sm text-gray-500 py-2">Filter by source:</span>
        {(['all', 'project', 'question'] as const).map((source) => (
          <button
            key={source}
            onClick={() => setSourceFilter(source)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              sourceFilter === source
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {source === 'all' ? 'All Sources' : source === 'project' ? 'Projects' : 'Questions'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">Failed to load reviews</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && reviews.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeTab === 'pending' && 'All caught up!'}
            {activeTab === 'flagged' && 'No flagged items'}
            {activeTab === 'resolved' && 'No resolved items yet'}
            {(activeTab === 'approved' || activeTab === 'corrected') && 'No items found'}
          </h3>
          <p className="text-gray-500">
            {activeTab === 'pending' && 'No answers need review right now.'}
            {activeTab === 'flagged' && 'No answers have been flagged for investigation.'}
            {activeTab === 'resolved' && 'Resolved flags will appear here.'}
            {(activeTab === 'approved' || activeTab === 'corrected') && 'Try another tab.'}
          </p>
        </div>
      )}

      {/* Review List */}
      {!isLoading && !error && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Card Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <SourceIcon source={review.source} />
                  <div>
                    {review.source === 'project' ? (
                      <span className="text-sm font-medium text-gray-900">
                        {review.projectName}
                        {review.customerName && (
                          <span className="text-gray-500 font-normal"> • {review.customerName}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-gray-900">Quick Question</span>
                    )}
                    {review.rowNumber !== null && (
                      <span className="text-xs text-gray-500 ml-2">Row {review.rowNumber}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  {review.flaggedForReview ? (
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        review.flagResolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {review.flagResolved ? 'Resolved' : 'Flagged'}
                    </span>
                  ) : (
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getReviewStatusStyles(review.reviewStatus || undefined)}`}>
                      {getReviewStatusLabel(review.reviewStatus || undefined)}
                    </span>
                  )}

                  {/* Confidence Badge */}
                  {review.confidence && (
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getConfidenceStyles(review.confidence)}`}>
                      {review.confidence}
                    </span>
                  )}

                  {/* Time */}
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo((review.reviewRequestedAt || review.flaggedAt) || undefined)}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <h3 className="font-medium text-gray-900 mb-2">Q: {review.question}</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 max-h-40 overflow-auto whitespace-pre-wrap">
                  {review.response}
                </div>

                {/* Notes */}
                {(review.reviewNote || review.flagNote) && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-yellow-800 mb-1">Notes</div>
                    <div className="text-sm text-yellow-700 whitespace-pre-wrap">
                      {review.reviewNote || review.flagNote}
                    </div>
                  </div>
                )}

                {/* Resolution Info */}
                {review.flagResolved && review.flagResolutionNote && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-green-800 mb-1">
                      Resolution by {review.flagResolvedBy}
                    </div>
                    <div className="text-sm text-green-700">{review.flagResolutionNote}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                  {/* View link */}
                  {review.source === 'project' ? (
                    <Link
                      href={`/v2/rfps/${review.sourceId}`}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      View in Project
                    </Link>
                  ) : (
                    <Link
                      href="/v2/chat"
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      View Question
                    </Link>
                  )}

                  {/* Action buttons for pending items */}
                  {review.reviewStatus === 'REQUESTED' && !review.flaggedForReview && (
                    <>
                      <button
                        onClick={() => handleApprove(review)}
                        disabled={approveMutation.isPending}
                        className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleMarkCorrected(review)}
                        disabled={correctMutation.isPending}
                        className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Mark Corrected
                      </button>
                    </>
                  )}

                  {/* Action buttons for flagged items */}
                  {review.flaggedForReview && !review.flagResolved && (
                    <>
                      {resolvingId === review.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            placeholder="Resolution note..."
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            autoFocus
                          />
                          <button
                            onClick={() => handleResolveFlag(review)}
                            disabled={resolveFlagMutation.isPending}
                            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => {
                              setResolvingId(null);
                              setResolutionNote('');
                            }}
                            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResolvingId(review.id)}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Resolve Flag
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <ReviewsContent />
    </Suspense>
  );
}
