/**
 * Notion Source Handler for V2 Integration APIs
 *
 * Provides unified interface for Notion page discovery and staging.
 * Wraps the NotionDiscoveryAdapter with V2 response formatting.
 */

import { BaseSourceHandler } from './base-handler';
import { NotionDiscoveryAdapter } from '@/lib/v2/sources/adapters/notion-adapter';
import type { DiscoveryParams, DiscoveryResponse, DiscoveredItem } from '../types';

/**
 * Notion-specific discovered item with page metadata
 */
export interface NotionDiscoveredItem extends DiscoveredItem {
  pageId: string;
  url?: string;
  lastEditedTime?: string;
  createdTime?: string;
  parentType?: string;
  parentId?: string;
}

export class NotionSourceHandler extends BaseSourceHandler {
  readonly sourceType = 'notion' as const;
  readonly displayName = 'Notion Pages';

  private adapter = new NotionDiscoveryAdapter();

  /**
   * Discover pages from Notion.
   */
  async discover(params: DiscoveryParams): Promise<DiscoveryResponse<NotionDiscoveredItem>> {
    const { libraryId, customerId, limit, since } = params;

    const discovered = await this.adapter.discover({
      libraryId,
      customerId,
      limit,
      since,
    });

    // Map adapter response to unified format
    const items: NotionDiscoveredItem[] = discovered.map((d) => {
      const metadata = d.metadata as {
        pageId?: string;
        url?: string;
        lastEditedTime?: string;
        createdTime?: string;
        parentType?: string;
        parentId?: string;
      };

      return {
        externalId: d.externalId,
        title: d.title,
        content: d.content || '',
        contentPreview: d.contentPreview || '',
        metadata: d.metadata as unknown as Record<string, unknown>,
        pageId: metadata.pageId || d.externalId,
        url: metadata.url,
        lastEditedTime: metadata.lastEditedTime,
        createdTime: metadata.createdTime,
        parentType: metadata.parentType,
        parentId: metadata.parentId,
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
   * Test Notion connection.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.adapter.testConnection();
  }
}

// Export singleton instance
export const notionHandler = new NotionSourceHandler();
