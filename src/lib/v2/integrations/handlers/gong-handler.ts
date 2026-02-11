/**
 * Gong Source Handler for V2 Integration APIs
 *
 * Provides unified interface for Gong call discovery and staging.
 * Wraps the GongDiscoveryAdapter with V2 response formatting.
 */

import { BaseSourceHandler } from './base-handler';
import { GongDiscoveryAdapter } from '@/lib/v2/sources/adapters/gong-adapter';
import type { DiscoveryParams, DiscoveryResponse, DiscoveredItem } from '../types';

/**
 * Gong-specific discovered item with call metadata
 */
export interface GongDiscoveredItem extends DiscoveredItem {
  callId: string;
  duration?: number;
  scheduledStart?: string;
  actualStart?: string;
  speakers?: Array<{ name: string; email?: string }>;
  customerName?: string;
}

export class GongSourceHandler extends BaseSourceHandler {
  readonly sourceType = 'gong' as const;
  readonly displayName = 'Gong Calls';

  private adapter = new GongDiscoveryAdapter();

  /**
   * Discover calls from Gong.
   */
  async discover(params: DiscoveryParams): Promise<DiscoveryResponse<GongDiscoveredItem>> {
    const { libraryId, customerId, limit, since, cursor } = params;

    const discovered = await this.adapter.discover({
      libraryId,
      customerId,
      limit,
      since,
      cursor,
    });

    // Extract cursor from adapter response (attached as array property)
    const nextCursor = (discovered as { _cursor?: string })._cursor;

    // Map adapter response to unified format
    const items: GongDiscoveredItem[] = discovered.map((d) => {
      const metadata = d.metadata as {
        callId?: string;
        duration?: number;
        scheduledStart?: string;
        actualStart?: string;
        speakers?: Array<{ name: string; email?: string }>;
        customerName?: string;
      };

      return {
        externalId: d.externalId,
        title: d.title,
        content: d.content || '',
        contentPreview: d.contentPreview || '',
        metadata: d.metadata as unknown as Record<string, unknown>,
        callId: metadata.callId || d.externalId,
        duration: metadata.duration,
        scheduledStart: metadata.scheduledStart,
        actualStart: metadata.actualStart,
        speakers: metadata.speakers,
        customerName: metadata.customerName,
      };
    });

    const hasMore = discovered.length >= limit || !!nextCursor;

    return {
      items,
      pagination: {
        hasMore,
        totalFound: discovered.length,
        cursor: nextCursor,
      },
      meta: {
        sourceType: this.sourceType,
        libraryId,
        customerId,
      },
    };
  }

  /**
   * Test Gong connection.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.adapter.testConnection();
  }
}

// Export singleton instance
export const gongHandler = new GongSourceHandler();
