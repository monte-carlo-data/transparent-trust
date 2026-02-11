'use client';

/**
 * AccuracyDashboard Component
 *
 * Displays AI accuracy metrics and trends for the current period.
 * Shows total questions, accuracy rate, flags, and corrections.
 */

import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, AlertCircle, Edit2, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AccuracyStats {
  period: {
    days: number;
    since: string;
  };
  summary: {
    totalQuestions: number;
    completedQuestions: number;
    accuracyPercent: number;
    flaggedForReview: number;
    reviewedCount: number;
    correctedCount: number;
  };
  trend: Array<{
    date: string;
    accuracy: number;
    count: number;
  }>;
}

interface AccuracyDashboardProps {
  days?: 7 | 30 | 90;
  onDaysChange?: (days: 7 | 30 | 90) => void;
  libraryId?: string;
}

export function AccuracyDashboard({
  days = 30,
  onDaysChange,
  libraryId,
}: AccuracyDashboardProps) {
  const [stats, setStats] = useState<AccuracyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          days: String(days),
        });

        if (libraryId) {
          params.append('libraryId', libraryId);
        }

        const response = await fetch(`/api/v2/accuracy/stats?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch accuracy stats');
        }

        const data = await response.json();
        setStats(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching accuracy stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [days, libraryId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-sm text-red-700">Error loading accuracy stats: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const { summary } = stats;
  const accuracy = summary.accuracyPercent;
  const accuracyColor =
    accuracy >= 90 ? 'text-green-600' : accuracy >= 75 ? 'text-blue-600' : 'text-yellow-600';
  const accuracyBg =
    accuracy >= 90 ? 'bg-green-50' : accuracy >= 75 ? 'bg-blue-50' : 'bg-yellow-50';

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      {onDaysChange && (
        <div className="flex gap-2">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                days === d
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Questions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{summary.totalQuestions}</span>
              <span className="text-xs text-gray-500">
                {summary.completedQuestions} completed
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Accuracy Rate */}
        <Card className={accuracyBg}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Accuracy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${accuracyColor}`}>{accuracy}%</span>
              <TrendingUp className={`w-4 h-4 ${accuracyColor}`} />
            </div>
          </CardContent>
        </Card>

        {/* Flagged for Review */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Flagged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-600">
                {summary.flaggedForReview}
              </span>
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        {/* Corrections Made */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Corrections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">{summary.correctedCount}</span>
              <Edit2 className="w-4 h-4 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Trend */}
      {stats.trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Accuracy Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-around gap-1 bg-gray-50 p-4 rounded">
              {stats.trend.map((point, idx) => {
                const maxHeight = 200;
                const height = (point.accuracy / 100) * maxHeight;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-2 min-w-0"
                    title={`${point.date}: ${point.accuracy}% (${point.count} questions)`}
                  >
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                      style={{ height: `${Math.max(height, 4)}px` }}
                    />
                    <span className="text-xs text-gray-500 text-center truncate">
                      {new Date(point.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-gray-900">
              {summary.reviewedCount - summary.correctedCount}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-600">
              <Edit2 className="w-4 h-4" />
              Corrections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-gray-900">{summary.correctedCount}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-4 h-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-gray-900">
              {summary.flaggedForReview - (summary.reviewedCount || 0)}
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
