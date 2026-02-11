/**
 * Zendesk Source Handler for V2 Integration APIs
 *
 * Provides unified interface for Zendesk ticket discovery and staging.
 * Wraps the ZendeskDiscoveryAdapter with V2 response formatting.
 */

import { BaseSourceHandler } from './base-handler';
import { ZendeskDiscoveryAdapter } from '@/lib/v2/sources/adapters/zendesk-adapter';
import type { DiscoveryParams, DiscoveryResponse, DiscoveredItem } from '../types';

/**
 * Zendesk-specific discovered item with ticket metadata
 */
export interface ZendeskDiscoveredItem extends DiscoveredItem {
  ticketId: string;
  status?: string;
  priority?: string;
  requester?: string;
  assignee?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class ZendeskSourceHandler extends BaseSourceHandler {
  readonly sourceType = 'zendesk' as const;
  readonly displayName = 'Zendesk Tickets';

  private adapter = new ZendeskDiscoveryAdapter();

  /**
   * Discover tickets from Zendesk.
   */
  async discover(params: DiscoveryParams): Promise<DiscoveryResponse<ZendeskDiscoveredItem>> {
    const { libraryId, customerId, limit, since, page = 1 } = params;

    const discovered = await this.adapter.discover({
      libraryId,
      customerId,
      limit,
      since,
    });

    // Map adapter response to unified format
    const items: ZendeskDiscoveredItem[] = discovered.map((d) => {
      const metadata = d.metadata as {
        ticketId?: number;
        status?: string;
        priority?: string;
        requesterName?: string;
        assigneeName?: string;
        tags?: string[];
        createdAt?: string;
        updatedAt?: string;
      };

      return {
        externalId: d.externalId,
        title: d.title,
        content: d.content || '',
        contentPreview: d.contentPreview || '',
        metadata: d.metadata as unknown as Record<string, unknown>,
        ticketId: String(metadata.ticketId || d.externalId),
        status: metadata.status,
        priority: metadata.priority,
        requester: metadata.requesterName,
        assignee: metadata.assigneeName,
        tags: metadata.tags,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      };
    });

    const hasMore = discovered.length >= limit;

    return {
      items,
      pagination: {
        hasMore,
        page,
        nextPage: hasMore ? page + 1 : undefined,
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
   * Test Zendesk connection.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.adapter.testConnection();
  }
}

// Export singleton instance
export const zendeskHandler = new ZendeskSourceHandler();
