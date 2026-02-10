'use client';

/**
 * Source Card Component
 *
 * Displays a staged source with actions.
 */

import { useState } from 'react';
import { processSource, ignoreSource } from '@/lib/v2/sources/source-service';
import {
  ExternalLink,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  MessageSquare,
  FileText,
  Phone,
  BookOpen,
  RefreshCw,
} from 'lucide-react';

const sourceTypeIcons: Record<string, typeof LinkIcon> = {
  url: LinkIcon,
  zendesk: MessageSquare,
  slack: MessageSquare,
  notion: FileText,
  gong: Phone,
  document: BookOpen,
};

const sourceTypeColors: Record<string, string> = {
  url: 'bg-blue-100 text-blue-700',
  zendesk: 'bg-green-100 text-green-700',
  slack: 'bg-purple-100 text-purple-700',
  notion: 'bg-gray-100 text-gray-700',
  gong: 'bg-orange-100 text-orange-700',
  document: 'bg-amber-100 text-amber-700',
};

interface Source {
  id: string;
  title: string;
  sourceType: string;
  libraryId: string;
  status: string;
  contentPreview: string | null;
  externalUrl: string | null;
  stagedAt: Date;
  metadata: unknown;
}

interface SourceCardProps {
  source: Source;
}

export function SourceCard({ source }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceState, setSource] = useState<Source>(source);

  const Icon = sourceTypeIcons[sourceState.sourceType] || LinkIcon;
  const typeColor = sourceTypeColors[sourceState.sourceType] || 'bg-gray-100 text-gray-700';

  const handleAction = async (action: 'process' | 'ignore') => {
    setProcessing(true);
    setError(null);
    try {
      if (action === 'process') {
        await processSource({ sourceId: sourceState.id });
        setSource({ ...sourceState, status: 'PROCESSED' });
      } else {
        await ignoreSource({ sourceId: sourceState.id });
        setSource({ ...sourceState, status: 'IGNORED' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      console.error(`Error ${action}ing source:`, message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/v2/sources/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: sourceState.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh source');
      }

      const updated = await response.json();
      setSource({ ...sourceState, ...updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh';
      setError(message);
      console.error('Error refreshing source:', message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`p-2 rounded-lg ${typeColor}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-gray-900 truncate">{source.title}</h3>
              <span className={`px-2 py-0.5 text-xs rounded ${typeColor}`}>
                {source.sourceType}
              </span>
              <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                {source.libraryId}
              </span>
            </div>

            {sourceState.contentPreview && (
              <p className={`text-sm text-gray-500 ${expanded ? '' : 'line-clamp-2'}`}>
                {sourceState.contentPreview}
              </p>
            )}
            {!sourceState.contentPreview && sourceState.sourceType === 'url' && (
              <p className="text-sm text-gray-400 italic">Click &quot;Fetch Content&quot; to extract and preview content from this URL</p>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>Staged {new Date(source.stagedAt).toLocaleDateString()}</span>
              {source.externalUrl && (
                <a
                  href={source.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-3 h-3" />
                  View source
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {sourceState.sourceType === 'url' && !sourceState.contentPreview && (
              <button
                onClick={handleRefresh}
                disabled={refreshing || processing}
                title="Fetch and extract content from URL"
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Fetch Content
              </button>
            )}
            {sourceState.status === 'PENDING' && (
              <>
                <button
                  onClick={() => handleAction('process')}
                  disabled={processing || refreshing}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Process
                </button>
                <button
                  onClick={() => handleAction('ignore')}
                  disabled={processing || refreshing}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Ignore
                </button>
              </>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && sourceState.contentPreview && (
        <div className="px-4 pb-4">
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {sourceState.contentPreview}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
