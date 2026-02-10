/**
 * Slack Source Handler for V2 Integration APIs
 *
 * Provides unified interface for Slack thread discovery and staging.
 * Wraps the SlackDiscoveryAdapter with V2 response formatting.
 */

import { BaseSourceHandler } from './base-handler';
import { SlackDiscoveryAdapter } from '@/lib/v2/sources/adapters/slack-adapter';
import type { DiscoveryParams, DiscoveryResponse, DiscoveredItem } from '../types';

/**
 * Slack-specific discovered item with thread metadata
 */
export interface SlackDiscoveredItem extends DiscoveredItem {
  threadTs: string;
  channelId?: string;
  channelName?: string;
  replyCount?: number;
  permalink?: string;
}

export class SlackSourceHandler extends BaseSourceHandler {
  readonly sourceType = 'slack' as const;
  readonly displayName = 'Slack Threads';

  private adapter = new SlackDiscoveryAdapter();

  /**
   * Discover threads from Slack.
   */
  async discover(params: DiscoveryParams): Promise<DiscoveryResponse<SlackDiscoveredItem>> {
    const { libraryId, customerId, limit, since } = params;

    const discovered = await this.adapter.discover({
      libraryId,
      customerId,
      limit,
      since,
    });

    // Map adapter response to unified format
    const items: SlackDiscoveredItem[] = discovered.map((d) => {
      const metadata = d.metadata as {
        threadTs?: string;
        channelId?: string;
        channelName?: string;
        replyCount?: number;
        permalink?: string;
      };

      return {
        externalId: d.externalId,
        title: d.title,
        content: d.content || '',
        contentPreview: d.contentPreview || '',
        metadata: d.metadata as unknown as Record<string, unknown>,
        threadTs: metadata.threadTs || d.externalId.split(':')[1] || d.externalId,
        channelId: metadata.channelId,
        channelName: metadata.channelName,
        replyCount: metadata.replyCount,
        permalink: metadata.permalink,
      };
    });

    const hasMore = discovered.length >= limit;

    return {
      items,
      pagination: {
        hasMore,
        totalFound: discovered.length,
      },
      meta: {
        sourceType: this.sourceType,
        libraryId,
        customerId,
      },
    };
  }

  /**
   * Test Slack connection.
   */
  async testConnection(libraryId: string, customerId?: string): Promise<{ success: boolean; error?: string }> {
    return this.adapter.testConnection({ libraryId: libraryId as import('@/types/v2').LibraryId, customerId });
  }

  /**
   * Get available channels the bot can access.
   */
  async getAvailableChannels(libraryId: string, customerId?: string) {
    return this.adapter.getAvailableChannels({ libraryId: libraryId as import('@/types/v2').LibraryId, customerId });
  }
}

// Export singleton instance
export const slackHandler = new SlackSourceHandler();
