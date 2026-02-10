/**
 * V2 Prompt System Types
 *
 * Simplified prompt system with clear separation:
 * - Blocks: Reusable prompt components
 * - Compositions: Which blocks to use for each task
 * - No variant explosion - different compositions, not different variants
 */

import type { LibraryId } from '@/types/v2';

// =============================================================================
// PROMPT CONTEXTS
// =============================================================================

/**
 * Skill-building contexts (the focus of v2)
 */
export type SkillContext =
  | 'skill_creation'                  // Create new skill with scope + citations (synthesis mode)
  | 'skill_update'                    // Update existing skill with diff + contradiction detection
  | 'skill_matching'                  // Match source to existing skills via scope definitions
  | 'skill_format_refresh'            // Regenerate existing skill through current format standards
  | 'foundational_creation'           // Create foundational skill by extracting scope-relevant content only
  | 'foundational_additive_update';   // Update foundational skill by appending scope-relevant extracts from new sources

/**
 * Tool contexts (RFP, chat, Slack bots, utilities)
 */
export type ToolContext =
  | 'chat_response'           // CL-004: Answer questions with structured output
  | 'rfp_single'              // CL-005: Answer single RFP question with JSON
  | 'rfp_batch'               // CL-005: Answer multiple RFP questions with JSON array
  | 'rfp_skill_matching'      // Match RFP clusters to skills using scope definitions
  | 'rfp_cluster_creation'    // Create semantic clusters from questions + match skills
  | 'slack_bot_it'            // CL-002: Slack bot for IT library
  | 'slack_bot_knowledge'     // CL-002: Slack bot for Knowledge library
  | 'slack_bot_gtm'           // CL-002: Slack bot for GTM library
  | 'slack_bot_talent'        // CL-002: Slack bot for Talent library
  | 'contract_analysis'       // Contract review and risk analysis
  | 'pdf_extraction'          // PDF text extraction
  | 'prompt_builder'          // CL-009: Help refine and improve prompts
  | 'prompt_optimize'         // CL-010: Identify token reduction opportunities
  | 'collateral_placeholder_generation'; // Generate placeholder values for collateral templates

/**
 * Customer analysis view contexts
 */
export type CustomerViewContext =
  | 'customer_account_plan'          // Comprehensive account plan for QBR preparation
  | 'customer_revenue_forecast'      // Revenue forecasting for customers
  | 'customer_competitive_analysis'  // Competitive positioning analysis
  | 'customer_risk_assessment'       // Risk identification and prioritization
  | 'customer_expansion_opportunities' // Upsell and expansion opportunities
  | 'customer_coverage_audit'        // Coverage audit using Looker dashboard data
  | 'customer_operations_audit'      // Operations audit using Looker dashboard data
  | 'customer_adoption_audit';       // Adoption audit using Looker dashboard data

/**
 * All prompt contexts
 */
export type PromptContext = SkillContext | ToolContext | CustomerViewContext;

// =============================================================================
// BLOCK TYPES
// =============================================================================

/**
 * Editability tiers for blocks
 * - Tier 1 (Locked): Core system - changes may break functionality
 * - Tier 2 (Caution): Important for accuracy - edit carefully
 * - Tier 3 (Open): Safe to customize - style and personalization
 */
export type BlockTier = 1 | 2 | 3;

export const BLOCK_TIER_CONFIG: Record<BlockTier, {
  label: string;
  description: string;
  icon: string;
}> = {
  1: {
    label: 'Locked',
    description: 'Core system functionality - changes may break features',
    icon: '🔒',
  },
  2: {
    label: 'Caution',
    description: 'Important for accuracy - customize carefully',
    icon: '⚠️',
  },
  3: {
    label: 'Open',
    description: 'Safe to customize - style and personalization',
    icon: '✏️',
  },
};

/**
 * A reusable prompt block
 * No variants - each block has one definition
 * Different contexts compose different blocks
 *
 * Note: `tokens` is computed dynamically via getBlock()/getBlocks()
 */
