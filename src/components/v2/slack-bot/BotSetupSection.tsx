'use client';

/**
 * BotSetupSection Component
 *
 * Collapsible setup instructions for the Slack bot.
 * Part of the unified Slack Bot tab.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface BotSetupSectionProps {
  libraryId: 'knowledge' | 'it' | 'gtm' | 'talent';
}

function getLibraryLabel(libraryId: 'knowledge' | 'it' | 'gtm' | 'talent'): string {
  switch (libraryId) {
    case 'knowledge':
      return 'Skills';
    case 'it':
      return 'IT Support';
    case 'gtm':
      return 'GTM';
    case 'talent':
      return 'Talent';
    default:
      return libraryId;
  }
}

function getSetupInstructions(libraryId: 'knowledge' | 'it' | 'gtm' | 'talent'): string {
  const label = getLibraryLabel(libraryId);
  return `To enable the ${label} bot in Slack:
1. Go to your workspace's #${libraryId}-questions channel
2. Invite @${libraryId}-bot to the channel
3. The bot will respond to questions mentioning @${libraryId}-bot
4. Bot interactions will appear here for review`;
}

export function BotSetupSection({ libraryId }: BotSetupSectionProps) {
  const [setupExpanded, setSetupExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setSetupExpanded(!setupExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-900">Setup Instructions</span>
        {setupExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {setupExpanded && (
        <div className="p-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-900 whitespace-pre-wrap">
              {getSetupInstructions(libraryId)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
