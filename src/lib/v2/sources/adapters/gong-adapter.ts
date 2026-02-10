/**
 * Gong Discovery Adapter
 *
 * Discovers and stages content from Gong calls.
 * Requires Gong API credentials configured in IntegrationConnection.
 */

import { BaseDiscoveryAdapter } from './base-adapter';
import type {
  DiscoveryOptions,
  DiscoveredSource,
  GongStagedSource,
  GongSourceMetadata,
} from '@/types/v2';
import { CredentialManager, ApiClient, testConnection } from './utils';
import { logger } from '@/lib/logger';
import { getCustomerByCrmId } from '@/lib/v2/customers/customer-service';
import { prisma } from '@/lib/prisma';

interface GongCredentials {
  accessKey: string;
  accessKeySecret: string;
  baseUrl?: string; // Defaults to api.gong.io
}

interface GongConfig {
  workspaceId?: string;
  filterByOwner?: string[]; // Only sync calls owned by these users
  minDuration?: number; // Minimum call duration in seconds
  crmId?: string; // Explicit CRM ID for customer assignment
  domain?: string; // Email domain for customer matching
}

/**
 * GongCall interface for normalized call data.
 * Used internally after normalizing from either GET /calls or POST /calls/extensive.
 */
interface GongCall {
  id: string;
  title: string;
  scheduled: string;
  started: string;
  duration: number;
  direction: 'Inbound' | 'Outbound';
  primaryUserId: string;
  parties: Array<{
    id: string;
    emailAddress: string;
    name: string;
    affiliation: 'Internal' | 'External';
    speakerId: string;
  }>;
  media: {
    audioUrl?: string;
    videoUrl?: string;
  };
  content: {
    topics?: string[];
    trackers?: Array<{ name: string; count: number }>;
    pointsOfInterest?: Array<{
      type: string;
      startTime: number;
      snippetStartTime: number;
      snippetEndTime: number;
      text: string;
    }>;
  };
  collaboration?: {
    publicComments?: Array<{ text: string }>;
  };
  dealId?: string;
  url: string;
}

/**
 * Response structure from POST /v2/calls/extensive.
 * Note: This endpoint returns call metadata nested under `metaData` field.
 */
interface GongExtensiveCallResponse {
  metaData: {
    id: string;
    title?: string;
    scheduled?: string;
    started?: string;
    duration?: number;
    direction?: 'Inbound' | 'Outbound';
    primaryUserId?: string;
    url?: string;
  };
  parties?: Array<{
    id: string;
    emailAddress?: string;
    name?: string;
    affiliation?: 'Internal' | 'External';
    speakerId?: string;
  }>;
  content?: {
    topics?: string[];
    trackers?: Array<{ name: string; count: number }>;
    pointsOfInterest?: Array<{
      type: string;
      startTime: number;
      snippetStartTime: number;
      snippetEndTime: number;
      text: string;
    }>;
  };
  collaboration?: {
    publicComments?: Array<{ text: string }>;
  };
}

interface GongTranscript {
  callId: string;
  transcript: Array<{
    speakerId: string;
    topic: string;
    sentences: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
}

/**
 * Normalize extensive API response to internal GongCall format.
 * POST /calls/extensive returns metadata nested under `metaData` field,
 * while our internal GongCall interface expects flat structure.
 */
function normalizeExtensiveResponse(extCall: GongExtensiveCallResponse): GongCall {
  return {
    id: extCall.metaData?.id || '',
    title: extCall.metaData?.title || '',
    scheduled: extCall.metaData?.scheduled || '',
    started: extCall.metaData?.started || '',
    duration: extCall.metaData?.duration || 0,
    direction: extCall.metaData?.direction || 'Outbound',
    primaryUserId: extCall.metaData?.primaryUserId || '',
    url: extCall.metaData?.url || '',
    parties: (extCall.parties || []).map((p) => ({
      id: p.id || '',
      emailAddress: p.emailAddress || '',
      name: p.name || '',
      affiliation: p.affiliation || 'External',
      speakerId: p.speakerId || '',
    })),
    media: {},
    content: extCall.content || {},
    collaboration: extCall.collaboration,
  };
}

export class GongDiscoveryAdapter extends BaseDiscoveryAdapter<GongStagedSource> {
  readonly sourceType = 'gong' as const;
  readonly displayName = 'Gong Calls';

