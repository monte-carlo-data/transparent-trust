// codex: unit tests for integration auth middleware
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth, requireLibraryAccess, isAuthSuccess } from '@/lib/v2/integrations/middleware/auth';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth-v2', () => ({
  authOptions: {},
}));

vi.mock('@/lib/v2/teams/team-service', () => ({
  canManageLibrary: vi.fn(),
}));

vi.mock('@/lib/v2/customers/customer-service', () => ({
  canAccessCustomer: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { canManageLibrary } from '@/lib/v2/teams/team-service';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';

const mockGetServerSession = vi.mocked(getServerSession);
const mockCanManageLibrary = vi.mocked(canManageLibrary);
const mockCanAccessCustomer = vi.mocked(canAccessCustomer);

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('codex: returns error when no session exists', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await requireAuth();

    expect(result.success).toBe(false);
    if (!isAuthSuccess(result)) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.code).toBe('AUTH_REQUIRED');
    }
  });

  it('codex: returns error when session has no user', async () => {
    mockGetServerSession.mockResolvedValue({ user: null } as never);

    const result = await requireAuth();

    expect(result.success).toBe(false);
  });

  it('codex: returns error when user has no id', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@test.com' } } as never);

    const result = await requireAuth();

    expect(result.success).toBe(false);
  });

  it('codex: returns userId when session is valid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_123' } } as never);

    const result = await requireAuth();

    expect(result.success).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.data.userId).toBe('user_123');
    }
  });
});

describe('requireLibraryAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('codex: returns auth error when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await requireLibraryAccess('knowledge');

    expect(result.success).toBe(false);
    if (!isAuthSuccess(result)) {
      expect(result.response.status).toBe(401);
    }
  });

  it('codex: returns forbidden when user lacks library access', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_123' } } as never);
    mockCanManageLibrary.mockResolvedValue(false);

    const result = await requireLibraryAccess('knowledge');

    expect(result.success).toBe(false);
    if (!isAuthSuccess(result)) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.code).toBe('LIBRARY_ACCESS_DENIED');
    }
  });

  it('codex: returns success when user has library access', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_123' } } as never);
    mockCanManageLibrary.mockResolvedValue(true);

    const result = await requireLibraryAccess('it');

    expect(result.success).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.data.userId).toBe('user_123');
      expect(result.data.libraryId).toBe('it');
      expect(result.data.customerId).toBeUndefined();
    }
  });

  it('codex: checks customer access when customerId is provided', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_123' } } as never);
    mockCanManageLibrary.mockResolvedValue(true);
    mockCanAccessCustomer.mockResolvedValue(false);

    const result = await requireLibraryAccess('customers', 'cust_456');

    expect(mockCanAccessCustomer).toHaveBeenCalledWith('user_123', 'cust_456');
    expect(result.success).toBe(false);
    if (!isAuthSuccess(result)) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.code).toBe('CUSTOMER_ACCESS_DENIED');
    }
  });

  it('codex: returns success with customerId when customer access is granted', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_123' } } as never);
    mockCanManageLibrary.mockResolvedValue(true);
    mockCanAccessCustomer.mockResolvedValue(true);

    const result = await requireLibraryAccess('customers', 'cust_456');

    expect(result.success).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.data.userId).toBe('user_123');
      expect(result.data.libraryId).toBe('customers');
      expect(result.data.customerId).toBe('cust_456');
    }
  });

  it('codex: does not check customer access when customerId is not provided', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_123' } } as never);
    mockCanManageLibrary.mockResolvedValue(true);

    await requireLibraryAccess('it');

    expect(mockCanAccessCustomer).not.toHaveBeenCalled();
  });
});

describe('isAuthSuccess', () => {
  it('codex: returns true for success result', () => {
    const result = { success: true as const, data: { userId: 'test' } };
    expect(isAuthSuccess(result)).toBe(true);
  });

  it('codex: returns false for failure result', () => {
    const result = { success: false as const, response: {} as never };
    expect(isAuthSuccess(result)).toBe(false);
  });
});
