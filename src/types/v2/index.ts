/**
 * Platform V2 Types
 *
 * Unified type system for the BuildingBlock architecture.
 */

// Customers
export * from './customer';

// Building Blocks
export * from './building-block';

// Staged Sources
export * from './staged-source';

// Re-export commonly used types at the top level for convenience
export type {
  // Block types
  TypedBuildingBlock,
  KnowledgeSkillBlock,
  ITSkillBlock,
  TalentSkillBlock,
  GTMBlock,
  PromptBlock,
  PersonaBlock,
  TemplateBlock,
  BlockType,
  LibraryId,
  BlockStatus,
  // Attribute types
  SkillAttributes,
  ITSkillAttributes,
  GTMSkillAttributes,
  CustomerProfileAttributes,
  PromptAttributes,
  PersonaAttributes,
  TemplateAttributes,
  // Shared types
  SkillOwner,
  HistoryEntry,
  Source,
  ScopeDefinition,
  SourceCitation,
  SourceContradiction,
  // Input types
  CreateBlockInput,
  UpdateBlockInput,
  BlockQueryOptions,
} from './building-block';

export type {
  // Source types
  TypedStagedSource,
  UrlStagedSource,
  ZendeskStagedSource,
  SlackStagedSource,
  NotionStagedSource,
  GongStagedSource,
  DocumentStagedSource,
  SourceType,
  // Metadata types
  UrlSourceMetadata,
  ZendeskSourceMetadata,
  SlackSourceMetadata,
  NotionSourceMetadata,
  GongSourceMetadata,
  DocumentSourceMetadata,
  // Extraction types
  SourceExtraction,
  // Input types
  StageSourceInput,
  AssignSourceInput,
  SourceQueryOptions,
  // Adapter types
  DiscoveryAdapter,
  DiscoveryOptions,
  DiscoveredSource,
} from './staged-source';
