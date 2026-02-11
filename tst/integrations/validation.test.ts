// codex: unit tests for integration validation middleware
import { describe, it, expect } from 'vitest';
import {
  parseDiscoveryParams,
  parseStageListParams,
  validateStageCreateBody,
  isValidationSuccess,
} from '@/lib/v2/integrations/middleware/validation';

describe('parseDiscoveryParams', () => {
  it('codex: returns valid params with defaults when no params provided', () => {
    const searchParams = new URLSearchParams();
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.libraryId).toBe('it');
      expect(result.data.limit).toBe(50);
      expect(result.data.page).toBe(1);
      expect(result.data.since).toBeUndefined();
      expect(result.data.customerId).toBeUndefined();
    }
  });

  it('codex: validates libraryId and rejects invalid values', () => {
    const searchParams = new URLSearchParams({ libraryId: 'invalid' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(false);
    if (!isValidationSuccess(result)) {
      expect(result.response.status).toBe(400);
    }
  });

  it('codex: accepts valid libraryId values', () => {
    const validLibraries = ['knowledge', 'it', 'gtm', 'customers'];
    for (const libraryId of validLibraries) {
      const searchParams = new URLSearchParams({ libraryId });
      const result = parseDiscoveryParams(searchParams);
      expect(result.success).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.data.libraryId).toBe(libraryId);
      }
    }
  });

  it('codex: rejects invalid limit values instead of using default', () => {
    const searchParams = new URLSearchParams({ limit: 'abc' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(false);
  });

  it('codex: rejects negative limit values', () => {
    const searchParams = new URLSearchParams({ limit: '-5' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(false);
  });

  it('codex: rejects limit exceeding max', () => {
    const searchParams = new URLSearchParams({ limit: '500' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(false);
  });

  it('codex: accepts valid limit within bounds', () => {
    const searchParams = new URLSearchParams({ limit: '25' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.limit).toBe(25);
    }
  });

  it('codex: rejects invalid since timestamp', () => {
    const searchParams = new URLSearchParams({ since: 'yesterday' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(false);
  });

  it('codex: parses valid since timestamp', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const searchParams = new URLSearchParams({ since: timestamp.toString() });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.since).toBeInstanceOf(Date);
    }
  });

  it('codex: rejects invalid page values', () => {
    const searchParams = new URLSearchParams({ page: 'first' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(false);
  });

  it('codex: rejects zero or negative page values', () => {
    const searchParams = new URLSearchParams({ page: '0' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(false);

    const negativeResult = parseDiscoveryParams(new URLSearchParams({ page: '-1' }));
    expect(negativeResult.success).toBe(false);
  });

  it('codex: accepts valid page number', () => {
    const searchParams = new URLSearchParams({ page: '5' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.page).toBe(5);
    }
  });

  it('codex: passes customerId through', () => {
    const searchParams = new URLSearchParams({ customerId: 'cust_123' });
    const result = parseDiscoveryParams(searchParams);

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.customerId).toBe('cust_123');
    }
  });
});

describe('parseStageListParams', () => {
  it('codex: returns valid params with defaults', () => {
    const searchParams = new URLSearchParams();
    const result = parseStageListParams(searchParams, 'slack');

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.status).toBe('NEW');
      expect(result.data.limit).toBe(100);
      expect(result.data.offset).toBe(0);
    }
  });

  it('codex: validates status and rejects invalid values', () => {
    const searchParams = new URLSearchParams({ status: 'INVALID' });
    const result = parseStageListParams(searchParams, 'slack');

    expect(result.success).toBe(false);
  });

  it('codex: accepts valid status values', () => {
    const validStatuses = ['NEW', 'REVIEWED', 'ASSIGNED', 'IGNORED'];
    for (const status of validStatuses) {
      const searchParams = new URLSearchParams({ status });
      const result = parseStageListParams(searchParams, 'slack');
      expect(result.success).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.data.status).toBe(status);
      }
    }
  });

  it('codex: rejects invalid offset values', () => {
    const searchParams = new URLSearchParams({ offset: 'start' });
    const result = parseStageListParams(searchParams, 'slack');

    expect(result.success).toBe(false);
  });

  it('codex: rejects negative offset', () => {
    const searchParams = new URLSearchParams({ offset: '-10' });
    const result = parseStageListParams(searchParams, 'slack');

    expect(result.success).toBe(false);
  });

  it('codex: accepts valid offset', () => {
    const searchParams = new URLSearchParams({ offset: '50' });
    const result = parseStageListParams(searchParams, 'slack');

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.offset).toBe(50);
    }
  });
});

describe('validateStageCreateBody', () => {
  it('codex: rejects null body', () => {
    const result = validateStageCreateBody(null);
    expect(result.success).toBe(false);
  });

  it('codex: rejects non-object body', () => {
    const result = validateStageCreateBody('string');
    expect(result.success).toBe(false);
  });

  it('codex: rejects body without items array', () => {
    const result = validateStageCreateBody({ libraryId: 'it' });
    expect(result.success).toBe(false);
  });

  it('codex: rejects items with missing externalId', () => {
    const result = validateStageCreateBody({
      items: [{ title: 'Test', content: 'Content', contentPreview: 'Preview' }],
      libraryId: 'it',
    });
    expect(result.success).toBe(false);
  });

  it('codex: rejects items with empty externalId', () => {
    const result = validateStageCreateBody({
      items: [{ externalId: '', title: 'Test', content: 'Content', contentPreview: 'Preview' }],
      libraryId: 'it',
    });
    expect(result.success).toBe(false);
  });

  it('codex: rejects invalid libraryId in body', () => {
    const result = validateStageCreateBody({
      items: [{ externalId: '123', title: 'Test', content: 'Content', contentPreview: 'Preview' }],
      libraryId: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('codex: accepts valid body with all required fields', () => {
    const result = validateStageCreateBody({
      items: [
        {
          externalId: 'ext_123',
          title: 'Test Item',
          content: 'Full content here',
          contentPreview: 'Preview text',
          metadata: { custom: 'data' },
        },
      ],
      libraryId: 'knowledge',
      customerId: 'cust_456',
    });

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.libraryId).toBe('knowledge');
      expect(result.data.customerId).toBe('cust_456');
    }
  });

  it('codex: uses default libraryId when not provided', () => {
    const result = validateStageCreateBody({
      items: [{ externalId: '123', title: 'Test', content: 'Content', contentPreview: 'Preview' }],
    });

    expect(result.success).toBe(true);
    if (isValidationSuccess(result)) {
      expect(result.data.libraryId).toBe('it');
    }
  });
});
