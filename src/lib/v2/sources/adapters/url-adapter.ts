/**
 * URL Discovery Adapter
 *
 * Discovers and stages content from URLs.
 * Supports manual URL submission and bulk URL lists.
 */

import { BaseDiscoveryAdapter } from './base-adapter';
import type {
  DiscoveryOptions,
  DiscoveredSource,
  UrlStagedSource,
  UrlSourceMetadata,
} from '@/types/v2';

export class UrlDiscoveryAdapter extends BaseDiscoveryAdapter<UrlStagedSource> {
  readonly sourceType = 'url' as const;
  readonly displayName = 'URL / Web Page';

  /**
   * Discover sources from a list of URLs.
   * URLs should be passed in the options or fetched from a configured source.
   */
  async discover(_options: DiscoveryOptions): Promise<DiscoveredSource<UrlStagedSource>[]> {
    void _options; // Unused but required by interface
    // URL adapter is typically used for manual submission
    // This method would be used for bulk URL processing
    return [];
  }

  /**
   * Fetch and stage a single URL.
   */
  async fetchAndStage(
    url: string,
    options: DiscoveryOptions
  ): Promise<UrlStagedSource> {
    const discovered = await this.fetchUrl(url);
    return this.stageSingleSource(discovered, options);
  }

  /**
   * Fetch content from a URL.
   * Detects markdown URLs (.md files or markdown content-type) and preserves format.
   * For HTML, converts to plain text.
   */
  async fetchUrl(url: string): Promise<DiscoveredSource<UrlStagedSource>> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TransparentTrust/1.0 (Knowledge Base Crawler)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const rawContent = await response.text();

    // Log content length for debugging
    console.log(`[URL Adapter] Fetched ${url}: ${rawContent.length} bytes, content-type: ${contentType}`);

    // Check if content is markdown (by URL extension or content-type)
    const isMarkdown = url.endsWith('.md') || contentType.includes('text/markdown');

    // Extract title
    let title = url;
    let metaDescription: string | undefined;

    if (isMarkdown) {
      // For markdown files, try to extract title from first H1
      const h1Match = rawContent.match(/^#\s+(.+)$/m);
      title = h1Match ? h1Match[1].trim() : url;
    } else {
      // For HTML, extract from title tag and meta
      const titleMatch = rawContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : url;

      const descMatch = rawContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      metaDescription = descMatch ? descMatch[1].trim() : undefined;
    }

    // Process content based on type
    const content = isMarkdown ? rawContent : this.extractTextContent(rawContent);

    const metadata: UrlSourceMetadata = {
      url,
      domain: this.extractDomain(url),
      crawledAt: new Date().toISOString(),
      httpStatus: response.status,
      contentType,
      pageTitle: title,
      metaDescription,
      isMarkdown, // Track whether content is markdown
    };

    return {
      externalId: url,
      title,
      content,
      contentPreview: this.generatePreview(content),
      metadata,
    };
  }

  /**
   * Fetch multiple URLs in parallel.
   */
  async fetchUrls(
    urls: string[],
    options: DiscoveryOptions & { concurrency?: number }
  ): Promise<{ staged: number; updated: number; errors: Array<{ url: string; error: string }> }> {
    const { concurrency = 5 } = options;
    const errors: Array<{ url: string; error: string }> = [];
    const discovered: DiscoveredSource<UrlStagedSource>[] = [];

    // Process URLs in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((url) => this.fetchUrl(url))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          discovered.push(result.value);
        } else {
          errors.push({
            url: batch[index],
            error: result.reason?.message || 'Unknown error',
          });
        }
      });
    }

    const { staged, updated } = await this.stageDiscoveredSources(discovered, options);

    return { staged, updated, errors };
  }

  /**
   * Override fetchContent for lazy loading.
   */
  async fetchContent(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const html = await response.text();
      return this.extractTextContent(html);
    } catch {
      return null;
    }
  }

  /**
   * Extract readable text content from HTML.
   */
  private extractTextContent(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Remove script and style tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }
}

// Export singleton instance
export const urlAdapter = new UrlDiscoveryAdapter();
