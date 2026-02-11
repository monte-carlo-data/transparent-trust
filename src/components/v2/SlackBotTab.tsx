'use client';

/**
 * SlackBotTab Component
 *
 * Unified Slack Bot tab that combines:
 * - Bot Response Channel Configuration (always visible at top)
 * - Bot Interactions awaiting review
 * - Bot Prompt Editor (admin only, collapsible)
 * - Setup Instructions (collapsible)
 *
 * This component composes independent sub-sections for clean separation of concerns.
 */

import { SlackBotChannelPanel } from '@/components/v2/sources/config-panels/SlackBotChannelPanel';
import {
  BotInteractionsSection,
  BotPromptEditorSection,
  BotSetupSection,
  type BotInteraction,
} from '@/components/v2/slack-bot';

interface SlackBotTabProps {
  libraryId: 'knowledge' | 'it' | 'gtm' | 'talent';
  pendingBot: BotInteraction[];
  customerId?: string;
  isAdmin?: boolean;
}

export function SlackBotTab({
  libraryId,
  pendingBot,
  customerId,
  isAdmin = false,
}: SlackBotTabProps) {
  return (
    <div className="space-y-4">
      {/* Bot Channel Configuration - Always Visible */}
      <SlackBotChannelPanel libraryId={libraryId} customerId={customerId} />

      {/* Bot Interactions Section */}
      <BotInteractionsSection pendingBot={pendingBot} />

      {/* Edit Bot Prompt Section - Admin Only, Collapsible */}
      <BotPromptEditorSection libraryId={libraryId} isAdmin={isAdmin} />

      {/* Setup Instructions Section - Collapsible */}
      <BotSetupSection libraryId={libraryId} />
    </div>
  );
}
