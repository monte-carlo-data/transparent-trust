/**
 * Base Discovery Adapter
 *
 * Abstract base class for all discovery adapters.
 * Provides common functionality and enforces the adapter interface.
 */

import type {
  DiscoveryAdapter,
  DiscoveryOptions,
  DiscoveredSource,
  TypedStagedSource,
  SourceType,
} from '@/types/v2';
import { stageSource, stageSources } from '../staged-source-service';
import type { StageSourceInput } from '@/types/v2';

export abstract class BaseDiscoveryAdapter<T extends TypedStagedSource>
  implements DiscoveryAdapter<T>
{
  abstract readonly sourceType: T['sourceType'];
  abstract readonly displayName: string;

  /**
   * Discover new sources from the external system.
   * Must be implemented by each adapter.
   */
  abstract discover(options: DiscoveryOptions): Promise<DiscoveredSource<T>[]>;

  /**
   * Result type for fetchContent - supports both simple string and detailed result
   */
  /**
   * Fetch full content for a source (optional).
   * Override if the adapter supports lazy content loading.
   *
   * Return types:
   * - `string | null` - Simple content return (legacy)
   * - `{ content, error?, isRetryable? }` - Detailed result with error info
   */
  async fetchContent?(
    _externalId: string
  ): Promise<string | null | { content: string | null; error?: string; isRetryable?: boolean }> {
    void _externalId; // Unused by default, override in subclasses
    return null;
  }

  /**
   * Test the connection/credentials (optional).
   * Override to provide connection validation.
   */
  async testConnection?(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  /**
   * Stage discovered sources into the database.
   * This is a helper method that adapters can use after discovery.
   */
  protected async stageDiscoveredSources(
    sources: DiscoveredSource<T>[],
    options: DiscoveryOptions
  ): Promise<{ staged: number; updated: number }> {
    if (sources.length === 0) {
      return { staged: 0, updated: 0 };
    }

    const inputs: StageSourceInput[] = sources.map((source) => ({
      sourceType: this.sourceType,
      externalId: source.externalId,
      libraryId: options.libraryId,
      ...(options.customerId && { customerId: options.customerId }),
      title: source.title,
      content: source.content,
      contentPreview: source.contentPreview,
      metadata: source.metadata,
    }));

    return stageSources(inputs);
  }

  /**
   * Stage a single discovered source.
   */
  protected async stageSingleSource(
    source: DiscoveredSource<T>,
    options: DiscoveryOptions
  ): Promise<T> {
    return stageSource({
      sourceType: this.sourceType,
      externalId: source.externalId,
      libraryId: options.libraryId,
      ...(options.customerId && { customerId: options.customerId }),
      title: source.title,
      content: source.content,
      contentPreview: source.contentPreview,
      metadata: source.metadata,
    });
  }

  /**
   * Generate a content preview from full content.
   */
  protected generatePreview(content: string | null | undefined, maxLength: number = 200): string {
    if (!content || typeof content !== 'string') {
      return '';
    }
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength).trim() + '...';
  }

  /**
   * Extract domain from URL.
   */
  protected extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return '';
    }
  }
}

/**
 * Registry of all available adapters.
 */
const adapterRegistry = new Map<SourceType, BaseDiscoveryAdapter<TypedStagedSource>>();

/**
 * Register an adapter in the registry.
 */
export function registerAdapter(adapter: BaseDiscoveryAdapter<TypedStagedSource>): void {
  adapterRegistry.set(adapter.sourceType, adapter);
}

/**
 * Get an adapter by source type.
 */
export function getAdapter(sourceType: SourceType): BaseDiscoveryAdapter<TypedStagedSource> | undefined {
  return adapterRegistry.get(sourceType);
}

/**
 * Get all registered adapters.
 */
export function getAllAdapters(): BaseDiscoveryAdapter<TypedStagedSource>[] {
  return Array.from(adapterRegistry.values());
}

/**
 * Get adapter display names for UI.
 */
export function getAdapterInfo(): Array<{ sourceType: SourceType; displayName: string }> {
  return getAllAdapters().map((adapter) => ({
    sourceType: adapter.sourceType,
    displayName: adapter.displayName,
  }));
}
