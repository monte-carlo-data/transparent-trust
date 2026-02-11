'use client';

/**
 * FeedbackList Component
 *
 * Displays a list of recent corrections and feedback items.
 * Filterable by source type (RFP, Chat, Contract).
 */

import { useState, useEffect } from 'react';
import { Flag, Edit2, Check, Calendar, Loader2, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface FeedbackItem {
  id: string;
  type: 'correction' | 'flag' | 'approved';
  source: 'rfp' | 'chat' | 'contract';
  question: string;
  originalAnswer?: string;
  correctedAnswer?: string;
  note?: string;
  user?: string;
  createdAt: string;
}

interface FeedbackListProps {
  sourceFilter?: 'all' | 'rfp' | 'chat' | 'contract';
  limit?: number;
}

const sourceColors = {
  rfp: 'bg-blue-50 border-blue-200 text-blue-700',
  chat: 'bg-green-50 border-green-200 text-green-700',
  contract: 'bg-purple-50 border-purple-200 text-purple-700',
};

const sourceIcons = {
  rfp: 'RFP',
  chat: 'Chat',
  contract: 'Contract',
};

export function FeedbackList({
  sourceFilter = 'all',
  limit = 10,
}: FeedbackListProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(sourceFilter);

  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(limit),
        });

        if (filter !== 'all') {
          params.append('source', filter);
        }

        const response = await fetch(`/api/v2/accuracy/feedback?${params}`);
        if (response.ok) {
          const data = await response.json();
          setItems(data.data?.items || []);
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [filter, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-gray-500">No feedback items yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      {sourceFilter === 'all' && (
        <div className="flex gap-2">
          {(['all', 'rfp', 'chat', 'contract'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                filter === f
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All' : sourceIcons[f]}
            </button>
          ))}
        </div>
      )}

      {/* Feedback Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  {item.type === 'correction' && (
                    <Edit2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                  {item.type === 'flag' && (
                    <Flag className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  )}
                  {item.type === 'approved' && (
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}

                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      sourceColors[item.source]
                    }`}
                  >
                    {sourceIcons[item.source]}
                  </span>

                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {item.user && (
                  <span className="text-xs text-gray-600">{item.user}</span>
                )}
              </div>

              {/* Question */}
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900 mb-1">Question:</p>
                <p className="text-sm text-gray-700 line-clamp-2">{item.question}</p>
              </div>

              {/* Original Answer */}
              {item.originalAnswer && (
                <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
                  <p className="text-xs font-medium text-red-700 mb-1">Original Answer:</p>
                  <p className="text-xs text-red-600 line-clamp-2">{item.originalAnswer}</p>
                </div>
              )}

              {/* Corrected Answer */}
              {item.correctedAnswer && (
                <div className="mb-3 p-2 bg-green-50 rounded border border-green-200">
                  <p className="text-xs font-medium text-green-700 mb-1">Corrected Answer:</p>
                  <p className="text-xs text-green-600 line-clamp-2">{item.correctedAnswer}</p>
                </div>
              )}

              {/* Note */}
              {item.note && (
                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Note:
                  </p>
                  <p className="text-xs text-gray-600">{item.note}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
