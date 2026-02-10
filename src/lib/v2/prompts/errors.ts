/**
 * V2 Prompt System Errors
 *
 * Standardized error handling for prompt registry operations.
 * Provides consistent error messages across all services that use the prompt system.
 */

import { allCompositions } from './compositions';

/**
 * Error thrown when a composition is not found in the registry
 */
export class CompositionNotFoundError extends Error {
  constructor(context: string) {
    const available = allCompositions.map(c => c.context).join(', ');
    super(`Composition not found: "${context}". Available compositions: ${available}`);
    this.name = 'CompositionNotFoundError';
  }
}

/**
 * Error thrown when a block is not found in the registry
 */
export class BlockNotFoundError extends Error {
  constructor(blockId: string, context?: string) {
    const contextInfo = context ? ` (used in ${context})` : '';
    super(`Block not found in registry: "${blockId}"${contextInfo}. Check that the block is exported from core-blocks.ts.`);
    this.name = 'BlockNotFoundError';
  }
}

/**
 * Error thrown when no blocks are found for a composition
 */
export class NoBlocksFoundError extends Error {
  constructor(compositionId: string, requestedBlockIds: string[]) {
    super(
      `No blocks found for composition: "${compositionId}". ` +
      `Requested block IDs: ${requestedBlockIds.join(', ')}. ` +
      `Check that these blocks are exported from core-blocks.ts.`
    );
    this.name = 'NoBlocksFoundError';
  }
}

/**
 * Throw a CompositionNotFoundError
 */
export function throwCompositionNotFound(context: string): never {
  throw new CompositionNotFoundError(context);
}

/**
 * Throw a BlockNotFoundError
 */
export function throwBlockNotFound(blockId: string, context?: string): never {
  throw new BlockNotFoundError(blockId, context);
}

/**
 * Throw a NoBlocksFoundError
 */
export function throwNoBlocksFound(compositionId: string, requestedBlockIds: string[]): never {
  throw new NoBlocksFoundError(compositionId, requestedBlockIds);
}
