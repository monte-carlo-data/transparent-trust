// codex: unit tests for integration base handler
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseSourceHandler } from '@/lib/v2/integrations/handlers/base-handler';
import type { DiscoveryParams, DiscoveryResponse, DiscoveredItem } from '@/lib/v2/integrations/types';

// Create mock functions
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockCount = vi.fn();

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    stagedSource: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

// Concrete implementation for testing
class TestHandler extends BaseSourceHandler {
  readonly sourceType = 'slack' as const;
  readonly displayName = 'Slack';

  async discover(params: DiscoveryParams): Promise<DiscoveryResponse<DiscoveredItem>> {
    // Return mock response using libraryId from params for type safety
    return {
      items: [],
      pagination: { hasMore: false, totalFound: 0 },
      meta: { sourceType: 'slack', libraryId: params.libraryId },
    };
  }
}

describe('BaseSourceHandler', () => {
  let handler: TestHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new TestHandler();
  });

  describe('computeStatus', () => {
    it('codex: returns IGNORED when ignoredAt is set', () => {
      const source = {
        ignoredAt: new Date(),
        stagedBy: null,
        assignments: [],
      };
      expect(handler['computeStatus'](source)).toBe('IGNORED');
    });

    it('codex: returns ASSIGNED when source has assignments', () => {
      const source = {
        ignoredAt: null,
        stagedBy: 'user_123',
        assignments: [{ id: 'assign_1' }],
      };
      expect(handler['computeStatus'](source)).toBe('ASSIGNED');
    });

    it('codex: returns REVIEWED when stagedBy is set but no assignments', () => {
      const source = {
        ignoredAt: null,
        stagedBy: 'user_123',
        assignments: [],
      };
      expect(handler['computeStatus'](source)).toBe('REVIEWED');
    });

    it('codex: returns NEW when no status indicators are set', () => {
      const source = {
        ignoredAt: null,
        stagedBy: null,
        assignments: [],
      };
      expect(handler['computeStatus'](source)).toBe('NEW');
    });

    it('codex: IGNORED takes priority over ASSIGNED', () => {
      const source = {
        ignoredAt: new Date(),
        stagedBy: 'user_123',
        assignments: [{ id: 'assign_1' }],
      };
      expect(handler['computeStatus'](source)).toBe('IGNORED');
    });

    it('codex: ASSIGNED takes priority over REVIEWED', () => {
      const source = {
        ignoredAt: null,
        stagedBy: 'user_123',
        assignments: [{ id: 'assign_1' }],
      };
      expect(handler['computeStatus'](source)).toBe('ASSIGNED');
    });
  });

  describe('buildWhereClause', () => {
    it('codex: builds NEW status clause correctly', () => {
      const clause = handler['buildWhereClause']('it', undefined, 'NEW');
      expect(clause).toEqual({
        sourceType: 'slack',
        libraryId: 'it',
        customerId: null,
        ignoredAt: null,
        stagedBy: null,
        assignments: { none: {} },
      });
    });

    it('codex: builds REVIEWED status clause correctly', () => {
      const clause = handler['buildWhereClause']('it', undefined, 'REVIEWED');
      expect(clause).toEqual({
        sourceType: 'slack',
        libraryId: 'it',
        customerId: null,
        ignoredAt: null,
        stagedBy: { not: null },
        assignments: { none: {} },
      });
    });

    it('codex: builds ASSIGNED status clause correctly', () => {
      const clause = handler['buildWhereClause']('it', undefined, 'ASSIGNED');
      expect(clause).toEqual({
        sourceType: 'slack',
        libraryId: 'it',
        customerId: null,
        ignoredAt: null,
        assignments: { some: {} },
      });
    });

    it('codex: builds IGNORED status clause correctly', () => {
      const clause = handler['buildWhereClause']('it', undefined, 'IGNORED');
      expect(clause).toEqual({
        sourceType: 'slack',
        libraryId: 'it',
        customerId: null,
        ignoredAt: { not: null },
      });
    });

    it('codex: includes customerId when provided', () => {
      const clause = handler['buildWhereClause']('customers', 'cust_123', 'NEW');
      expect(clause.customerId).toBe('cust_123');
    });

    it('codex: uses null for customerId when not provided', () => {
      const clause = handler['buildWhereClause']('it', undefined, 'NEW');
      expect(clause.customerId).toBeNull();
    });
  });

  describe('stageItems', () => {
    it('codex: creates new staged sources for non-existing items', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({});

      const items = [
        {
          externalId: 'ext_1',
          title: 'Test Item',
          content: 'Full content',
          contentPreview: 'Preview',
          metadata: { custom: 'data' },
        },
      ];

      const result = await handler.stageItems(items, 'it');

      expect(result).toEqual({ staged: 1, skipped: 0, total: 1 });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          sourceType: 'slack',
          externalId: 'ext_1',
          libraryId: 'it',
          customerId: null,
          title: 'Test Item',
          content: 'Full content',
          contentPreview: 'Preview',
          metadata: { custom: 'data' },
        },
      });
    });

    it('codex: skips existing items based on unique constraint', async () => {
      mockFindFirst.mockResolvedValue({ id: 'existing' });

      const items = [
        {
          externalId: 'ext_1',
          title: 'Test Item',
          content: 'Content',
          contentPreview: 'Preview',
        },
      ];

      const result = await handler.stageItems(items, 'it');

      expect(result).toEqual({ staged: 0, skipped: 1, total: 1 });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('codex: uses default title when not provided', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({});

      const items = [
        {
          externalId: 'ext_1',
          title: '',
          content: 'Content',
          contentPreview: 'Preview',
        },
      ];

      await handler.stageItems(items, 'it');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Slack ext_1',
          }),
        })
      );
    });

    it('codex: includes customerId in lookup and create', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({});

      const items = [
        {
          externalId: 'ext_1',
          title: 'Test',
          content: 'Content',
          contentPreview: 'Preview',
        },
      ];

      await handler.stageItems(items, 'customers', 'cust_456');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          sourceType: 'slack',
          externalId: 'ext_1',
          libraryId: 'customers',
          customerId: 'cust_456',
        },
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust_456',
          }),
        })
      );
    });

    it('codex: handles multiple items with mixed existing/new', async () => {
      mockFindFirst
        .mockResolvedValueOnce(null) // First item - new
        .mockResolvedValueOnce({ id: 'existing' }) // Second item - exists
        .mockResolvedValueOnce(null); // Third item - new

      mockCreate.mockResolvedValue({});

      const items = [
        { externalId: 'ext_1', title: 'Item 1', content: 'C1', contentPreview: 'P1' },
        { externalId: 'ext_2', title: 'Item 2', content: 'C2', contentPreview: 'P2' },
        { externalId: 'ext_3', title: 'Item 3', content: 'C3', contentPreview: 'P3' },
      ];

      const result = await handler.stageItems(items, 'it');

      expect(result).toEqual({ staged: 2, skipped: 1, total: 3 });
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStagedSources', () => {
    it('codex: returns paginated results with status counts', async () => {
      const mockItems = [
        {
          id: 'src_1',
          externalId: 'ext_1',
          title: 'Test Source',
          contentPreview: 'Preview text',
          stagedAt: new Date('2024-01-01'),
          metadata: { key: 'value' },
          ignoredAt: null,
          stagedBy: null,
          assignments: [],
        },
      ];

      mockFindMany.mockResolvedValue(mockItems);
      mockCount
        .mockResolvedValueOnce(5) // NEW
        .mockResolvedValueOnce(2) // REVIEWED
        .mockResolvedValueOnce(1) // ASSIGNED
        .mockResolvedValueOnce(0); // IGNORED

      const result = await handler.getStagedSources({
        libraryId: 'it',
        status: 'NEW',
        limit: 10,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'src_1',
        externalId: 'ext_1',
        title: 'Test Source',
        contentPreview: 'Preview text',
        status: 'NEW',
        stagedAt: '2024-01-01T00:00:00.000Z',
        metadata: { key: 'value' },
      });
      expect(result.counts).toEqual({ NEW: 5, REVIEWED: 2, ASSIGNED: 1, IGNORED: 0 });
      expect(result.pagination).toEqual({ limit: 10, offset: 0, total: 5 });
    });
  });
});
