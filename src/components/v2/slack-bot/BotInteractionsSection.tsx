'use client';

/**
 * BotInteractionsSection Component
 *
 * Displays pending bot interactions awaiting review.
 * Part of the unified Slack Bot tab.
 */

import { Bot } from 'lucide-react';
import type { BotInteraction } from '@/lib/v2/bot-interactions';

// Re-export the type for convenience
export type { BotInteraction };

interface BotInteractionsSectionProps {
  pendingBot: BotInteraction[];
}

export function BotInteractionsSection({ pendingBot }: BotInteractionsSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Bot Interactions</h3>
        <p className="text-sm text-gray-600 mt-1">
          {pendingBot.length} {pendingBot.length === 1 ? 'interaction' : 'interactions'} awaiting
          review
        </p>
      </div>

      {pendingBot.length === 0 ? (
        <div className="p-12 text-center">
          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No interactions awaiting review</h4>
          <p className="text-gray-500">
            Bot interactions from Slack will appear here once the bot is active.
          </p>
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
                    {new Date(item.stagedAt).toLocaleDateString()} at{' '}
                    {new Date(item.stagedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
