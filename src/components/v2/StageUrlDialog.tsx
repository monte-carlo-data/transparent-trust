'use client';

/**
 * Stage URL Dialog Component
 *
 * Modal dialog for staging URLs directly from the skills library.
 */

import { useState } from 'react';
import { X, Plus, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface StageUrlDialogProps {
  libraryId: LibraryId;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  customerId?: string;
}

export function StageUrlDialog({ libraryId, isOpen, onClose, onSuccess, customerId }: StageUrlDialogProps) {
  const [urls, setUrls] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

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
            // If fetch fails, we'll use the fallback data above
          } catch {
            // Fetch error (network, timeout, etc.) - use fallback
          }

          // Stage the source with whatever content we have
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

        if (onSuccess) {
          setTimeout(onSuccess, 1500);
        }

        if (failed.length === 0) {
          setTimeout(onClose, 1500);
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

  const handleClose = () => {
    if (!isLoading) {
      setUrls('');
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Stage URLs</h2>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label htmlFor="urls" className="block text-sm font-medium text-gray-700 mb-2">
                URLs to Stage
              </label>
              <textarea
                id="urls"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="Enter URLs (one per line)&#10;https://example.com/docs&#10;https://docs.example.com"
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                URLs will be fetched and added to the {libraryId} library staging area.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div className="text-xs text-red-800 whitespace-pre-wrap">{error}</div>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div className="text-xs text-green-800">{success}</div>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || urls.trim().length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Staging...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Stage
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
