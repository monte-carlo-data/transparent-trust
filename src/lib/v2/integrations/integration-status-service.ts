/**
 * Integration Status Service
 *
 * Provides unified status checking for all source integrations.
 * Checks if integrations are configured by verifying secrets exist in AWS Secrets Manager.
 */

import { prisma } from '@/lib/prisma';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';
import {
  getAdapter,
  getAllAdapters,
} from '@/lib/v2/sources/adapters/base-adapter';
import { SLACK_BOT_LIBRARIES } from '@/lib/v2/library-constants';
import type { SourceType } from '@/types/v2';

export interface IntegrationStatus {
  type: SourceType;
  displayName: string;
  configured: boolean;
  connectionId?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'ERROR';
  lastSyncAt?: string;
  lastError?: string;
  connectionTest?: {
    success: boolean;
    error?: string;
    testedAt: string;
  };
}

/**
 * Map of integration types to their required secrets.
 * An integration is "configured" if ALL required secrets exist and are non-empty.
 *
 * For Slack, the adapter checks for library-specific tokens (slack-bot-token-{libraryId})
 * but falls back to the generic 'slack-bot-token' if not found. We check both to ensure
 * at least one exists.
 */
const INTEGRATION_SECRETS: Record<string, string[]> = {
  notion: ['notion-api-token'],
  slack: ['slack-bot-token'], // Adapters fall back to this if library-specific not found
  zendesk: ['zendesk-internal-subdomain', 'zendesk-internal-email', 'zendesk-internal-api-token'],
  gong: ['gong-access-key', 'gong-access-key-secret'],
};


/**
 * Check if a secret value is valid (not empty and not a placeholder).
 */
function isValidSecretValue(value: string): boolean {
  if (!value || value.trim() === '') {
    return false;
  }
  // Reject placeholder values
  if (value.trim().toUpperCase() === 'PLACEHOLDER') {
    return false;
  }
  return true;
}

/**
 * Check if all required secrets exist for an integration.
 * For Slack, checks for EITHER generic token OR any library-specific tokens.
 */
async function hasRequiredSecrets(type: string): Promise<boolean> {
  const requiredSecrets = INTEGRATION_SECRETS[type];
  if (!requiredSecrets || requiredSecrets.length === 0) {
    // No secrets required (e.g., url, document sources)
    return true;
  }

  try {
    const results = await Promise.all(
      requiredSecrets.map(async (secretName) => {
        try {
          // Special handling for Slack: check generic OR any library-specific token
          if (secretName === 'slack-bot-token') {
            // First try generic token
            try {
              const value = await getSecret(secretName);
              if (isValidSecretValue(value)) {
                return true;
              }
            } catch {
              // Generic not found, try library-specific
            }

            // Check for any library-specific token
            for (const libraryId of SLACK_BOT_LIBRARIES) {
              try {
                const value = await getSecret(`slack-bot-token-${libraryId}`);
                if (isValidSecretValue(value)) {
                  return true; // Found at least one library-specific token
                }
              } catch {
                // This library doesn't have a token, continue checking
              }
            }

            return false; // No Slack tokens found
          }

          // For other secrets, check as normal
          const value = await getSecret(secretName);
          return isValidSecretValue(value);
        } catch {
          return false;
        }
      })
    );
    return results.every(Boolean);
  } catch (error) {
    logger.error(`Error checking secrets for ${type}:`, error);
    return false;
  }
}

/**
 * Get status for a specific integration
 */
export async function getIntegrationStatus(
  type: string,
  options?: { verify?: boolean }
): Promise<IntegrationStatus | null> {
  const adapter = getAdapter(type as SourceType);
  if (!adapter) {
    return null;
  }

  // Check if required secrets exist (this is the primary "configured" check)
  const hasSecrets = await hasRequiredSecrets(type);

  // Get connection from database (optional - for sync status tracking)
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      integrationType: type,
      status: 'ACTIVE',
    },
  });

  const status: IntegrationStatus = {
    type: type as SourceType,
    displayName: adapter.displayName,
    configured: hasSecrets, // Based on secrets, not database record
    connectionId: connection?.id,
    status: (connection?.status as 'ACTIVE' | 'PAUSED' | 'ERROR') || undefined,
    lastSyncAt: connection?.lastSyncAt?.toISOString(),
    lastError: connection?.lastError || undefined,
  };

  // Optional: Test connection
  if (options?.verify && adapter.testConnection) {
    const result = await adapter.testConnection();
    status.connectionTest = {
      success: result.success,
      error: result.error,
      testedAt: new Date().toISOString(),
    };
  }

  return status;
}

/**
 * Get status for all registered integrations
 */
export async function getAllIntegrationStatuses(options?: {
  verify?: boolean;
  types?: SourceType[];
}): Promise<IntegrationStatus[]> {
  const adapterList = options?.types
    ? options.types.map(getAdapter).filter(Boolean)
    : getAllAdapters();

  const results = await Promise.all(
    adapterList.map(adapter => {
      if (!adapter) return null;
      return getIntegrationStatus(adapter.sourceType, options);
    })
  );

  return results.filter((s): s is IntegrationStatus => s !== null);
}
