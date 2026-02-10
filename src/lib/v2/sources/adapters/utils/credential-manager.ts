/**
 * Credential Manager Utility
 *
 * Load and cache credentials from AWS Secrets Manager and IntegrationConnection table.
 */

import { prisma } from '@/lib/prisma';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';
import type { CredentialLoadOptions, CredentialLoadResult } from './types';

interface CredentialManagerOptions<TCreds, TConfig> {
  integrationType: string;
  secretNames: string[];
  envVarNames?: string[];
  credentialTTL?: number; // milliseconds, default 1 hour
  parseCredentials: (secrets: Record<string, string | undefined>) => TCreds;
  parseConfig?: (config: Record<string, unknown>) => TConfig;
  connectionNameResolver?: (libraryId?: string, customerId?: string) => string | undefined;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CredentialManager<TCreds = Record<string, unknown>, TConfig = Record<string, unknown>> {
  private credentialCache: Map<string, CacheEntry<TCreds>> = new Map();
  private configCache: Map<string, CacheEntry<TConfig | undefined>> = new Map();
  private options: CredentialManagerOptions<TCreds, TConfig>;
  private credentialTTL: number;

  constructor(options: CredentialManagerOptions<TCreds, TConfig>) {
    this.options = options;
    this.credentialTTL = options.credentialTTL ?? 3600000; // Default 1 hour
  }

  /**
   * Check if a cache entry is still valid
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * Load credentials and config, with caching per connection ID and TTL
   */
  async load(options?: CredentialLoadOptions): Promise<CredentialLoadResult<TCreds, TConfig>> {
    const cacheKey = options?.connectionId || 'default';

    // Check credential cache (if valid)
    const cachedEntry = this.credentialCache.get(cacheKey);
    if (cachedEntry && this.isValid(cachedEntry)) {
      const configEntry = this.configCache.get(cacheKey);
      return {
        credentials: cachedEntry.value,
        config: configEntry?.value,
        connectionId: options?.connectionId || null,
      };
    }

    // Load credentials from Secrets Manager
    const secretsByName: Record<string, string | undefined> = {};

    for (const secretName of this.options.secretNames) {
      try {
        const envVarName = this.options.envVarNames?.[
          this.options.secretNames.indexOf(secretName)
        ];
        secretsByName[secretName] = await getSecret(secretName, envVarName);
      } catch {
        logger.debug('Secret not found', { secretName });
        secretsByName[secretName] = undefined;
      }
    }

    const credentials = this.options.parseCredentials(secretsByName);

    // Load config from IntegrationConnection if needed
    let config: TConfig | undefined;
    let connectionId: string | null = null;

    if (options?.connectionId) {
      const connection = await prisma.integrationConnection.findFirst({
        where: { id: options.connectionId, status: 'ACTIVE' },
      });

      if (connection) {
        config = this.options.parseConfig?.(connection.config as Record<string, unknown>) as TConfig | undefined;
        connectionId = connection.id;
      }
    } else if (options?.teamId || options?.libraryId || options?.customerId) {
      // Resolve connection name if resolver provided
      const connectionName = this.options.connectionNameResolver?.(
        options.libraryId,
        options.customerId
      );

      const where: Record<string, string> = {
        integrationType: this.options.integrationType,
        status: 'ACTIVE',
      };

      // Filter by teamId if provided (required for correct multi-tenant config)
      if (options.teamId) {
        where.teamId = options.teamId;
      }

      if (connectionName) {
        where.name = connectionName;
      }

      const connection = await prisma.integrationConnection.findFirst({ where });

      if (connection) {
        config = this.options.parseConfig?.(connection.config as Record<string, unknown>) as TConfig | undefined;
        connectionId = connection.id;
      }
    }

    // Cache credentials with TTL
    this.credentialCache.set(cacheKey, {
      value: credentials,
      expiresAt: Date.now() + this.credentialTTL,
    });
    if (connectionId) {
      this.configCache.set(cacheKey, {
        value: config,
        expiresAt: Date.now() + this.credentialTTL,
      });
    }

    return { credentials, config, connectionId };
  }

  /**
   * Clear the credential cache
   */
  clearCache(): void {
    this.credentialCache.clear();
    this.configCache.clear();
  }
}