export interface PromptBlock {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this block does */
  description: string;
  /** Editability tier */
  tier: BlockTier;
  /** The actual prompt content */
  content: string;
  /** Estimated token count (computed from content, ~4 chars per token) */
  tokens?: number;
}

/**
 * PromptBlock with guaranteed token count (returned from getBlock/getBlocks)
 */
export interface PromptBlockWithTokens extends PromptBlock {
  tokens: number;
}

// =============================================================================
// COMPOSITION TYPES
// =============================================================================

/**
 * Composition category for grouping in UI
 */
export type CompositionCategory =
  | 'chat_rfp'        // Chat and RFP/questionnaire features
  | 'skills'          // Skill creation, update, matching
  | 'foundational'    // Foundational skill operations
  | 'slack_bots'      // Slack bot integrations
  | 'customer_views'  // Customer analysis views
  | 'contract'        // Contract analysis
  | 'utility'         // Utility/helper operations
  | 'collateral';     // Collateral generation

export const COMPOSITION_CATEGORY_CONFIG: Record<CompositionCategory, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  chat_rfp: {
    label: 'Chat & RFP',
    description: 'Interactive chat and questionnaire answering',
    icon: 'MessageSquare',
    color: 'blue',
  },
  skills: {
    label: 'Skill Operations',
    description: 'Creating, updating, and matching skills',
    icon: 'BookOpen',
    color: 'green',
  },
  foundational: {
    label: 'Foundational Skills',
    description: 'Customer intelligence templates',
    icon: 'Layers',
    color: 'purple',
  },
  slack_bots: {
    label: 'Slack Bots',
    description: 'Library-specific Slack integrations',
    icon: 'MessageCircle',
    color: 'orange',
  },
  customer_views: {
    label: 'Customer Views',
    description: 'Customer analysis and insights',
    icon: 'Users',
    color: 'pink',
  },
  contract: {
    label: 'Contract Analysis',
    description: 'Contract review and risk assessment',
    icon: 'FileText',
    color: 'red',
  },
  utility: {
    label: 'Utility',
    description: 'Helper tools and optimizers',
    icon: 'Wrench',
    color: 'gray',
  },
  collateral: {
    label: 'Collateral',
    description: 'Sales and marketing collateral generation',
    icon: 'FileOutput',
    color: 'teal',
  },
};

/**
 * Where a composition is used in the system
 */
export interface CompositionUsage {
  /** Feature name (e.g., "Chat", "RFP Wizard") */
  feature: string;
  /** Route or endpoint (e.g., "/v2/chat", "/api/v2/chat") */
  location: string;
  /** Type of usage */
  type: 'api' | 'ui' | 'internal';
}

/**
 * A composition defines which blocks to use for a specific context
 */
export interface PromptComposition {
  /** Which context this composition is for */
  context: PromptContext;
  /** Human-readable name */
  name: string;
  /** Description of what this composition does */
  description: string;
  /** Block IDs to include, in order */
  blockIds: string[];
  /** Category for grouping in UI */
  category: CompositionCategory;
  /** Where this composition is used */
  usedBy: CompositionUsage[];
  /** Libraries this composition applies to (if scoped) */
  libraries?: LibraryId[];
  /** Expected output format */
  outputFormat: 'json' | 'markdown' | 'text';
  /** JSON schema hint for the expected output (for json format) */
  outputSchema?: string;
}

// =============================================================================
// BUILDER OPTIONS
// =============================================================================

/**
 * Options for building a prompt
 */
export interface BuildPromptOptions {
  /** The context/composition to use */
  context: PromptContext;
  /** Library ID - injects library-specific context (IT, GTM, Knowledge, etc.) */
  libraryId?: LibraryId;
  /** Is this a customer-scoped skill? Adds customer-specific context */
  isCustomerSkill?: boolean;
  /** Additional context to inject (e.g., customer name, specific requirements) */
  additionalContext?: string;
}

/**
 * Result of building a prompt
 */