  private credentialManager = new CredentialManager<GongCredentials, GongConfig>({
    integrationType: 'gong',
    secretNames: ['gong-access-key', 'gong-access-key-secret'],
    envVarNames: ['GONG_ACCESS_KEY', 'GONG_ACCESS_KEY_SECRET'],
    parseCredentials: (secrets) => ({
      accessKey: secrets['gong-access-key'] || '',
      accessKeySecret: secrets['gong-access-key-secret'] || '',
    }),
    parseConfig: (config) => config as GongConfig,
  });

  private apiClient?: ApiClient;

  /**
   * Match customer by email domain from external participants.
   *
   * Extracts email domains from external participant emails and matches against
   * customer contact email domains (case-insensitive).
   *
   * Matching logic:
   * - Returns first customer whose contact domains include ANY external participant domain
   * - Does NOT filter generic domains (gmail.com, outlook.com, etc.) - caller should pre-filter
   * - Case-insensitive domain matching (both converted to lowercase)
   * - Requires customer.isActive=true and non-empty contacts array
   *
   * Edge cases:
   * - Multiple matching customers: Returns first match (non-deterministic order)
   * - No valid email formats: Returns null
   * - Customer contacts with no email field: Skipped
   *
   * Known limitation: Queries all active customers without team-based filtering.
   * Future enhancement: Add teamId filtering when adapter receives session context.
   *
   * @param externalEmails - Array of external participant email addresses
   * @returns Customer ID if matched, null otherwise
   */
  private async matchCustomerByEmailDomain(externalEmails: string[]): Promise<string | null> {
    if (externalEmails.length === 0) return null;

    try {
      // Extract domains from external emails
      const domains = externalEmails
        .map(email => {
          // Validate email is a string before attempting regex match
          if (typeof email !== 'string' || !email) {
            logger.warn('Invalid email value in Gong call', { email, type: typeof email });
            return null;
          }
          const match = email.match(/@(.+)$/);
          return match ? match[1].toLowerCase() : null;
        })
        .filter(Boolean) as string[];

      if (domains.length === 0) return null;

      // Find customers whose contacts have matching email domains
      // TODO: Add team-based filtering when adapter receives session context
      const customers = await prisma.customer.findMany({
        where: {
          isActive: true,
          contacts: { not: [] },
        },
        select: {
          id: true,
          contacts: true,
        },
      });

      for (const customer of customers) {
        try {
          const contacts = customer.contacts as Array<{ email?: string }>;
          const customerDomains = contacts
            .map(c => {
              if (!c.email) return null;
              const match = c.email.match(/@(.+)$/);
              return match ? match[1].toLowerCase() : null;
            })
            .filter(Boolean) as string[];

          // Check if any external domain matches customer contact domains
          if (domains.some(d => customerDomains.includes(d))) {
            logger.info('Matched Gong call to customer by email domain', {
              customerId: customer.id,
              matchedDomain: domains.find(d => customerDomains.includes(d)),
            });
            return customer.id;
          }
        } catch (contactError) {
          logger.warn('Error processing customer contacts for matching', contactError, {
            customerId: customer.id,
          });
          continue;
        }
      }

      return null;
    } catch (error) {
      logger.error('Customer email domain matching failed', error, {
        externalEmailCount: externalEmails.length,
      });
      return null;
    }
  }

