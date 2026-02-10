import { describe, it, expect } from 'vitest';
import { buildCacheableSystem, estimateTokens, getCacheThreshold, isHaikuModel } from '@/lib/anthropicCache';

describe('LLM Prompt Caching', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      const text = 'Hello world';
      const estimated = estimateTokens(text);
      // ~4 characters per token
      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThanOrEqual(Math.ceil(text.length / 4) + 1);
    });

    it('should handle empty text', () => {
      expect(estimateTokens('')).toBe(0);
      // Whitespace-only returns at least 1 token due to ceil rounding
      expect(estimateTokens('   ')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCacheThreshold', () => {
    it('should return Haiku threshold for haiku models', () => {
      const threshold = getCacheThreshold('claude-3-5-haiku-20241022');
      expect(threshold).toBe(2048);
    });

    it('should return Sonnet/Opus threshold for other models', () => {
      const threshold = getCacheThreshold('claude-3-5-sonnet-20241022');
      expect(threshold).toBe(1024);

      const opusThreshold = getCacheThreshold('claude-opus-4-20250514');
      expect(opusThreshold).toBe(1024);
    });
  });

  describe('buildCacheableSystem', () => {
    it('should return plain string when cached content is below threshold', () => {
      const result = buildCacheableSystem({
        cachedContent: 'small prompt',
        dynamicContent: 'question',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('small prompt');
      expect(result).toContain('question');
    });

    it('should return array of cacheable blocks when content exceeds threshold', () => {
      // Create large content to exceed threshold
      const largeContent = 'x'.repeat(5000); // ~1250 tokens

      const result = buildCacheableSystem({
        cachedContent: largeContent,
        dynamicContent: 'dynamic part',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const blocks = result as Array<{ type: string; cache_control?: { type: string } }>;
      expect(blocks[0].type).toBe('text');
      expect(blocks[0].cache_control?.type).toBe('ephemeral');
      expect(blocks[1].type).toBe('text');
      expect(blocks[1].cache_control).toBeUndefined();
    });

    it('should handle only cached content', () => {
      const largeContent = 'x'.repeat(5000);

      const result = buildCacheableSystem({
        cachedContent: largeContent,
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('should respect forceCaching flag', () => {
      const smallContent = 'small';

      const result = buildCacheableSystem({
        cachedContent: smallContent,
        forceCaching: true,
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(Array.isArray(result)).toBe(true);
      const blocks = result as Array<{ type: string; cache_control?: { type: string } }>;
      expect(blocks[0].cache_control?.type).toBe('ephemeral');
    });

    it('should handle empty cached content', () => {
      const result = buildCacheableSystem({
        cachedContent: '',
        dynamicContent: 'only dynamic',
      });

      expect(result).toBe('only dynamic');
    });
  });

  describe('isHaikuModel', () => {
    it('should identify Haiku models', () => {
      expect(isHaikuModel('claude-3-5-haiku-20241022')).toBe(true);
      expect(isHaikuModel('claude-haiku-4-5-20251001')).toBe(true);
    });

    it('should not identify non-Haiku models as Haiku', () => {
      expect(isHaikuModel('claude-3-5-sonnet-20241022')).toBe(false);
      expect(isHaikuModel('claude-opus-4-20250514')).toBe(false);
    });
  });
});
