'use client';

/**
 * Slack Integration Settings Component
 *
 * Allows users to verify Slack bot connection:
 * - View connection status
 * - Test bot connection
 * - Instructions to invite bot to channels
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Check, Loader2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LibraryId } from '@/types/v2';

interface SlackIntegrationSettingsProps {
  libraryId: LibraryId;
}

export function SlackIntegrationSettings({ libraryId }: SlackIntegrationSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<{
    configured: boolean;
    connected: boolean;
    error?: string;
  } | null>(null);

  // Load Slack connection status on mount
  useEffect(() => {
    const loadSlackStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v2/integrations/slack/status?libraryId=${libraryId}`);
      if (!response.ok) {
        throw new Error('Failed to load Slack status');
      }
      const data = await response.json();
      setConnectionStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Slack status');
      setConnectionStatus({ configured: false, connected: false });
    } finally {
      setIsLoading(false);
    }
    };
    loadSlackStatus();
  }, [libraryId]);

  const handleTestConnection = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v2/integrations/slack/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      setConnectionStatus(data.status);
      setSuccessMessage('Slack bot connection successful!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading Slack integration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Slack Integration
          </h3>
          <p className="text-sm text-gray-600 mt-1">The bot will respond to mentions in any channel it&apos;s invited to</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Status Section */}
      {connectionStatus && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-3 h-3 rounded-full',
                connectionStatus.connected ? 'bg-green-500' : 'bg-gray-300'
              )}
            />
            <span className="text-sm font-medium text-gray-900">
              {connectionStatus.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          {!connectionStatus.configured && (
            <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <strong>Setup Required:</strong> Slack bot token not configured in AWS Secrets Manager.
              The token should be named: <code className="bg-yellow-100 px-1 rounded">slack-bot-token-{libraryId}</code>
            </div>
          )}

          {connectionStatus.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {connectionStatus.error}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleTestConnection}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Setup Instructions:</strong>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Invite the bot to channels where you want it to respond (@mention it)</li>
          <li>Give the bot permission to read messages and post replies</li>
          <li>Click &quot;Test Connection&quot; to verify the bot is working</li>
        </ul>
      </div>
    </div>
  );
}