  /**
   * Match customer for a Gong call using explicit overrides and automatic matching.
   *
   * Customer matching priority:
   * 1. Explicit CRM ID from config (if set, all calls assigned to this customer)
   * 2. Explicit domain from config (if set, only match calls with external participants from this domain)
   * 3. CRM dealId lookup on the call (if available)
   * 4. External participant email domain matching (fallback)
   * 5. Returns null (no automatic match)
   *
   * @param call - Gong call to match
   * @param config - Gong configuration with optional crmId and domain overrides
   * @returns Customer ID if matched, null otherwise
   */
  private async matchCustomer(call: GongCall, config?: GongConfig): Promise<string | null> {
    try {
      // Priority 1: Explicit CRM ID from config overrides everything
      if (config?.crmId) {
        logger.info('Using explicit CRM ID from Gong configuration', {
          crmId: config.crmId,
          callId: call.id,
        });
        return config.crmId;
      }

      // Priority 2: Explicit domain from config (acts as a filter - only match if domain matches)
      if (config?.domain) {
        const externalEmails = (call.parties || [])
          .filter(p => p.affiliation === 'External')
          .map(p => p.emailAddress)
          .filter(Boolean);

        if (externalEmails.length === 0) {
          // No external participants to match against domain
          logger.info('Gong call has no external participants to match against domain', {
            callId: call.id,
            configDomain: config.domain,
          });
          return null;
        }

        const domains = externalEmails
          .map(email => {
            try {
              const match = email.match(/@(.+)$/);
              return match ? match[1].toLowerCase() : null;
            } catch {
              logger.warn('Invalid email format in Gong call', { email });
              return null;
            }
          })
          .filter(Boolean) as string[];

        const configDomain = config.domain.toLowerCase();
        const hasMatchingDomain = domains.some(d => d === configDomain);

        if (!hasMatchingDomain) {
          // Domain filter configured but this call doesn't match it
          logger.info('Gong call domain does not match configuration', {
            callId: call.id,
            configDomain: config.domain,
            callDomains: domains,
          });
          return null;
        }

        // Domain matches but no explicit crmId - this is typically used with customer-scoped discovery
        // where the customerId is already known from options.customerId
        logger.info('Gong call matches explicit domain configuration', {
          callId: call.id,
          matchedDomain: configDomain,
        });
        return null;
      }

      // Priority 3: Match by CRM dealId
      if (call.dealId) {
        try {
          const customer = await getCustomerByCrmId(call.dealId);
          if (customer) {
            logger.info('Matched Gong call to customer by CRM deal ID', {
              customerId: customer.id,
              dealId: call.dealId,
              callId: call.id,
            });
            return customer.id;
          }
        } catch (crmError) {
          logger.warn('CRM customer lookup failed for Gong call', crmError, {
            dealId: call.dealId,
            callId: call.id,
          });
          // Continue to email domain matching
        }
      }

      // Priority 4: Match by external participant email domains
      const externalEmails = (call.parties || [])
        .filter(p => p.affiliation === 'External')
        .map(p => p.emailAddress)
        .filter(Boolean);

      if (externalEmails.length > 0) {
        return await this.matchCustomerByEmailDomain(externalEmails);
      }

      return null;
    } catch (error) {
      logger.error('Customer matching failed for Gong call', error, {
        callId: call.id,
        hasDealId: !!call.dealId,
        externalPartyCount: (call.parties || []).filter(p => p.affiliation === 'External').length,
        hasConfigCrmId: !!config?.crmId,
        hasConfigDomain: !!config?.domain,
      });
      return null;
    }
  }

  /**
   * Initialize API client on first use
   */
  private async getApiClient(credentials: GongCredentials): Promise<ApiClient> {
    if (this.apiClient) return this.apiClient;

    const auth = Buffer.from(
      `${credentials.accessKey}:${credentials.accessKeySecret}`
    ).toString('base64');

    const baseUrl = credentials.baseUrl || 'https://api.gong.io';
    this.apiClient = new ApiClient({
      baseUrl: `${baseUrl}/v2`,
      getAuthHeaders: () => ({
        'Authorization': `Basic ${auth}`,
      }),
      minRequestInterval: 100, // 100ms between requests to avoid rate limiting
      maxRetries: 3,
    });

    return this.apiClient;
  }