export interface BuiltPrompt {
  /** The system prompt */
  systemPrompt: string;
  /** The user prompt template (with placeholders) */
  userPromptTemplate: string;
  /** Which composition was used */
  compositionId: string;
  /** Which blocks were used */
  blocksUsed: string[];
  /** Expected output format */
  outputFormat: 'json' | 'markdown' | 'text';
}

// =============================================================================
// SKILL-SPECIFIC OUTPUT TYPES
// =============================================================================

/**
 * Expected output from skill_creation composition
 */
export interface SkillCreationOutput {
  title: string;
  content: string;
  summary: string;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  citations: Array<{
    id: string;
    sourceId: string;
    label: string;
    url?: string;
  }>;
  contradictions?: Array<{
    type: string;
    description: string;
    sourceA: { id: string; label: string; excerpt: string };
    sourceB: { id: string; label: string; excerpt: string };
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  attributes?: {
    keywords?: string[];
    product?: string;
  };
  transparency?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    compositionId: string;
    blockIds: string[];
    model: string;
    tokens: {
      input: number;
      output: number;
    };
    timestamp: string;
  };
}

/**
 * Expected output from skill_update composition
 */
export interface SkillUpdateOutput {
  title: string;
  content: string;
  summary: string;
  /** What changed - for diff display */
  changes: {
    sectionsAdded: string[];
    sectionsUpdated: string[];
    sectionsRemoved: string[];
    changeSummary: string;
  };
  /** Updated citations */
  citations: Array<{
    id: string;
    sourceId: string;
    label: string;
    url?: string;
  }>;
  /** New contradictions detected */
  contradictions?: Array<{
    type: string;
    description: string;
    sourceA: { id: string; label: string; excerpt: string };
    sourceB: { id: string; label: string; excerpt: string };
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  /** Updated scope definition */
  scopeDefinition?: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  /** Per-source extraction tracking (for additive mode) */
  extractedContent?: Array<{
    sourceId: string;
    extracted: string;
  }>;
  /** Should this be split into multiple skills? */
  splitRecommendation?: {
    shouldSplit: boolean;
    reason?: string;
    suggestedSkills?: Array<{
      title: string;
      scope: string;
    }>;
  };
  transparency?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    compositionId: string;
    blockIds: string[];
    model: string;
    tokens: {
      input: number;
      output: number;
    };
    timestamp: string;
  };
}

/**
 * Expected output from skill_matching composition
 */
export interface SkillMatchingOutput {
  matches: Array<{
    skillId: string;
    skillTitle: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    matchedCriteria: string;
    suggestedExcerpt: string;
  }>;
  /** If no matches, should we create a new skill? */
  createNew?: {
    recommended: boolean;
    suggestedTitle: string;
    suggestedScope: {
      covers: string;
      futureAdditions: string[];
    };
  };
}

/**
 * Expected output from skill_format_refresh composition
 * Uses the same structure as SkillUpdateOutput since regenerating through
 * current format standards produces the same output structure (regenerated skill with changes tracked)
 */
export type SkillFormatRefreshOutput = SkillUpdateOutput;

/**
 * Expected output from foundational_creation composition
 */
export interface FoundationalCreationOutput {
  title: string;
  content: string;
  summary: string;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  citations: Array<{
    id: string;
    sourceId: string;
    label: string;
    url?: string;
  }>;
  contradictions?: Array<{
    type: string;
    description: string;
    sourceA: { id: string; label: string; excerpt: string };
    sourceB: { id: string; label: string; excerpt: string };
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  /** Per-source extraction tracking */
  extractedContent?: Array<{
    sourceId: string;
    extracted: string;
  }>;
  transparency?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    compositionId: string;
    blockIds: string[];
    model: string;
    tokens: {
      input: number;
      output: number;
    };
    timestamp: string;
  };
}

/**
 * Expected output from foundational_additive_update composition
 * Now just an alias for SkillUpdateOutput since the fields are unified
 */
export type FoundationalAdditiveUpdateOutput = SkillUpdateOutput & {
  /** Scope definition is required for foundational updates */
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
};

