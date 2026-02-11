/**
 * Connection Tester Utility
 *
 * Standardized connection testing interface.
 */

import { logger } from '@/lib/logger';

type ConnectionTestFn = () => Promise<void>;

/**
 * Test a connection by executing a test function
 * Returns consistent { success, error } format
 */
export async function testConnection(
  testFn: ConnectionTestFn
): Promise<{ success: boolean; error?: string }> {
  try {
    await testFn();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Connection test failed', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}
