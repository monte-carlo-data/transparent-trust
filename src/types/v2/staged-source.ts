/**
 * StagedSource TypeScript Types
 *
 * Discriminated unions for type-safe access to the StagedSource model.
 * The Prisma model stores `metadata` as Json - these types provide compile-time safety.
 */

import type { StagedSource as PrismaStagedSource, SourceAssignment as PrismaSourceAssignment } from '@prisma/client';
import type { LibraryId } from './building-block';

// =============================================================================
// SOURCE TYPES
// =============================================================================

export const SOURCE_TYPES = ['url', 'zendesk', 'slack', 'notion', 'gong', 'document', 'looker'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// =============================================================================
// SOURCE-SPECIFIC METADATA
// =============================================================================

/** URL source metadata */
export interface UrlSourceMetadata {
  /** The actual URL */
  url: string;
  /** Domain for filtering/grouping */
  domain: string;
  /** When the URL was crawled */
  crawledAt?: string;
  /** HTTP status from crawl */
  httpStatus?: number;
  /** Content type from headers */
  contentType?: string;
  /** Page title from HTML or first H1 from markdown */
  pageTitle?: string;
  /** Meta description */
  metaDescription?: string;
  /** Whether content was markdown format */
  isMarkdown?: boolean;
}

/** Zendesk ticket source metadata */
export interface ZendeskSourceMetadata {
  /** Zendesk ticket ID */
  ticketId: number;
  /** Ticket status */
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  /** Priority level */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Assigned agent */
  assignee?: {
    id: number;
    name: string;
    email: string;
  };
  /** Requester info */
  requester?: {
    id: number;
    name: string;
    email: string;
    organization?: string;
  };
  /** Ticket tags */
  tags?: string[];
  /** Custom fields */
  customFields?: Record<string, unknown>;
  /** Ticket created date */
  ticketCreatedAt: string;
  /** Ticket updated date */
  ticketUpdatedAt: string;
  /** Number of comments */
  commentCount?: number;
  /** Satisfaction rating */
  satisfaction?: {
    score: 'good' | 'bad' | 'offered' | 'unoffered';
    comment?: string;
  };
}

/** Slack thread source metadata */
export interface SlackSourceMetadata {
  /** Slack channel ID */
  channelId: string;
  /** Channel name for display */
  channelName: string;
  /** Thread timestamp (ts) */
  threadTs: string;
  /** Parent message timestamp */
  messageTs?: string;
  /** Thread participants */
  participants?: Array<{
    userId: string;
    name: string;
    isBot?: boolean;
  }>;
  /** Reply count */
  replyCount?: number;
  /** Reactions on thread */
  reactions?: Array<{
    name: string;
    count: number;
  }>;
  /** When thread was started */
  threadStartedAt: string;
  /** Last reply timestamp */
  lastReplyAt?: string;
  /** Permalink to message */
  permalink?: string;
  /** Customer ID (for customer-specific ingestion) */
  customerId?: string;
}

/** Notion page source metadata */
export interface NotionSourceMetadata {
  /** Notion page ID (note: also stored in externalId, this is for reference) */
  pageId?: string;
  /** Workspace ID */
  workspaceId?: string;
  /** Parent page/database ID */
  parentId?: string;
  /** Parent type */
  parentType?: 'page' | 'database' | 'workspace';
  /** Page properties (from database) */
  properties?: Record<string, unknown>;
  /** Page icon */
  icon?: {
    type: 'emoji' | 'external' | 'file';
    value: string;
  };
  /** Page cover */
  cover?: {
    type: 'external' | 'file';
    url: string;
  };
  /** Created by */
  createdBy?: {
    id: string;
    name?: string;
  };
  /** Last edited by */
  lastEditedBy?: {
    id: string;
    name?: string;
  };
  /** Page created time */
  notionCreatedAt?: string;
  /** Page last edited time */
  notionUpdatedAt?: string;
  /** URL to Notion page */
  notionUrl?: string;
}

/** Gong call source metadata */
export interface GongSourceMetadata {
  /** Gong call ID */
  callId: string;
  /** Call duration in seconds */
  duration: number;
  /** Call direction */
  direction?: 'inbound' | 'outbound';
  /** Call participants */
  participants: Array<{
    id?: string;
    name: string;
    email?: string;
    role: 'internal' | 'external';
    speakingDuration?: number;
  }>;
  /** Topics/trackers detected */
  topics?: string[];
  /** Key moments/highlights */
  highlights?: Array<{
    timestamp: number;
    text: string;
    type: string;
  }>;
  /** Call outcome */
  outcome?: string;
  /** Associated deal/opportunity */
  dealId?: string;
  /** Call scheduled time */
  scheduledAt?: string;
  /** Call actual start time */
  startedAt: string;
  /** Gong URL */
  gongUrl?: string;
  /** Sentiment analysis */
  sentiment?: {
    overall: 'positive' | 'neutral' | 'negative';
    customerSentiment?: 'positive' | 'neutral' | 'negative';
  };
  /** Automatically matched customer ID (via CRM dealId or email domain) */
  matchedCustomerId?: string;
  /** Whether the full transcript has been fetched (lazy loading) */
  hasTranscript?: boolean;
}

/** Uploaded document source metadata */
export interface DocumentSourceMetadata {
  /** Original file name */
  fileName: string;
  /** File type/extension */
  fileType: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  fileSize?: number;
  /** S3 key or storage path */
  s3Key?: string;
  /** Storage bucket */
  bucket?: string;
  /** Who uploaded it */
  uploadedBy?: string;
  /** When it was uploaded */
  uploadedAt: string;
  /** Document page count (for PDFs) */
  pageCount?: number;
  /** Extracted text preview */
  textPreview?: string;
  /** OCR was used */
  ocrProcessed?: boolean;

  // Extraction metadata (V2)
  /** Text extraction method used ('pdf-parse', 'mammoth', 'exceljs', etc.) */
  extractionMethod?: 'pdf-parse' | 'claude' | 'mammoth' | 'exceljs' | 'pptx-parser' | 'direct';
  /** Extraction duration in milliseconds */
  extractionDuration?: number;
  /** Extracted text length in characters */
  textLength?: number;
  /** Validated file type from magic bytes */
  validatedFileType?: string;
}

/** Looker dashboard source metadata */
export interface LookerSourceMetadata {
  /** Looker dashboard ID */
  dashboardId: string;
  /** Dashboard title */
  dashboardTitle: string;
  /** Dashboard description */
  dashboardDescription?: string;
  /** Number of tiles in dashboard */
  tileCount: number;
  /** Number of queries executed */
  queryCount: number;
  /** When dashboard data was last fetched */
  lastFetched: string;
}

// =============================================================================
// SOURCE EXTRACTION (one source → many skills)
// =============================================================================

/**
 * Tracks how a single source was extracted/split into multiple skills.
 * Used when one Gong call, Slack thread, or document feeds multiple skills.
 */
export interface SourceExtraction {
  /** Reference to the StagedSource */
  sourceId: string;
  /** Reference to the BuildingBlock (skill) this content was extracted to */
  blockId: string;
  /** The specific excerpt from the source that was used */
  excerpt: string;
  /** Why this source matched/was extracted to this skill */
  reason: string;
  /** When this extraction was performed */
  extractedAt: string;
  /** Who performed the extraction */
  extractedBy?: string;
}

// =============================================================================
// DISCRIMINATED UNION BY SOURCE TYPE
// =============================================================================

export type TypedStagedSource =
  | UrlStagedSource
  | ZendeskStagedSource
  | SlackStagedSource
  | NotionStagedSource
  | GongStagedSource
  | DocumentStagedSource
  | LookerStagedSource;

interface BaseStagedSource extends Omit<PrismaStagedSource, 'metadata'> {
  sourceType: SourceType;
  libraryId: LibraryId;
}

export interface UrlStagedSource extends BaseStagedSource {
  sourceType: 'url';
  metadata: UrlSourceMetadata;
}

export interface ZendeskStagedSource extends BaseStagedSource {
  sourceType: 'zendesk';
  metadata: ZendeskSourceMetadata;
}

export interface SlackStagedSource extends BaseStagedSource {
  sourceType: 'slack';
  metadata: SlackSourceMetadata;
}

export interface NotionStagedSource extends BaseStagedSource {
  sourceType: 'notion';
  metadata: NotionSourceMetadata;
}

export interface GongStagedSource extends BaseStagedSource {
  sourceType: 'gong';
  metadata: GongSourceMetadata;
}

export interface DocumentStagedSource extends BaseStagedSource {
  sourceType: 'document';
  metadata: DocumentSourceMetadata;
}

export interface LookerStagedSource extends BaseStagedSource {
  sourceType: 'looker';
  metadata: LookerSourceMetadata;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isUrlSource(source: TypedStagedSource): source is UrlStagedSource {
  return source.sourceType === 'url';
}

export function isZendeskSource(source: TypedStagedSource): source is ZendeskStagedSource {
  return source.sourceType === 'zendesk';
}

export function isSlackSource(source: TypedStagedSource): source is SlackStagedSource {
  return source.sourceType === 'slack';
}

export function isNotionSource(source: TypedStagedSource): source is NotionStagedSource {
  return source.sourceType === 'notion';
}

export function isGongSource(source: TypedStagedSource): source is GongStagedSource {
  return source.sourceType === 'gong';
}

export function isDocumentSource(source: TypedStagedSource): source is DocumentStagedSource {
  return source.sourceType === 'document';
}

export function isLookerSource(source: TypedStagedSource): source is LookerStagedSource {
  return source.sourceType === 'looker';
}

// =============================================================================
// CONVERSION HELPERS
// =============================================================================

/**
 * Cast a Prisma StagedSource to a typed version.
 */
export function toTypedSource(source: PrismaStagedSource): TypedStagedSource {
  return source as unknown as TypedStagedSource;
}

/**
 * Cast typed source back to Prisma type for database operations.
 */
export function toPrismaSource(source: TypedStagedSource): PrismaStagedSource {
  return source as unknown as PrismaStagedSource;
}

// =============================================================================
// SOURCE ASSIGNMENT TYPES
// =============================================================================

export interface TypedSourceAssignment extends PrismaSourceAssignment {
  stagedSource?: TypedStagedSource;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface StageSourceInput<T extends TypedStagedSource = TypedStagedSource> {
  sourceType: T['sourceType'];
  externalId: string;
  libraryId: LibraryId;
  customerId?: string;
  title: string;
  content?: string;
  contentPreview?: string;
  metadata: T['metadata'];
  stagedBy?: string;
}

export interface AssignSourceInput {
  stagedSourceId: string;
  blockId: string;
  assignedBy?: string;
  notes?: string;
}

export interface IncorporateSourceInput {
  assignmentId: string;
  incorporatedBy?: string;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

export interface SourceQueryOptions {
  libraryId?: LibraryId;
  sourceType?: SourceType;
  /** Filter by customer ID (for customer-scoped sources) */
  customerId?: string;
  /** Only sources with content (not empty) */
  hasContent?: boolean;
  /** Only pending (not ignored, not fully incorporated) */
  pendingOnly?: boolean;
  /** Only ignored */
  ignoredOnly?: boolean;
  /** Search title/content */
  search?: string;
  /** Staged after this date */
  stagedAfter?: Date;
  /** Staged before this date */
  stagedBefore?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'stagedAt' | 'title';
  orderDir?: 'asc' | 'desc';
}

// =============================================================================
// DISCOVERY ADAPTER INTERFACE
// =============================================================================

/**
 * Interface for source discovery adapters.
 * Each integration (Zendesk, Slack, etc.) implements this interface.
 */
export interface DiscoveryAdapter<T extends TypedStagedSource = TypedStagedSource> {
  /** Unique identifier for this adapter */
  readonly sourceType: T['sourceType'];

  /** Human-readable name */
  readonly displayName: string;

  /**
   * Discover new sources from the external system.
   * Called periodically by a background job.
   */
  discover(options: DiscoveryOptions): Promise<DiscoveredSource<T>[]>;

  /**
   * Fetch full content for a source.
   * May be called lazily when user views the source.
   *
   * Return types:
   * - `string | null` - Simple content return (legacy)
   * - `{ content, error?, isRetryable? }` - Detailed result with error info
   */
  fetchContent?(
    externalId: string
  ): Promise<string | null | { content: string | null; error?: string; isRetryable?: boolean }>;

  /**
   * Validate connection/credentials.
   */
  testConnection?(): Promise<{ success: boolean; error?: string }>;
}

export interface DiscoveryOptions {
  /** Library to stage sources into */
  libraryId: LibraryId;
  /** Integration connection ID */
  connectionId?: string;
  /** Only discover sources after this date */
  since?: Date;
  /** Maximum sources to discover in one run */
  limit?: number;
  /** Page number for pagination (1-indexed) */
  page?: number;
  /** Cursor for cursor-based pagination (e.g., Gong API) */
  cursor?: string;
  /** Optional config overrides for this discovery */
  config?: Record<string, string | string[]>;
  /** Customer ID for scoping (used by customer-specific sources) */
  customerId?: string;
  /** Team ID for loading team-specific integration config */
  teamId?: string;
}

export interface DiscoveredSource<T extends TypedStagedSource = TypedStagedSource> {
  externalId: string;
  title: string;
  content?: string;
  contentPreview?: string;
  metadata: T['metadata'];
}
