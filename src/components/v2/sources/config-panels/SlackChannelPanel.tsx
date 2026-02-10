'use client';

/**
 * Slack Channel Configuration Panel
 * For source/ingestion channels (separate from bot response channels)
 * Supports multiple channels for knowledge discovery
 */

import { useState, useEffect } from 'react';
import { Loader2, X, Plus } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface SlackChannel {
  id: string;
  name: string;
  isMember?: boolean;
}

interface SlackChannelPanelProps {
  libraryId: LibraryId;
  customerId?: string;
}

export function SlackChannelPanel({ libraryId, customerId }: SlackChannelPanelProps) {
  const [sourceChannels, setSourceChannels] = useState<SlackChannel[]>([]);
  const [manualChannelName, setManualChannelName] = useState<string>('');
  const [fetchingManualChannel, setFetchingManualChannel] = useState(false);
  const [manualChannelError, setManualChannelError] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [includeThreadsOnly, setIncludeThreadsOnly] = useState(() => !customerId);
  const [minReplyCount, setMinReplyCount] = useState(() => (customerId ? 0 : 1));

  // Load saved source channels on mount
  useEffect(() => {
    const loadSavedChannels = async () => {
      try {
        const params = [`libraryId=${libraryId}`];
        if (customerId) params.push(`customerId=${customerId}`);
        const response = await fetch(`/api/v2/integrations/slack/status?${params.join('&')}`);
        if (response.ok) {
          const data = await response.json();
          const responseData = data.data || data;
          const channelData = responseData.selectedChannelData || [];
          const config = responseData.config || {};
          if (typeof config.includeThreadsOnly === 'boolean') {
            setIncludeThreadsOnly(config.includeThreadsOnly);
          }
          if (typeof config.minReplyCount === 'number') {
            setMinReplyCount(config.minReplyCount);
          }
          if (channelData.length > 0) {
            setSourceChannels(channelData);
          }
        }
      } catch (error) {
        console.error('Failed to load saved channels:', error);
      }
    };
    loadSavedChannels();
  }, [libraryId, customerId]);

  const persistSourceChannels = async (channels: SlackChannel[]) => {
    setIsSavingConfig(true);
    setManualChannelError('');
    try {
      const response = await fetch('/api/v2/integrations/slack/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          channels,
          includeThreadsOnly,
          minReplyCount,
          ...(customerId && { customerId }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `Server error (${response.status})`;

        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to modify this configuration.');
        } else {
          throw new Error(`Failed to save settings: ${errorMessage}`);
        }
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save Slack settings:', error);
      setManualChannelError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const persistConfig = async (nextIncludeThreadsOnly: boolean, nextMinReplyCount: number) => {
    if (sourceChannels.length === 0) return;

    // Save previous values for rollback
    const prevIncludeThreadsOnly = includeThreadsOnly;
    const prevMinReplyCount = minReplyCount;

    setIncludeThreadsOnly(nextIncludeThreadsOnly);
    setMinReplyCount(nextMinReplyCount);

    setIsSavingConfig(true);
    setManualChannelError('');
    try {
      const response = await fetch('/api/v2/integrations/slack/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          channels: sourceChannels,
          includeThreadsOnly: nextIncludeThreadsOnly,
          minReplyCount: nextMinReplyCount,
          ...(customerId && { customerId }),
        }),
      });

      // Check HTTP status before parsing
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `Server error (${response.status})`;

        // Rollback optimistic state changes
        setIncludeThreadsOnly(prevIncludeThreadsOnly);
        setMinReplyCount(prevMinReplyCount);

        // User-friendly error messages
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to modify this configuration.');
        } else {
          throw new Error(`Failed to save settings: ${errorMessage}`);
        }
      }

      const result = await response.json();
      if (!result.success) {
        // Rollback on API failure
        setIncludeThreadsOnly(prevIncludeThreadsOnly);
        setMinReplyCount(prevMinReplyCount);
        throw new Error(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save Slack settings:', error);
      setManualChannelError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleThreadsOnly = async () => {
    if (isSavingConfig) return; // Prevent concurrent saves
    const nextIncludeThreadsOnly = !includeThreadsOnly;
    setIncludeThreadsOnly(nextIncludeThreadsOnly);
    await persistConfig(nextIncludeThreadsOnly, minReplyCount);
  };

  const handleFetchManualChannel = async () => {
    if (!manualChannelName.trim()) {
      setManualChannelError('Please enter a channel name or ID');
      return;
    }

    setFetchingManualChannel(true);
    setManualChannelError('');

    try {
      // Step 1: Lookup channel via V2 API
      const response = await fetch('/api/v2/integrations/slack/channels/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: manualChannelName,
          libraryId,
          ...(customerId && { customerId }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Failed to fetch channel';

        if (response.status === 404) {
          throw new Error(`Channel not found. Check the channel ID and ensure the bot is invited.`);
        } else if (response.status === 403) {
          throw new Error('You do not have permission to access this library.');
        } else {
          throw new Error(errorMessage);
        }
      }

      const data = await response.json();
      if (!data.channel) {
        throw new Error('Invalid response from channel lookup');
      }
      const channel: SlackChannel = data.channel;

      // Step 2: Add to source channels list
      const updatedChannels = sourceChannels.some((c) => c.id === channel.id)
        ? sourceChannels
        : [...sourceChannels, channel];

      setSourceChannels(updatedChannels);
      await persistSourceChannels(updatedChannels);
      setManualChannelName('');
    } catch (error) {
      console.error('Failed to fetch/save channel:', error);
      setManualChannelError(error instanceof Error ? error.message : 'Failed to fetch channel');
    } finally {
      setFetchingManualChannel(false);
    }
  };

  const handleRemoveChannel = async (channelId: string) => {
    const updatedChannels = sourceChannels.filter((c) => c.id !== channelId);
    setSourceChannels(updatedChannels);
    await persistSourceChannels(updatedChannels);
  };


  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Source Channels</h3>
        <p className="text-xs text-gray-500 mb-4">
          Configure which channels to discover knowledge from. Bot uses these for ingestion/indexing.
        </p>

        {/* Manual Channel Lookup */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter channel ID (e.g., C05ABC123) or name"
            value={manualChannelName}
            onChange={(e) => setManualChannelName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchManualChannel()}
            disabled={fetchingManualChannel || isSavingConfig}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleFetchManualChannel}
            disabled={fetchingManualChannel || !manualChannelName.trim() || isSavingConfig}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            {fetchingManualChannel ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Channel
              </>
            )}
          </button>
        </div>

        {manualChannelError && <p className="text-xs text-red-600 mb-4">{manualChannelError}</p>}

        {/* Configured Source Channels List */}
        {sourceChannels.length > 0 ? (
          <div className="space-y-2 mb-4">
            {sourceChannels.map((channel) => (
              <div
                key={channel.id}
                className="bg-green-50 rounded-lg p-3 border border-green-200 flex items-center justify-between"
              >
                <p className="text-sm text-green-800 font-medium">✓ #{channel.name}</p>
                <button
                  onClick={() => handleRemoveChannel(channel.id)}
                  disabled={isSavingConfig}
                  className="px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 mb-4">
            <p className="text-sm text-yellow-800">
              No source channels configured. Bot discovery is disabled.
            </p>
          </div>
        )}

        {/* Discovery Settings */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Only threaded conversations</p>
              <p className="text-xs text-gray-500">Turn off to include standalone messages.</p>
            </div>
            <button
              type="button"
              onClick={handleToggleThreadsOnly}
              disabled={isSavingConfig}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includeThreadsOnly ? 'bg-blue-600' : 'bg-gray-300'
              } ${isSavingConfig ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-pressed={includeThreadsOnly}
              aria-label="Toggle threaded-only Slack discovery"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  includeThreadsOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {isSavingConfig && <p className="text-xs text-gray-500 mt-2">Saving settings...</p>}
      </div>
    </div>
  );
}