  /**
   * Load workspace ID from customer-specific config or fall back to global config.
   *
   * Workspace ID resolution priority:
   * 1. Customer-specific config (if customerId provided)
   * 2. Global config (GTM library connection)
   *
   * @returns Workspace ID or undefined
   */
  private async getWorkspaceId(
    customerConfig?: GongConfig,
    libraryId?: string,
    customerId?: string
  ): Promise<string | undefined> {
    // Priority 1: Customer-specific workspace ID (if provided)
    if (customerConfig?.workspaceId) {
      return customerConfig.workspaceId;
    }

    // Priority 2: Fall back to global config
    try {
      const { config: globalConfig } = await this.credentialManager.load({
        libraryId: 'gtm', // Global config stored under GTM library
        customerId: undefined,
      });
      if (globalConfig?.workspaceId) {
        logger.info('Using global workspace ID for Gong discovery', {
          libraryId,
          customerId,
          workspaceId: globalConfig.workspaceId,
        });
        return globalConfig.workspaceId;
      }
    } catch (error) {
      logger.warn('Failed to load global Gong workspace ID', error);
    }

    return undefined;
  }

  /**
   * Discover calls from Gong API with automatic customer matching.
   *
   * Applies filters in this order:
   * 1. API-level filters (since date, workspaceId)
   * 2. Post-fetch filters (minDuration, filterByOwner)
   * 3. Result limiting (first `limit` results)
   *
   * Workspace ID resolution:
   * 1. Customer-specific config (if customerId provided)
   * 2. Global config (GTM library connection)
   *
   * Customer matching priority (when not explicitly provided):
   * 1. CRM dealId lookup
   * 2. External participant email domain matching
   * 3. Returns null (no automatic match)
   *
   * NOTE: Transcripts are NOT fetched during discovery to reduce API load.
   * Use fetchContent() or the bulk transcript fetch endpoint to load transcripts
   * for selected calls on demand.
   *
   * @param options - Discovery options including libraryId, customerId, since, limit
   * @returns Discovered sources with matched customer IDs in metadata (no transcript content)
   * @throws If credentials are invalid or Gong API returns errors
   */
  async discover(options: DiscoveryOptions): Promise<DiscoveredSource<GongStagedSource>[] & { _cursor?: string }> {
    const { credentials, config } = await this.credentialManager.load({
      connectionId: options.connectionId,
      libraryId: options.libraryId,
      customerId: options.customerId,
    });
    const client = await this.getApiClient(credentials);
    const { since, limit = 50, cursor } = options;

    // Get workspace ID (customer-specific or global)
    const workspaceId = await this.getWorkspaceId(config, options.libraryId, options.customerId);

    // Use POST /calls/extensive to get full call data including parties/participants
    // Note: Response structure has metadata nested under `metaData` field - we normalize it below
    const filter: Record<string, unknown> = {};
    if (since) {
      filter.fromDateTime = since.toISOString();
    }
    if (workspaceId) {
      filter.workspaceId = workspaceId;
    }

    const response = await client.post<{ calls: GongExtensiveCallResponse[]; records?: { cursor?: string } }>(
      '/calls/extensive',
      {
        filter,
        cursor,
        contentSelector: {
          exposedFields: {
            parties: true, // Include participant data with emails
            content: { topics: true, pointsOfInterest: true },
            collaboration: { publicComments: true },
          },
        },
      }
    );

    // Normalize the extensive response to our GongCall interface
    let calls: GongCall[] = (response.calls || []).map(normalizeExtensiveResponse);
    const nextCursor = response.records?.cursor;

    // Apply additional filters
    if (config?.minDuration) {
      calls = calls.filter((c) => c.duration >= config.minDuration!);
    }
    if (config?.filterByOwner?.length) {
      calls = calls.filter((c) => config.filterByOwner!.includes(c.primaryUserId));
    }

    // Limit results
    calls = calls.slice(0, limit);

    // Convert to discovered sources (metadata only, no transcripts)
    // Transcripts are fetched on-demand via fetchContent() to reduce API load
    const discovered: DiscoveredSource<GongStagedSource>[] = [];

    for (const call of calls) {
      // Normalize call ID: skip if truly missing, convert to string if numeric
      // Gong API can return numeric IDs or occasionally calls without IDs
      const callId = call.id != null ? String(call.id) : null;
      if (!callId) {
        logger.warn('Skipping Gong call with missing ID', {
          hasId: call.id != null,
          title: call.title,
          hasTitle: !!call.title,
        });
        continue;
      }

      // Build metadata-only content (no transcript)
      const content = this.buildCallContent(call, null);

      const participants = (call.parties || []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.emailAddress,
        role: p.affiliation === 'Internal' ? 'internal' as const : 'external' as const,
        speakingDuration: undefined, // Would need analytics API
      }));

