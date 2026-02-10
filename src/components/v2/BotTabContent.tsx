'use client';

/**
 * BotTabContent Component
 *
 * Displays bot Q&A interactions, current prompt, and setup instructions.
 * Provides read-only visibility into the bot configuration for transparency.
 *
 * The prompt is loaded from the V2 prompt composition system (core-blocks),
 * making Admin > Prompts the single source of truth.
 */

import { useState, useMemo } from 'react';
import { Bot, ChevronDown, Copy, Check } from 'lucide-react';
import { slackBotCompositions } from '@/lib/v2/prompts/compositions/slack-bot-compositions';
import { getBlocks } from '@/lib/v2/prompts/blocks/core-blocks';

interface BotInteraction {
  id: string;
  title: string;
  contentPreview: string | null;
  stagedAt: Date;
}

interface BotTabContentProps {
  libraryId: 'knowledge' | 'it' | 'gtm';
  pendingBot: BotInteraction[];
}

/**
 * Build the system prompt from the V2 prompt composition system.
 * This reads from core-blocks.ts which can be edited in Admin > Prompts.
 */
function buildSystemPrompt(libraryId: 'knowledge' | 'it' | 'gtm'): string {
  const compositionContext = `slack_bot_${libraryId}`;
  const composition = slackBotCompositions.find(c => c.context === compositionContext);

  if (!composition) {
    return 'Prompt not configured.';
  }

  const blocks = getBlocks(composition.blockIds);
  return blocks.map(block => block.content).join('\n\n');
}

export function BotTabContent({ libraryId, pendingBot }: BotTabContentProps) {
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Build prompt from V2 composition system (same source as the actual bot)
  const currentPrompt = useMemo(() => buildSystemPrompt(libraryId), [libraryId]);

  const handleCopyPrompt = () => {
    if (currentPrompt) {
      navigator.clipboard.writeText(currentPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const getLibraryLabel = () => {
    switch (libraryId) {
      case 'knowledge':
        return 'Skills';
      case 'it':
        return 'IT Support';
      case 'gtm':
        return 'GTM';
      default:
        return libraryId;
    }
  };

  const getSetupInstructions = () => {
    const label = getLibraryLabel();
    return `To enable the ${label} bot in Slack:
1. Go to your workspace's #${libraryId}-questions channel
2. Invite @${libraryId}-bot to the channel
3. The bot will respond to questions mentioning @${libraryId}-bot
4. Bot interactions will appear here for review`;
  };

  return (
    <div className="space-y-6">
      {/* Bot Configuration Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Bot Configuration</h3>
        </div>

        {/* Current Prompt - loaded from V2 composition system */}
        {currentPrompt && currentPrompt !== 'Prompt not configured.' && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Current System Prompt</h4>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setExpandedPrompt(!expandedPrompt)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex-1 pr-4">
                  <p className="text-sm text-gray-600 line-clamp-2">{currentPrompt}</p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                    expandedPrompt ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {expandedPrompt && (
              <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentPrompt}</p>
              </div>
            )}
          </div>
        )}

        {/* Setup Instructions */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Setup Instructions</h4>
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-900 whitespace-pre-wrap">{getSetupInstructions()}</p>
          </div>
        </div>
      </div>

      {/* Bot Interactions Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Q&A Interactions</h3>
          <p className="text-sm text-gray-600 mt-1">
            {pendingBot.length} {pendingBot.length === 1 ? 'interaction' : 'interactions'} awaiting review
          </p>
        </div>

        {pendingBot.length === 0 ? (
          <div className="p-12 text-center">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Q&A awaiting review</h4>
            <p className="text-gray-500">Bot interactions from Slack will appear here once the bot is active.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingBot.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.title}</h4>
                    {item.contentPreview && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.contentPreview}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(item.stagedAt).toLocaleDateString()} at {new Date(item.stagedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
