'use client';

/**
 * Slack Bot Channel Configuration Panel
 * Separate from SlackChannelPanel (ingestion/source channels)
 * Allows admins to configure which channels the bot responds in
 */

import { useState, useEffect } from 'react';
import { Loader2, X, Plus, RotateCcw } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface SlackChannel {
  id: string;
  name: string;
  isMember?: boolean;
}

interface SlackBotChannelPanelProps {
  libraryId: LibraryId;
  customerId?: string;
}

export function SlackBotChannelPanel({ libraryId, customerId }: SlackBotChannelPanelProps) {
  const [botChannels, setBotChannels] = useState<SlackChannel[]>([]);
  const [manualChannelName, setManualChannelName] = useState<string>('');
  const [fetchingManualChannel, setFetchingManualChannel] = useState(false);
  const [manualChannelError, setManualChannelError] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [configChanged, setConfigChanged] = useState(false);

  // Load saved bot channels on mount
  useEffect(() => {
    const loadSavedBotChannels = async () => {
      try {
        const params = [`libraryId=${libraryId}`];
        if (customerId) params.push(`customerId=${customerId}`);
        const response = await fetch(`/api/v2/integrations/slack/status?${params.join('&')}`);
        if (response.ok) {
          const data = await response.json();
          const responseData = data.data || data;
          const botChannelData = responseData.botChannelData || [];
          if (botChannelData.length > 0) {
            setBotChannels(botChannelData);
          }
        }
      } catch (error) {
        console.error('Failed to load saved bot channels:', error);
      }
    };
    loadSavedBotChannels();
  }, [libraryId, customerId]);

  const persistBotChannels = async (channels: SlackChannel[]) => {
    setIsSavingConfig(true);
    setManualChannelError('');
    setRestartMessage(null);
    try {
      const response = await fetch('/api/v2/integrations/slack/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          botChannels: channels,
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

      // Config was saved successfully, mark that it needs restart
      setConfigChanged(true);
    } catch (error) {
      console.error('Failed to save Slack bot channels:', error);
      setManualChannelError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSavingConfig(false);
    }
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
          throw new Error('Bot does not have permission to access this channel. Invite the bot first.');
        } else {
          throw new Error(errorMessage);
        }
      }

      const data = await response.json();
      if (!data.channel) {
        throw new Error('Invalid response from channel lookup');
      }

      const channel: SlackChannel = data.channel;

      // Step 2: Add to bot channels list
      const updatedChannels = botChannels.some((c) => c.id === channel.id)
        ? botChannels
        : [...botChannels, channel];

      setBotChannels(updatedChannels);
      await persistBotChannels(updatedChannels);
      setManualChannelName('');
    } catch (error) {
      console.error('Failed to fetch/save channel:', error);
      setManualChannelError(error instanceof Error ? error.message : 'Failed to fetch channel');
    } finally {
      setFetchingManualChannel(false);
    }
  };

  const handleRemoveChannel = async (channelId: string) => {
    const updatedChannels = botChannels.filter((c) => c.id !== channelId);
    setBotChannels(updatedChannels);
    await persistBotChannels(updatedChannels);
  };

  const handleRestartBot = async () => {
    setIsRestarting(true);
    setRestartMessage(null);
    try {
      const response = await fetch('/api/v2/integrations/slack/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `Server error (${response.status})`;

        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to restart the bot.');
        } else {
          throw new Error(errorMessage);
        }
      }

      const result = await response.json();
      if (result.success) {
        setRestartMessage({
          text: 'Bot restarted successfully. New configuration is now active.',
          type: 'success',
        });
        setConfigChanged(false);
      } else {
        throw new Error(result.error || 'Failed to restart bot');
      }
    } catch (error) {
      console.error('Failed to restart bot:', error);
      setRestartMessage({
        text: error instanceof Error ? error.message : 'Failed to restart bot',
        type: 'error',
      });
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Bot Response Channels</h3>
          {configChanged && (
            <button
              onClick={handleRestartBot}
              disabled={isRestarting}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isRestarting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3 h-3" />
                  Restart Bot
                </>
              )}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Configure which channels the bot will respond in. Bot will only respond when mentioned in these channels.
        </p>

        {configChanged && !restartMessage && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-4">
            <p className="text-sm text-blue-800">
              ⚙️ Configuration updated. Click &quot;Restart Bot&quot; to apply changes.
            </p>
          </div>
        )}

        {restartMessage && (
          <div
            className={`rounded-lg p-3 border mb-4 ${
              restartMessage.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p
              className={`text-sm ${
                restartMessage.type === 'success'
                  ? 'text-green-800'
                  : 'text-red-800'
              }`}
            >
              {restartMessage.type === 'success' ? '✓' : '✕'} {restartMessage.text}
            </p>
          </div>
        )}

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

        {/* Configured Channels List */}
        {botChannels.length > 0 ? (
          <div className="space-y-2">
            {botChannels.map((channel) => (
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
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
            <p className="text-sm text-yellow-800">
              No bot response channels configured. Bot will not respond when mentioned.
            </p>
          </div>
        )}

        {isSavingConfig && <p className="text-xs text-gray-500 mt-2">Saving settings...</p>}
      </div>
    </div>
  );
}