      const highlights = call.content?.pointsOfInterest?.map((poi) => ({
        timestamp: poi.startTime,
        text: poi.text,
        type: poi.type,
      }));

      // Match customer by explicit config overrides or automatic matching
      const matchedCustomerId = await this.matchCustomer(call, config);

      // Normalize topics: Gong API may return topics as objects {name, duration} or strings
      // We normalize to string[] for consistent storage and rendering
      const normalizedTopics = call.content?.topics?.map((topic: unknown) => {
        if (typeof topic === 'string') return topic;
        if (topic && typeof topic === 'object' && 'name' in topic) {
          return String((topic as { name: string }).name);
        }
        return String(topic);
      });

      const metadata: GongSourceMetadata = {
        callId,
        duration: call.duration,
        direction: call.direction === 'Inbound' ? 'inbound' : 'outbound',
        participants,
        topics: normalizedTopics,
        highlights,
        outcome: undefined, // Would need custom fields
        dealId: call.dealId,
        scheduledAt: call.scheduled,
        startedAt: call.started,
        gongUrl: call.url,
        sentiment: undefined, // Would need analytics API
        matchedCustomerId: matchedCustomerId || undefined,
        hasTranscript: false, // Transcript not yet loaded
      };

      discovered.push({
        externalId: callId,
        title: call.title || `Gong Call ${callId}`,
        content,
        contentPreview: this.generatePreview(content),
        metadata,
      });
    }

