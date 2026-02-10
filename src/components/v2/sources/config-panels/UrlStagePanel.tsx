'use client';

/**
 * URL Stage Configuration Panel
 * Allows users to stage URLs for skill generation
 */

import { useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface UrlStagePanelProps {
  libraryId: LibraryId;
  customerId?: string;
  onStageSuccess: () => Promise<void>;
}

export function UrlStagePanel({ libraryId, customerId, onStageSuccess }: UrlStagePanelProps) {
  const [urls, setUrls] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const urlList = urls
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      if (urlList.length === 0) {
        setError('Please enter at least one URL');
        setIsLoading(false);
        return;
      }

      // Validate URLs
      for (const url of urlList) {
        try {
          new URL(url);
        } catch {
          setError(`Invalid URL: ${url}`);
          setIsLoading(false);
          return;
        }
      }

      // Fetch and stage each URL
      const results = await Promise.allSettled(
        urlList.map(async (url) => {
          // Initialize fallback data - stage URL even if content fetch fails
          let stageData = {
            title: url,
            content: '',
            contentPreview: '',
            metadata: {},
          };

          // Try to fetch the URL content, but don't fail if it doesn't work
          try {
            const fetchResponse = await fetch('/api/v2/sources/fetch-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            });

            if (fetchResponse.ok) {
              const fetchedData = await fetchResponse.json();
              stageData = {
                title: fetchedData.title || url,
                content: fetchedData.content || '',
                contentPreview: fetchedData.contentPreview || '',
                metadata: fetchedData.metadata || {},
              };
            }
          } catch {
            // Fetch error - use fallback
          }

          // Stage the source
          const stageResponse = await fetch('/api/v2/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceType: 'url',
              externalId: url,
              libraryId,
              title: stageData.title,
              content: stageData.content,
              contentPreview: stageData.contentPreview,
              metadata: { url, ...stageData.metadata },
              ...(customerId && { customerId }),
            }),
          });

          if (!stageResponse.ok) {
            const errorData = await stageResponse.json();
            throw new Error(errorData.error || `Failed to stage ${url}`);
          }

          return stageResponse.json();
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected');

      if (succeeded > 0) {
        setSuccess(`Successfully staged ${succeeded} URL${succeeded !== 1 ? 's' : ''}`);
        setUrls('');
        await onStageSuccess();
      }

      if (failed.length > 0) {
        const errorMessages = failed
          .map((f) => (f as PromiseRejectedResult).reason?.message || 'Unknown error')
          .join(', ');
        setError(`Failed to stage ${failed.length} URL${failed.length !== 1 ? 's' : ''}: ${errorMessages}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stage URLs');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Stage URLs</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="Enter URLs (one per line)&#10;https://example.com/docs&#10;https://docs.example.com"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          disabled={isLoading}
        />

        {error && (
          <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <span className="text-xs text-red-800">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <span className="text-xs text-green-800">{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || urls.trim().length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Staging...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Stage URLs
            </>
          )}
        </button>
      </form>
    </div>
  );
}
