'use client';

/**
 * URL Stage Form Component
 *
 * Allows users to input URLs to stage for skill generation.
 */

import { useState } from 'react';
import { Plus, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface UrlStageFormProps {
  libraryId: LibraryId;
  onSuccess?: () => void;
}

export function UrlStageForm({ libraryId, onSuccess }: UrlStageFormProps) {
  const [urls, setUrls] = useState<string>('');
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

      // Fetch and stage each URL
      const results = await Promise.allSettled(
        urlList.map(async (url) => {
          // First, fetch the URL content
          const fetchResponse = await fetch('/api/v2/sources/fetch-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });

          if (!fetchResponse.ok) {
            const errorData = await fetchResponse.json();
            throw new Error(errorData.error || `Failed to fetch ${url}`);
          }

          const fetchedData = await fetchResponse.json();

          // Then stage the source with the fetched content
          const stageResponse = await fetch('/api/v2/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceType: 'url',
              externalId: url,
              libraryId,
              title: fetchedData.title,
              content: fetchedData.content,
              contentPreview: fetchedData.contentPreview,
              metadata: { url, ...fetchedData.metadata },
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

        if (onSuccess) {
          setTimeout(onSuccess, 1000);
        }
      }

      if (failed.length > 0) {
        const errorMessages = failed
          .map((f) => `${urlList[results.indexOf(f)]}: ${(f as PromiseRejectedResult).reason?.message || 'Unknown error'}`)
          .join('\n');
        setError(`Failed to stage ${failed.length} URL${failed.length !== 1 ? 's' : ''}:\n${errorMessages}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stage URLs');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="urls" className="block text-sm font-medium text-gray-700 mb-2">
          URLs to Stage
        </label>
        <textarea
          id="urls"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="Enter URLs (one per line)&#10;https://example.com/docs&#10;https://docs.example.com"
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter one URL per line. URLs will be fetched and staged for skill generation.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800 whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || urls.trim().length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
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
  );
}