    // Attach cursor to array for pagination support
    // TypeScript allows adding properties to arrays
    const result = discovered as DiscoveredSource<GongStagedSource>[] & { _cursor?: string };
    result._cursor = nextCursor;
    return result;
  }

  /**
   * Get call transcript.
   */
  private async getCallTranscript(callId: string, client: ApiClient): Promise<GongTranscript | null> {
    try {
      const response = await client.post<{ callTranscripts: GongTranscript[] }>(
        '/calls/transcript',
        { filter: { callIds: [callId] } }
      );
      return response.callTranscripts[0] || null;
    } catch (error) {
      logger.error('Failed to fetch Gong transcript', error, {
        callId,
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Get transcripts for multiple calls in parallel.
   * Avoids sequential delays by batching requests.
   *
   * Limit concurrent API requests to 10 at a time to manage rate limits and memory.
   * Returns a map with call IDs and their transcripts (or undefined if fetch failed).
   *
   * @param callIds - Array of Gong call IDs
   * @param client - Authenticated API client
   * @returns Map of call IDs to transcripts, plus failure rate for monitoring
   */
  private async getCallsTranscripts(
    callIds: string[],
    client: ApiClient
  ): Promise<{ transcripts: Map<string, GongTranscript | undefined>; failureRate: number }> {
    const transcriptMap = new Map<string, GongTranscript | undefined>();
    const batchSize = 10;
    let totalFailures = 0;

    // Process calls in chunks with delay between batches
    for (let i = 0; i < callIds.length; i += batchSize) {
      const batch = callIds.slice(i, i + batchSize);

      // Add delay between batches to avoid rate limiting (skip first batch)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Process this batch in parallel using Promise.allSettled
      const results = await Promise.allSettled(
        batch.map((id) => this.getCallTranscript(id, client))
      );

      results.forEach((result, index) => {
        const callId = batch[index];
        if (result.status === 'fulfilled') {
          transcriptMap.set(callId, result.value || undefined);
        } else {
          // Transcript fetch failed - continue with call metadata only (transcripts are optional)
          logger.warn('Failed to fetch transcript for call', {
            callId,
            batchIndex: i / batchSize,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
          transcriptMap.set(callId, undefined);
          totalFailures++;
        }
      });
    }

    const failureRate = callIds.length > 0 ? totalFailures / callIds.length : 0;

    // Alert if failure rate is high - suggests systemic API issues
    if (failureRate > 0.5) {
      logger.error('High Gong transcript failure rate', {
        totalCalls: callIds.length,
        failures: totalFailures,
        failureRate: `${(failureRate * 100).toFixed(1)}%`,
        possibleCause: 'Check Gong API credentials, rate limits, or permissions',
      });
    }

    return { transcripts: transcriptMap, failureRate };
  }

  /**
   * Build call content from call data and transcript.
   */
  private buildCallContent(call: GongCall, transcript: GongTranscript | null): string {
    const parts: string[] = [];

    // Header
    parts.push(`# ${call.title || 'Gong Call'}`);
    parts.push('');
    if (call.started) {
      parts.push(`**Date:** ${new Date(call.started).toLocaleString()}`);
    }
    if (call.duration) {
      parts.push(`**Duration:** ${Math.round(call.duration / 60)} minutes`);
    }
    if (call.direction) {
      parts.push(`**Direction:** ${call.direction}`);
    }
    parts.push('');

    // Participants
    if (call.parties?.length) {
      parts.push('## Participants');
      for (const party of call.parties) {
        const role = party.affiliation === 'Internal' ? '(Internal)' : '(External)';
        parts.push(`- ${party.name} ${role}`);
      }
      parts.push('');
    }

    // Topics
    if (call.content?.topics?.length) {
      parts.push('## Topics Discussed');
      for (const topic of call.content.topics) {
        parts.push(`- ${topic}`);
      }
      parts.push('');
    }

    // Key Moments
    if (call.content?.pointsOfInterest?.length) {
      parts.push('## Key Moments');
      for (const poi of call.content.pointsOfInterest) {
        const timestamp = this.formatTimestamp(poi.startTime);
        parts.push(`### [${timestamp}] ${poi.type}`);
        parts.push(poi.text);
        parts.push('');
      }
    }

    // Transcript
    if (transcript?.transcript?.length) {
      parts.push('## Transcript');
      parts.push('');

      // Build speaker map
      const speakerMap = new Map<string, string>();
      if (call.parties) {
        for (const party of call.parties) {
          speakerMap.set(party.speakerId, party.name);
        }
      }

      for (const segment of transcript.transcript) {
        const speakerName = speakerMap.get(segment.speakerId) || 'Unknown';
        parts.push(`**${speakerName}:**`);
        for (const sentence of segment.sentences) {
          parts.push(sentence.text);
        }
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /**
   * Format timestamp from seconds to MM:SS.
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Fetch full content for a Gong call by its external ID (callId).
   * Used for lazy content sync when sources are linked to customers.
   *
   * @param externalId - The Gong call ID
   * @returns Object with content (or null) and optional error information
   */
  async fetchContent(
    externalId: string
  ): Promise<{ content: string | null; error?: string; isRetryable?: boolean }> {
    try {
      const { credentials } = await this.credentialManager.load();
      const client = await this.getApiClient(credentials);

      // Fetch call details using POST /calls/extensive to get full parties data with speakerIds
      // Note: Response has nested metaData structure that we need to normalize
      const callsResponse = await client.post<{ calls: GongExtensiveCallResponse[] }>(
        '/calls/extensive',
        {
          filter: { callIds: [externalId] },
          contentSelector: {
            exposedFields: {
              parties: true,
              content: { topics: true, pointsOfInterest: true },
              collaboration: { publicComments: true },
            },
          },
        }
      );

      const extCall = callsResponse.calls?.[0];
      if (!extCall || !extCall.metaData) {
        logger.warn('Gong call not found for content fetch', { callId: externalId });
        return {
          content: null,
          error: `Gong call ${externalId} not found. It may have been deleted or you may not have access.`,
          isRetryable: false,
        };
      }

      // Normalize the extensive response to our GongCall interface
      const call = normalizeExtensiveResponse(extCall);

      // Fetch transcript
      const transcript = await this.getCallTranscript(externalId, client);

      // Build speaker map from parties - Gong's speakerId in transcript should match party.speakerId
      // But sometimes the mapping isn't perfect, so we also try to fetch speakers endpoint
      const speakerMap = new Map<string, string>();

      if (call.parties) {
        for (const party of call.parties) {
          if (party.speakerId) {
            speakerMap.set(party.speakerId, party.name);
          }
        }
      }

      // If we have transcript segments with unmapped speaker IDs, try the speakers endpoint
      if (transcript?.transcript) {
        const unmappedSpeakerIds = transcript.transcript
          .map(s => s.speakerId)
          .filter(id => !speakerMap.has(id));

        if (unmappedSpeakerIds.length > 0) {
          try {
            // Gong's /calls/{id}/speakers endpoint returns speaker-to-party mapping
            const speakersResponse = await client.get<{
              callSpeakers: Array<{
                speakerId: string;
                name?: string;
                userId?: string;
              }>;
            }>(`/calls/${externalId}/speakers`);

            if (speakersResponse.callSpeakers) {
              for (const speaker of speakersResponse.callSpeakers) {
                if (speaker.speakerId && speaker.name && !speakerMap.has(speaker.speakerId)) {
                  speakerMap.set(speaker.speakerId, speaker.name);
                }
              }
            }
          } catch (speakerError) {
            // Speakers endpoint might not be available, continue with what we have
            logger.warn('Failed to fetch Gong speakers, using party data only', {
              callId: externalId,
              error: speakerError instanceof Error ? speakerError.message : 'Unknown',
            });
          }
        }
      }

      // Build full content with speaker map
      return { content: this.buildCallContentWithSpeakers(call, transcript, speakerMap) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable =
        errorMessage.includes('timeout') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('503');

      logger.error('Failed to fetch Gong call content', error, {
        callId: externalId,
        isRetryable,
      });

      return {
        content: null,
        error: errorMessage,
        isRetryable,
      };
    }
  }

  /**
   * Build call content with a pre-built speaker map.
   */
  private buildCallContentWithSpeakers(
    call: GongCall,
    transcript: GongTranscript | null,
    speakerMap: Map<string, string>
  ): string {
    const parts: string[] = [];

    // Header
    parts.push(`# ${call.title}`);
    parts.push('');
    parts.push(`**Date:** ${new Date(call.started).toLocaleString()}`);
    parts.push(`**Duration:** ${Math.round(call.duration / 60)} minutes`);
    parts.push(`**Direction:** ${call.direction}`);
    parts.push('');

    // Participants
    if (call.parties?.length) {
      parts.push('## Participants');
      for (const party of call.parties) {
        const role = party.affiliation === 'Internal' ? '(Internal)' : '(External)';
        parts.push(`- ${party.name} ${role}`);
      }
      parts.push('');
    }

    // Topics
    if (call.content?.topics?.length) {
      parts.push('## Topics Discussed');
      for (const topic of call.content.topics) {
        parts.push(`- ${topic}`);
      }
      parts.push('');
    }

    // Key Moments
    if (call.content?.pointsOfInterest?.length) {
      parts.push('## Key Moments');
      for (const poi of call.content.pointsOfInterest) {
        const timestamp = this.formatTimestamp(poi.startTime);
        parts.push(`### [${timestamp}] ${poi.type}`);
        parts.push(poi.text);
        parts.push('');
      }
    }

    // Transcript
    if (transcript?.transcript?.length) {
      parts.push('## Transcript');
      parts.push('');

      for (const segment of transcript.transcript) {
        const speakerName = speakerMap.get(segment.speakerId) || `Speaker ${segment.speakerId.slice(-4)}`;
        parts.push(`**${speakerName}:**`);
        for (const sentence of segment.sentences) {
          parts.push(sentence.text);
        }
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /**
   * Test Gong connection.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return testConnection(async () => {
      const { credentials } = await this.credentialManager.load();
      const client = await this.getApiClient(credentials);
      await client.get('/users');
    });
  }
}

// Export singleton instance
export const gongAdapter = new GongDiscoveryAdapter();
