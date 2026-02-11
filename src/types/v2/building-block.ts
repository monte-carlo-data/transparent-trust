/**
 * BuildingBlock TypeScript Types
 *
 * Discriminated unions for type-safe access to the unified BuildingBlock model.
 * The Prisma model stores `attributes` as Json - these types provide compile-time safety.
 */

import type { BuildingBlock as PrismaBuildingBlock } from '@prisma/client';

// =============================================================================
// BLOCK TYPES
// =============================================================================

export const BLOCK_TYPES = ['knowledge', 'persona', 'template'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

// =============================================================================
// SKILL TYPES
// =============================================================================

export const SKILL_TYPES = ['knowledge', 'intelligence'] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

// =============================================================================
// LIBRARY IDS
// =============================================================================

export const LIBRARY_IDS = [
  'knowledge',
  'it',
  'gtm',
  'talent',
  'customers',
  'prompts',
  'personas',
  'templates',
  'views',
] as const;
export type LibraryId = (typeof LIBRARY_IDS)[number];

// Map library IDs to their block types
export const LIBRARY_BLOCK_TYPE: Record<LibraryId, BlockType> = {
  knowledge: 'knowledge',
  it: 'knowledge',
  gtm: 'knowledge',
  talent: 'knowledge',
  customers: 'knowledge',
  prompts: 'knowledge',
  personas: 'persona',
  templates: 'template',
  views: 'knowledge',
};

// =============================================================================
// STATUS
// =============================================================================

export const BLOCK_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

export const SYNC_STATUSES = ['SYNCED', 'LOCAL_CHANGES', 'CONFLICT'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

// =============================================================================
// SHARED TYPES
// =============================================================================

/** Skill owner/SME information */
export interface SkillOwner {
  userId?: string;
  name: string;
  email?: string;
  image?: string;
}

/** History entry for audit trail */
export interface HistoryEntry {
  date: string;
  action: 'created' | 'updated' | 'refreshed' | 'owner_added' | 'owner_removed';
  summary: string;
  user?: string;
}

/** Source assignment information */
export interface Source {
  id: string;
  url: string;
  title?: string;
  type: 'zendesk' | 'slack' | 'notion' | 'gong' | 'url' | 'document';
  status: 'pending' | 'incorporated';
  fetchedAt?: string;
}

/** Scope definition for what a skill covers and should cover in the future */
export interface ScopeDefinition {
  /** What this skill currently covers */
  covers: string;
  /** What types of content should be added to this skill in the future */
  futureAdditions: string[];
  /** What should explicitly NOT be included in this skill (to prevent bloat) */
  notIncluded?: string[];
  /** Keywords for fast matching (extracted from covers or manually set) */
  keywords?: string[];
}

/** Inline source citation - appears as [1], [2], etc. in skill content */
export interface SourceCitation {
  /** Citation number used in content: [1], [2], etc. */
  id: string;
  /** Reference to the StagedSource */
  sourceId: string;
  /** Display label for the citation (URL, "Slack thread", "Gong call", etc.) */
  label: string;
  /** Direct link if applicable (URL sources) */
  url?: string;
  /** Alternative reference (e.g., ticket number, channel name) */
  reference?: string;
}

/** Source contradiction or conflict detected between sources */
export interface SourceContradiction {
  /** Type of contradiction */
  type: 'technical_contradiction' | 'version_mismatch' | 'scope_mismatch' | 'outdated_vs_current' | 'different_perspectives';
  /** Human-readable description of the contradiction */
  description: string;
  /** First source involved */
  sourceA: {
    id: string;
    label: string;
    excerpt: string;
  };
  /** Second source involved */
  sourceB: {
    id: string;
    label: string;
    excerpt: string;
  };
  /** Severity of the contradiction */
  severity: 'low' | 'medium' | 'high';
  /** Recommendation for resolving the contradiction */
  recommendation: string;
}

// =============================================================================
// SKILL MODES
// =============================================================================

/**
 * Creation mode determines how the skill is built from sources
 * - 'generated': LLM synthesizes content from all sources (default)
 * - 'foundational': User defines scope first, LLM extracts only relevant portions
 */
export type CreationMode = 'generated' | 'foundational';

/**
 * Refresh mode determines how the skill is updated when new sources are added
 * - 'regenerative': Reprocess all sources and rebuild entire content (default)
 * - 'additive': Only process new sources and append to existing content
 */
export type RefreshMode = 'regenerative' | 'additive';

// =============================================================================
// KNOWLEDGE BLOCK ATTRIBUTES (blockType: 'knowledge')
// =============================================================================

/** Base attributes shared by all knowledge blocks */
interface BaseKnowledgeAttributes {
  /** Source URLs that contributed to this knowledge */
  sourceUrls?: string[];
  /** Skill owners/SMEs */
  owners?: SkillOwner[];
  /** Git/source control sync status */
  syncStatus?: 'synced' | 'pending' | 'failed';
  /** How many times this knowledge was used in responses */
  usageCount?: number;
  /** When this knowledge was last used */
  lastUsedAt?: string;
  /** Audit trail of changes */
  history?: HistoryEntry[];
  /** Pending sources waiting to be incorporated */
  pendingSourcesCount?: number;
  /** Source assignments and status */
  sources?: Source[];
  /** Scope definition: what this skill covers and future additions */
  scopeDefinition?: ScopeDefinition;
  /** Inline source citations [1], [2], etc. in the content */
  citations?: SourceCitation[];
  /** Contradictions detected between sources */
  contradictions?: SourceContradiction[];
  /** Feature access control: which features can access this skill */
  exposedTo?: ('slackbot' | 'chat' | 'rfp')[];

  // Foundational Skills Support
  /** Creation mode: 'generated' (default) or 'foundational' (extract-only) */
  creationMode?: CreationMode;
  /** Refresh mode: 'regenerative' (default) or 'additive' (append-only) */
  refreshMode?: RefreshMode;
  /** True if this is a foundational skill that can be cloned to customers */
  isFoundational?: boolean;
  /** If cloned from a foundational skill, the ID of the source skill */
  clonedFrom?: string;
}

/** Skill library attributes */
export interface SkillAttributes extends BaseKnowledgeAttributes {
  /** Related skill slugs for cross-referencing */
  relatedSlugs?: string[];
}

/** IT Skill library attributes */
export interface ITSkillAttributes extends BaseKnowledgeAttributes {
  /** Application or system this relates to */
  application?: string;
  /** Department that owns this knowledge */
  department?: string;
  /** Common error codes or symptoms */
  errorCodes?: string[];
  /** Resolution steps summary */
  resolutionSummary?: string;
}

/** Customer Profile library attributes */
export interface CustomerProfileAttributes extends BaseKnowledgeAttributes {
  /** Company name */
  company?: string;
  /** Industry vertical */
  industry?: string;
  /** Company size/tier */
  tier?: 'enterprise' | 'mid-market' | 'smb';
  /** Key contacts */
  contacts?: Array<{
    name: string;
    role: string;
    email?: string;
  }>;
  /** Products/features they use */
  products?: string[];
  /** Account health score */
  healthScore?: number;
  /** Salesforce or CRM ID */
  crmId?: string;
  /** Global flag for customer-scoped skills - when true, skill is available to all customers */
  isGlobal?: boolean;
}

/** GTM Skills library attributes */
export interface GTMSkillAttributes extends BaseKnowledgeAttributes {
  /** Industry vertical (Financial Services, Healthcare, etc.) */
  vertical?: string;
  /** Use case this skill addresses */
  useCase?: string;
  /** Deal stage relevance (Discovery, Evaluation, Negotiation) */
  dealStage?: string;
  /** Competing solutions mentioned */
  competitors?: string[];
  /** Common objections addressed */
  objections?: string[];
  /** Customer skill this was promoted from */
  promotedFrom?: string;
}

/** Prompt library attributes (prompts are knowledge too) */
export interface PromptAttributes extends BaseKnowledgeAttributes {
  /** What this prompt is used for */
  useCase?: string;
  /** Model this prompt is optimized for */
  targetModel?: string;
  /** Variables that can be injected */
  variables?: Array<{
    name: string;
    description: string;
    required?: boolean;
    defaultValue?: string;
  }>;
  /** A/B test variants */
  variants?: Array<{
    id: string;
    content: string;
    weight: number;
  }>;
  /** Performance metrics */
  metrics?: {
    avgRating?: number;
    usageCount?: number;
    lastUsedAt?: string;
  };

  // ==========================================================================
  // PROMPT MANAGEMENT EXTENSIONS
  // ==========================================================================

  /**
   * Prompt tier for warning-based enforcement
   * - 1 (Locked): Core system - show strong warning before editing
   * - 2 (Caution): Important for accuracy - show warning
   * - 3 (Open): Safe to customize - no warning needed
   */
  promptTier?: 1 | 2 | 3;

  /**
   * Source system this prompt overrides (for tracking)
   * - 'v2-core': Overrides a block from core-blocks.ts
   * - 'legacy': Overrides a block from prompt-system/blocks.ts (removed)
   * - 'chat-library': Legacy (removed) - was from chatPromptLibrary.ts
   * - 'library-context': Overrides a library context from builder.ts
   * - 'custom': User-created prompt (no override)
   */
  promptSource?: 'v2-core' | 'legacy' | 'chat-library' | 'library-context' | 'custom';

  /**
   * Original block ID this prompt overrides (if promptSource is set)
   * e.g., 'source_fidelity', 'role_mission', 'builtin-rfp-soc2'
   */
  overridesBlockId?: string;

  /**
   * Context-specific variants (for legacy prompt system compatibility)
   * Maps context names to content, e.g., { "default": "...", "questions": "...", "it_bot": "..." }
   */
  contextVariants?: Record<string, string>;

  /**
   * Git-style version history with diffs and commit messages
   */
  versionHistory?: PromptVersionEntry[];

  /**
   * Preset configuration (for bundled prompt sets)
   * When set, this prompt acts as a "preset" that bundles multiple blocks
   */
  presetConfig?: PromptPresetConfig;
}

/** A single version entry in prompt history */
export interface PromptVersionEntry {
  /** Version number (1, 2, 3, ...) */
  version: number;
  /** Snapshot of content at this version */
  content: string;
  /** Snapshot of context variants at this version (if any) */
  contextVariantsSnapshot?: Record<string, string>;
  /** Git-style commit message describing the change */
  commitMessage: string;
  /** Who made the change (user ID or email) */
  changedBy: string;
  /** When the change was made */
  changedAt: string;
  /** Text diff from previous version (for display) */
  diff?: string;
}

/** Configuration for a prompt preset (bundled blocks + optional persona) */
export interface PromptPresetConfig {
  /** Block IDs to include in this preset */
  blockIds: string[];
  /** Optional persona ID to include */
  personaId?: string;
  /** Output format for this preset */
  outputFormat?: 'json' | 'markdown' | 'text';
  /** Context this preset is designed for */
  targetContext?: string;
}

// =============================================================================
// VIEW BLOCK ATTRIBUTES (blockType: 'knowledge', libraryId: 'views')
// =============================================================================

/** Analysis view attributes - generates formatted output by combining customer data + prompt composition */
export interface ViewAttributes extends BaseKnowledgeAttributes {
  /** Which prompt composition to use for generating the view */
  compositionId: string;
  /** Tab display order (1 = first analysis view tab) */
  displayOrder?: number;
  /** Lucide icon name for the tab */
  icon?: string;
  /** Description of what this view generates */
  viewDescription?: string;
}

// =============================================================================
// PERSONA BLOCK ATTRIBUTES (blockType: 'persona')
// =============================================================================

export interface PersonaAttributes {
  /** Communication tone */
  tone?: 'professional' | 'casual' | 'technical' | 'friendly' | 'formal';
  /** Target audience */
  audience?: string;
  /** Writing style guidelines */
  styleGuide?: string;
  /** Things to always do */
  alwaysDo?: string[];
  /** Things to never do */
  neverDo?: string[];
  /** Example responses for consistency */
  examples?: Array<{
    input: string;
    output: string;
  }>;
  /** Voice characteristics */
  voice?: {
    formality: 'low' | 'medium' | 'high';
    enthusiasm: 'low' | 'medium' | 'high';
    technicality: 'low' | 'medium' | 'high';
  };
  /** Default categories to enable when this persona is selected */
  defaultCategories?: string[];
  /** Sharing status for approval workflow */
  shareStatus?: 'PRIVATE' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  /** Whether this is a default/recommended persona */
  isDefault?: boolean;
}

// =============================================================================
// TEMPLATE BLOCK ATTRIBUTES (blockType: 'template')
// =============================================================================

export interface TemplateAttributes {
  /** Output format (google-slides, word, markdown, etc.) */
  format?: string;
  /** Template sections/structure */
  sections?: Array<{
    id: string;
    name: string;
    description?: string;
    required?: boolean;
  }>;
  /** Variables to fill in */
  variables?: Array<{
    name: string;
    description: string;
    type: 'text' | 'number' | 'date' | 'list' | 'rich-text';
    required?: boolean;
    defaultValue?: string;
  }>;
  /** Instructions for filling out */
  instructions?: string;
  /** Example completed template */
  exampleUrl?: string;
  /** Estimated time to complete */
  estimatedMinutes?: number;

  // =========================================================================
  // OUTPUT TYPE CONFIGURATION (for structured exports like Google Slides)
  // =========================================================================

  /** Output type determines how the template is rendered */
  outputType?: 'text' | 'google-slides' | 'word' | 'pdf';

  /** Google Slides template ID (only for outputType: 'google-slides') - DEPRECATED: use outputConfig */
  googleSlidesTemplateId?: string;

  /**
   * Format-specific configuration (keyed by outputType).
   * Extensible structure for different output formats.
   */
  outputConfig?: {
    'google-slides'?: {
      /** Google Slides presentation ID to use as template */
      templateId: string;
    };
    'word'?: {
      /** Future: Word template URL or file reference */
      templateUrl?: string;
    };
  };

  /**
   * Placeholder guide: describes what each {{placeholder}} should contain.
   * Used to instruct the LLM on what content to generate for each placeholder.
   * Example: { "CustomerName": "The full company name", "KeyMetric": "Primary success metric with value" }
   */
  placeholderGuide?: Record<string, string>;

  /** Detected placeholders from the linked template (auto-populated) */
  detectedPlaceholders?: string[];

  /** Default persona to use with this template */
  defaultPersonaId?: string;
}

// =============================================================================
// DISCRIMINATED UNION BY LIBRARY
// =============================================================================

/** Type-safe BuildingBlock by library */
export type TypedBuildingBlock =
  | KnowledgeSkillBlock
  | ITSkillBlock
  | GTMBlock
  | TalentSkillBlock
  | PromptBlock
  | PersonaBlock
  | TemplateBlock
  | ViewBlock;

interface BaseBlock extends Omit<PrismaBuildingBlock, 'attributes'> {
  blockType: BlockType;
  libraryId: LibraryId;
  skillType: SkillType;
  status: BlockStatus;
  syncStatus: SyncStatus;
}

export interface KnowledgeSkillBlock extends BaseBlock {
  blockType: 'knowledge';
  libraryId: 'knowledge';
  attributes: SkillAttributes;
}

export interface ITSkillBlock extends BaseBlock {
  blockType: 'knowledge';
  libraryId: 'it';
  attributes: ITSkillAttributes;
}

export interface TalentSkillBlock extends BaseBlock {
  blockType: 'knowledge';
  libraryId: 'talent';
  attributes: SkillAttributes;
}

export interface GTMBlock extends BaseBlock {
  blockType: 'knowledge';
  libraryId: 'gtm';
  attributes: CustomerProfileAttributes | GTMSkillAttributes;
}

export interface PromptBlock extends BaseBlock {
  blockType: 'knowledge';
  libraryId: 'prompts';
  attributes: PromptAttributes;
}

export interface PersonaBlock extends BaseBlock {
  blockType: 'persona';
  libraryId: 'personas';
  attributes: PersonaAttributes;
}

export interface TemplateBlock extends BaseBlock {
  blockType: 'template';
  libraryId: 'templates';
  attributes: TemplateAttributes;
}

export interface ViewBlock extends BaseBlock {
  blockType: 'knowledge';
  libraryId: 'views';
  attributes: ViewAttributes;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type alias for any block-like object (Prisma or typed).
 * Type guards below accept this union for flexibility when working with Prisma results.
 */
type AnyBlock = PrismaBuildingBlock | TypedBuildingBlock;

export function isKnowledgeSkillBlock(block: AnyBlock): block is KnowledgeSkillBlock {
  return block.libraryId === 'knowledge';
}

export function isITSkillBlock(block: AnyBlock): block is ITSkillBlock {
  return block.libraryId === 'it';
}

export function isTalentSkillBlock(block: AnyBlock): block is TalentSkillBlock {
  return block.libraryId === 'talent';
}

export function isGTMBlock(block: AnyBlock): block is GTMBlock {
  return block.libraryId === 'gtm';
}

export function isPromptBlock(block: AnyBlock): block is PromptBlock {
  return block.libraryId === 'prompts';
}

export function isPersonaBlock(block: AnyBlock): block is PersonaBlock {
  return block.libraryId === 'personas';
}

export function isTemplateBlock(block: AnyBlock): block is TemplateBlock {
  return block.libraryId === 'templates';
}

export function isViewBlock(block: AnyBlock): block is ViewBlock {
  return block.libraryId === 'views';
}

export function isKnowledgeBlock(
  block: AnyBlock
): block is KnowledgeSkillBlock | ITSkillBlock | GTMBlock | PromptBlock {
  return block.blockType === 'knowledge';
}

/**
 * Get the skill type from a block's attributes or schema field
 */
export function getSkillType(block: AnyBlock): SkillType {
  // Check schema field first (after migration)
  if ('skillType' in block && block.skillType) {
    return block.skillType as SkillType;
  }

  // Fallback: derive from attributes for backward compatibility
  const attrs = block.attributes as BaseKnowledgeAttributes;
  if (attrs?.isFoundational && !block.customerId) {
    return 'intelligence';
  }

  return 'knowledge';
}

/**
 * Check if a block is a knowledge-type skill (Q&A format, how-to content)
 */
export function isKnowledgeTypeSkill(block: AnyBlock): boolean {
  return getSkillType(block) === 'knowledge';
}

/**
 * Check if a block is an intelligence-type skill (narrative context, no Q&A)
 */
export function isIntelligenceTypeSkill(block: AnyBlock): boolean {
  return getSkillType(block) === 'intelligence';
}

// =============================================================================
// CONVERSION HELPERS
// =============================================================================

/**
 * Cast a Prisma BuildingBlock to a typed version.
 * Use when you know the library from context.
 */
export function toTypedBlock(block: PrismaBuildingBlock): TypedBuildingBlock {
  // The cast is safe because we control the data going in
  return block as unknown as TypedBuildingBlock;
}

/**
 * Cast typed block back to Prisma type for database operations.
 */
export function toPrismaBlock(block: TypedBuildingBlock): PrismaBuildingBlock {
  return block as unknown as PrismaBuildingBlock;
}

// =============================================================================
// INPUT TYPES (for creating/updating)
// =============================================================================

export interface CreateBlockInput<T extends TypedBuildingBlock = TypedBuildingBlock> {
  libraryId: T['libraryId'];
  title: string;
  content: string;
  slug?: string;
  summary?: string;
  categories?: string[];
  skillType?: SkillType;
  attributes?: T['attributes'];
  entryType?: string;
  teamId?: string;
  ownerId?: string;
  status?: BlockStatus;
  customerId?: string; // Links to Customer table for customer-scoped skills
}

export interface UpdateBlockInput<T extends TypedBuildingBlock = TypedBuildingBlock> {
  title?: string;
  content?: string;
  slug?: string;
  summary?: string;
  categories?: string[];
  skillType?: SkillType;
  attributes?: Partial<T['attributes']>;
  entryType?: string;
  status?: BlockStatus;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

export interface BlockQueryOptions {
  libraryId?: LibraryId;
  blockType?: BlockType;
  status?: BlockStatus;
  teamId?: string;
  ownerId?: string;
  customerId?: string;
  categories?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'title';
  orderDir?: 'asc' | 'desc';
}
