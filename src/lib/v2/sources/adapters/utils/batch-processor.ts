/**
 * Batch Processor Utility
 *
 * Process items in batches with rate limiting and error handling.
 */

import { logger } from '@/lib/logger';
import type { BatchProcessResult } from './types';

interface BatchProcessorOptions<TInput, TOutput> {
  batchSize: number;
  delayBetweenBatches?: number; // milliseconds
  processor: (item: TInput) => Promise<TOutput>;
  onBatchComplete?: (batchIndex: number, results: TOutput[], errors: Error[]) => void;
}

export class BatchProcessor<TInput, TOutput> {
  private options: BatchProcessorOptions<TInput, TOutput>;

  constructor(options: BatchProcessorOptions<TInput, TOutput>) {
    this.options = options;
  }

  /**
   * Process items in batches with rate limiting.
   * Returns maps of results and errors keyed by input items.
   */
  async process(items: TInput[]): Promise<BatchProcessResult<TInput, TOutput>> {
    const results = new Map<TInput, TOutput>();
    const errors = new Map<TInput, Error>();
    const { batchSize, delayBetweenBatches = 0, processor, onBatchComplete } = this.options;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      logger.debug('Processing batch', {
        batchIndex,
        batchSize: batch.length,
        totalItems: items.length,
      });

      // Process batch in parallel using Promise.allSettled
      const settled = await Promise.allSettled(batch.map((item) => processor(item)));

      // Collect results and errors
      const batchResults: TOutput[] = [];
      const batchErrors: Error[] = [];

      settled.forEach((result, index) => {
        const item = batch[index];
        if (result.status === 'fulfilled') {
          results.set(item, result.value);
          batchResults.push(result.value);
        } else {
          const error =
            result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          errors.set(item, error);
          batchErrors.push(error);
          logger.warn('Batch item failed', { error: error.message });
        }
      });

      // Call optional callback
      if (onBatchComplete) {
        onBatchComplete(batchIndex, batchResults, batchErrors);
      }

      // Rate limit: delay between batches (but not after last batch)
      if (delayBetweenBatches > 0 && i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    logger.info('Batch processing complete', {
      totalItems: items.length,
      successCount: results.size,
      errorCount: errors.size,
    });

    return { results, errors };
  }

  /**
   * Process items and return results keyed by a custom key extractor.
   */
  async processToMap<TKey>(
    items: TInput[],
    keyExtractor: (item: TInput) => TKey
  ): Promise<Map<TKey, TOutput>> {
    const { results } = await this.process(items);
    const mappedResults = new Map<TKey, TOutput>();

    for (const [item, output] of results.entries()) {
      const key = keyExtractor(item);
      mappedResults.set(key, output);
    }

    return mappedResults;
  }
}
