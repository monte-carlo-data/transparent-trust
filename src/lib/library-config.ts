/**
 * Centralized library configuration
 *
 * Defines per-library settings including:
 * - Supported source types and labels
 * - Source type filtering and display
 * - Library-specific metadata fields
 * - UI customizations per library
 */

import type { LibraryId } from '@/types/v2/building-block';
import { SOURCE_TYPES } from '@/types/v2/staged-source';

export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Configuration for how a source type is rendered in a library's tab UI
 */
export interface SourceTabConfig {
  /** Source type identifier */
  type: SourceType;
  /** Tab label */
  label: string;
  /** Empty state title when no sources */
  emptyTitle: string;
  /** Empty state description */
  emptyDescription: string;
  /** Show the "Stage" button (for URLs, documents) */
  showStageButton: boolean;
  /** Use UnifiedSourceWizard (should always be true) */
  useWizard: boolean;
}

export interface LibraryConfig {
  id: LibraryId;
  name: string;
  description: string;
  sourceTypes: SourceType[];
  sourceTypeLabel: string;
  generatingLabel: string;
  pluralName: string;
  /** Singular name for items (e.g., "Skill", "GTM Skill") */
  itemName: string;
  /** Singular name lowercase for modals (e.g., "skill", "GTM skill") */
  singularName: string;
  addButtonLabel: string;
  emptyStateTitle: string;
  emptyStateMessage: string;
  /** Metadata field names specific to this library */
  metadataFields?: string[];
  /** Color accent for UI elements */
  accentColor: 'blue' | 'purple' | 'green' | 'amber';
  /** Whether this library's skills require scope definitions */
  requiresScopeDefinition?: boolean;
  /** Whether this library supports the global flag (for customer-scoped skills) */
  allowsGlobalFlag?: boolean;
  /** Default attributes for new skills in this library */
  getDefaultAttributes?: () => Record<string, unknown>;
  /** Base path for this library (e.g., '/v2/knowledge') */
  basePath: string;
  /** Initial tab to show when loading the library */
  initialTab: 'dashboard' | 'items';
  /** Whether Bot Q&A tab is shown */
  showBotTab: boolean;
  /** Whether Test Q&A tab is shown */
  showQATab: boolean;
  /** Per-source-type tab configurations */
  sourceTabs: SourceTabConfig[];
  /** Icon identifier for this library (e.g., 'book-open', 'wrench') */
  iconId: string;
  /** Background color class for the icon */
  iconBgColor: string;
  /** Label for the back button on detail pages */
  backLabel: string;
  /** Main content section heading (e.g., "Content", "Resolution Steps") */
  mainContentHeading: string;
  /** Example titles for the creation modal placeholder */
  placeholderExamples?: string[];
}

const sourceTypeLabels: Record<SourceType, { label: string; color: string }> = {
  zendesk: { label: 'Zendesk', color: 'bg-blue-100 text-blue-700' },
  slack: { label: 'Slack', color: 'bg-purple-100 text-purple-700' },
  notion: { label: 'Notion', color: 'bg-gray-100 text-gray-700' },
  gong: { label: 'Gong', color: 'bg-orange-100 text-orange-700' },
  url: { label: 'URL', color: 'bg-green-100 text-green-700' },
  document: { label: 'Document', color: 'bg-yellow-100 text-yellow-700' },
  looker: { label: 'Looker', color: 'bg-indigo-100 text-indigo-700' },
};

const libraryConfigs: Record<LibraryId, LibraryConfig> = {
  knowledge: {
    id: 'knowledge',
    name: 'Skills Library',
    description: 'General knowledge and skills library',
    sourceTypes: ['url', 'document', 'slack', 'notion'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Generating skill content',
    pluralName: 'skills',
    itemName: 'Skill',
    singularName: 'skill',
    addButtonLabel: 'New Skill',
    emptyStateTitle: 'No skills found',
    emptyStateMessage: 'Add your first skill to get started.',
    metadataFields: ['product', 'department'],
    accentColor: 'blue',
    basePath: '/v2/knowledge',
    initialTab: 'dashboard',
    showBotTab: true,
    showQATab: true,
    requiresScopeDefinition: true,
    getDefaultAttributes: () => ({
      scopeDefinition: {
        covers: '[Describe what this skill currently covers - be specific about the scope]',
        futureAdditions: [
          '[Type of content to add later - one item per line]',
          '[Another planned addition]',
        ],
        notIncluded: ['[What should explicitly NOT be included - helps prevent scope creep]'],
      },
    }),
    iconId: 'book-open',
    iconBgColor: 'bg-blue-100',
    backLabel: 'Back to Skills',
    mainContentHeading: 'Content',
    sourceTabs: [
      {
        type: 'url',
        label: 'URLs',
        emptyTitle: 'No URLs staged',
        emptyDescription: 'Add URLs to discover and stage content for skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'document',
        label: 'Documents',
        emptyTitle: 'No documents staged',
        emptyDescription: 'Upload documents to discover and stage content for skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'slack',
        label: 'Slack',
        emptyTitle: 'No Slack threads awaiting review',
        emptyDescription: 'Stage Slack threads to generate and create skills.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'notion',
        label: 'Notion',
        emptyTitle: 'No Notion pages awaiting review',
        emptyDescription: 'Stage Notion pages to generate and create skills from documentation.',
        showStageButton: false,
        useWizard: true,
      },
    ],
  },
  it: {
    id: 'it',
    name: 'IT Skills Library',
    description: 'IT operations and support knowledge',
    sourceTypes: ['url', 'zendesk', 'slack', 'notion'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Generating IT skill content',
    pluralName: 'IT skills',
    itemName: 'IT Skill',
    singularName: 'IT skill',
    addButtonLabel: 'New IT Skill',
    emptyStateTitle: 'No IT skills found',
    emptyStateMessage: 'Add your first IT skill to get started.',
    metadataFields: [],
    accentColor: 'amber',
    basePath: '/v2/it',
    initialTab: 'dashboard',
    showBotTab: true,
    showQATab: true,
    requiresScopeDefinition: true,
    getDefaultAttributes: () => ({
      scopeDefinition: {
        covers: '[Describe what this IT skill currently covers]',
        futureAdditions: [
          '[Type of content to add later - one item per line]',
          '[Another planned addition]',
        ],
        notIncluded: ['[What should explicitly NOT be included]'],
      },
    }),
    iconId: 'wrench',
    iconBgColor: 'bg-orange-100',
    backLabel: 'Back to IT Skills',
    mainContentHeading: 'Resolution Steps',
    sourceTabs: [
      {
        type: 'url',
        label: 'URLs',
        emptyTitle: 'No URLs staged',
        emptyDescription: 'Add URLs to discover and stage content for IT skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'zendesk',
        label: 'Zendesk',
        emptyTitle: 'No Zendesk tickets awaiting review',
        emptyDescription: 'Stage Zendesk tickets to generate and create IT skills from support conversations.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'slack',
        label: 'Slack',
        emptyTitle: 'No Slack threads awaiting review',
        emptyDescription: 'Stage Slack threads to generate and create IT skills from team conversations.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'notion',
        label: 'Notion',
        emptyTitle: 'No Notion pages awaiting review',
        emptyDescription: 'Stage Notion pages to generate and create IT skills from documentation.',
        showStageButton: false,
        useWizard: true,
      },
    ],
  },
  gtm: {
    id: 'gtm',
    name: 'GTM Skills Library',
    description: 'Sales and marketing knowledge (pricing, forecasting, market strategies)',
    sourceTypes: ['url', 'document', 'gong', 'slack', 'zendesk'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Generating GTM skill content',
    pluralName: 'GTM skills',
    itemName: 'GTM Skill',
    singularName: 'GTM skill',
    addButtonLabel: 'New GTM Skill',
    emptyStateTitle: 'No GTM skills found',
    emptyStateMessage: 'Add your first GTM skill to get started.',
    metadataFields: [],
    accentColor: 'green',
    basePath: '/v2/gtm',
    initialTab: 'dashboard',
    showBotTab: true,
    showQATab: true,
    requiresScopeDefinition: true,
    getDefaultAttributes: () => ({
      scopeDefinition: {
        covers: '[Describe what this GTM skill currently covers]',
        futureAdditions: [
          '[Type of content to add later - one item per line]',
          '[Another planned addition]',
        ],
        notIncluded: ['[What should explicitly NOT be included]'],
      },
    }),
    iconId: 'target',
    iconBgColor: 'bg-green-100',
    backLabel: 'Back to GTM Skills',
    mainContentHeading: 'Content',
    sourceTabs: [
      {
        type: 'url',
        label: 'URLs',
        emptyTitle: 'No URLs staged',
        emptyDescription: 'Add URLs to discover and stage content for GTM skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'document',
        label: 'Documents',
        emptyTitle: 'No documents awaiting review',
        emptyDescription: 'Stage documents to generate and create GTM skills from knowledge bases.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'gong',
        label: 'Gong',
        emptyTitle: 'No Gong calls awaiting review',
        emptyDescription: 'Stage Gong calls to generate and create GTM skills from sales conversations.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'slack',
        label: 'Slack',
        emptyTitle: 'No Slack threads awaiting review',
        emptyDescription: 'Stage Slack threads to generate and create GTM skills from team conversations.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'zendesk',
        label: 'Zendesk',
        emptyTitle: 'No Zendesk tickets awaiting review',
        emptyDescription: 'Stage Zendesk tickets to generate and create GTM skills from customer support conversations.',
        showStageButton: false,
        useWizard: true,
      },
    ],
  },
  talent: {
    id: 'talent',
    name: 'Talent Acquisition Library',
    description: 'Recruiting, hiring, and talent management knowledge',
    sourceTypes: ['url', 'document', 'slack', 'notion'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Generating talent skill content',
    pluralName: 'talent skills',
    itemName: 'Talent Skill',
    singularName: 'talent skill',
    addButtonLabel: 'New Talent Skill',
    emptyStateTitle: 'No talent skills found',
    emptyStateMessage: 'Add your first talent skill to get started.',
    metadataFields: [],
    accentColor: 'purple',
    basePath: '/v2/talent',
    initialTab: 'dashboard',
    showBotTab: true,
    showQATab: true,
    requiresScopeDefinition: true,
    getDefaultAttributes: () => ({
      scopeDefinition: {
        covers: '[Describe what this talent skill currently covers]',
        futureAdditions: [
          '[Type of content to add later - one item per line]',
          '[Another planned addition]',
        ],
        notIncluded: ['[What should explicitly NOT be included]'],
      },
    }),
    iconId: 'users',
    iconBgColor: 'bg-purple-100',
    backLabel: 'Back to Talent Skills',
    mainContentHeading: 'Content',
    sourceTabs: [
      {
        type: 'url',
        label: 'URLs',
        emptyTitle: 'No URLs staged',
        emptyDescription: 'Add URLs to discover and stage content for talent skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'document',
        label: 'Documents',
        emptyTitle: 'No documents staged',
        emptyDescription: 'Upload documents to discover and stage content for talent skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'slack',
        label: 'Slack',
        emptyTitle: 'No Slack threads awaiting review',
        emptyDescription: 'Stage Slack threads to generate and create talent skills from team conversations.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'notion',
        label: 'Notion',
        emptyTitle: 'No Notion pages awaiting review',
        emptyDescription: 'Stage Notion pages to generate and create talent skills from documentation.',
        showStageButton: false,
        useWizard: true,
      },
    ],
  },
  customers: {
    id: 'customers',
    name: 'Customer Knowledge Base',
    description: 'Customer-specific skills and intelligence',
    sourceTypes: ['url', 'document', 'gong', 'slack'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Generating customer skill',
    pluralName: 'skills',
    itemName: 'Skill',
    singularName: 'customer skill',
    addButtonLabel: 'Add Skill',
    emptyStateTitle: 'No skills yet',
    emptyStateMessage: 'Create skills from staged sources to build this customer\'s knowledge base.',
    metadataFields: [], // Customer skills use same attributes as other libraries (scopeDefinition, etc.)
    accentColor: 'amber',
    basePath: '/v2/customers',
    initialTab: 'dashboard',
    showBotTab: false,
    showQATab: false,
    requiresScopeDefinition: true,
    allowsGlobalFlag: true,
    getDefaultAttributes: () => ({
      scopeDefinition: {
        covers: '[Describe what this customer skill currently covers]',
        futureAdditions: [
          '[Type of content to add later - one item per line]',
          '[Another planned addition]',
        ],
        notIncluded: ['[What should explicitly NOT be included]'],
      },
    }),
    iconId: 'building',
    iconBgColor: 'bg-amber-100',
    backLabel: 'Back to Customer Profile',
    mainContentHeading: 'Content',
    sourceTabs: [
      {
        type: 'url',
        label: 'URLs',
        emptyTitle: 'No URLs staged',
        emptyDescription: 'Add URLs to discover and stage content for skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'document',
        label: 'Documents',
        emptyTitle: 'No documents staged',
        emptyDescription: 'Upload documents to discover and stage content for skill creation.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'slack',
        label: 'Slack',
        emptyTitle: 'No Slack threads awaiting review',
        emptyDescription: 'Stage Slack threads to generate and create skills from customer conversations.',
        showStageButton: false,
        useWizard: true,
      },
      {
        type: 'gong',
        label: 'Gong',
        emptyTitle: 'No Gong calls awaiting review',
        emptyDescription: 'Stage Gong calls to generate and create skills from customer conversations.',
        showStageButton: false,
        useWizard: true,
      },
    ],
  },
  prompts: {
    id: 'prompts',
    name: 'Prompts Library',
    description: 'AI prompt templates and examples',
    sourceTypes: ['url', 'document', 'slack'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Creating prompt template',
    pluralName: 'prompts',
    itemName: 'Prompt',
    singularName: 'prompt',
    addButtonLabel: 'Add Prompt',
    emptyStateTitle: 'No prompts found',
    emptyStateMessage: 'Add your first prompt template to get started.',
    metadataFields: ['domain', 'useCase', 'complexity'],
    accentColor: 'blue',
    basePath: '/v2/prompts',
    initialTab: 'items',
    showBotTab: false,
    showQATab: false,
    iconId: 'code',
    iconBgColor: 'bg-blue-100',
    backLabel: 'Back to Prompts',
    mainContentHeading: 'Prompt',
    sourceTabs: [],
  },
  personas: {
    id: 'personas',
    name: 'Personas Library',
    description: 'AI personas and role definitions',
    sourceTypes: ['url', 'document', 'slack'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Creating persona',
    pluralName: 'personas',
    itemName: 'Persona',
    singularName: 'persona',
    addButtonLabel: 'Add Persona',
    emptyStateTitle: 'No personas found',
    emptyStateMessage: 'Add your first persona to get started.',
    metadataFields: ['tone', 'audience', 'expertise'],
    accentColor: 'purple',
    basePath: '/v2/personas',
    initialTab: 'items',
    showBotTab: false,
    showQATab: false,
    iconId: 'zap',
    iconBgColor: 'bg-purple-100',
    backLabel: 'Back to Personas',
    mainContentHeading: 'Persona Definition',
    sourceTabs: [],
  },
  templates: {
    id: 'templates',
    name: 'Templates Library',
    description: 'Document and content templates',
    sourceTypes: ['url', 'document'],
    sourceTypeLabel: 'Sources',
    generatingLabel: 'Creating template',
    pluralName: 'templates',
    itemName: 'Template',
    singularName: 'template',
    addButtonLabel: 'Add Template',
    emptyStateTitle: 'No templates found',
    emptyStateMessage: 'Add your first template to get started.',
    metadataFields: ['format', 'useCase', 'sections'],
    accentColor: 'green',
    basePath: '/v2/templates',
    initialTab: 'items',
    showBotTab: false,
    showQATab: false,
    iconId: 'file-text',
    iconBgColor: 'bg-green-100',
    backLabel: 'Back to Templates',
    mainContentHeading: 'Template',
    sourceTabs: [],
  },
  views: {
    id: 'views',
    name: 'Analysis Views',
    description: 'Customer analysis views for insights and forecasting',
    sourceTypes: [],
    sourceTypeLabel: 'Composition',
    generatingLabel: 'Generating analysis',
    pluralName: 'analysis views',
    itemName: 'View',
    singularName: 'view',
    addButtonLabel: 'Add View',
    emptyStateTitle: 'No analysis views found',
    emptyStateMessage: 'Create your first analysis view definition to get started.',
    metadataFields: ['compositionId', 'displayOrder', 'icon'],
    accentColor: 'purple',
    basePath: '/v2/admin/views',
    initialTab: 'items',
    showBotTab: false,
    showQATab: false,
    iconId: 'eye',
    iconBgColor: 'bg-purple-100',
    backLabel: 'Back to Views',
    mainContentHeading: 'View Definition',
    sourceTabs: [],
  },
};

/**
 * Get configuration for a specific library
 */
export function getLibraryConfig(libraryId: LibraryId): LibraryConfig {
  const config = libraryConfigs[libraryId];
  if (!config) {
    throw new Error(`Unknown library: ${libraryId}`);
  }
  return config;
}

/**
 * Get label for a source type
 */
export function getSourceTypeLabel(sourceType: SourceType): string {
  return sourceTypeLabels[sourceType]?.label || sourceType;
}

/**
 * Get color classes for a source type
 */
export function getSourceTypeColor(sourceType: SourceType): string {
  return sourceTypeLabels[sourceType]?.color || 'bg-gray-100 text-gray-700';
}

/**
 * Get all source type configurations
 */
export function getSourceTypeConfigs(): Record<SourceType, { label: string; color: string }> {
  return sourceTypeLabels;
}

/**
 * Filter source types for a specific library
 */
export function getEnabledSourceTypes(libraryId: LibraryId): SourceType[] {
  const config = getLibraryConfig(libraryId);
  return config.sourceTypes;
}

/**
 * Check if a source type is enabled for a library
 */
export function isSourceTypeEnabled(libraryId: LibraryId, sourceType: SourceType): boolean {
  const enabledTypes = getEnabledSourceTypes(libraryId);
  return enabledTypes.includes(sourceType);
}

/**
 * Get default metadata fields for a library
 */
export function getMetadataFields(libraryId: LibraryId): string[] {
  const config = getLibraryConfig(libraryId);
  return config.metadataFields || [];
}

/**
 * Get all available libraries
 */
export function getAllLibraries(): LibraryConfig[] {
  return Object.values(libraryConfigs);
}

/**
 * Get library options for dropdown, including blockType mapping
 */
export function getLibraryOptionsForDropdown(): Array<{ id: LibraryId; label: string; blockType: string }> {
  return Object.values(libraryConfigs).map((config) => ({
    id: config.id,
    label: config.name,
    blockType: config.id === 'personas' ? 'persona' : config.id === 'templates' ? 'template' : 'knowledge',
  }));
}

/**
 * Get library accent color
 */
export function getLibraryAccentColor(libraryId: LibraryId): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 text-white hover:bg-blue-700',
    purple: 'bg-purple-600 text-white hover:bg-purple-700',
    green: 'bg-green-600 text-white hover:bg-green-700',
    amber: 'bg-amber-600 text-white hover:bg-amber-700',
  };
  const config = getLibraryConfig(libraryId);
  return colorMap[config.accentColor];
}

/**
 * Map icon IDs to their color classes for detail pages
 */
export function getIconColorClass(iconId: string): string {
  const iconColorMap: Record<string, string> = {
    'book-open': 'text-blue-600',
    wrench: 'text-orange-600',
    target: 'text-green-600',
    users: 'text-purple-600',
    building: 'text-amber-600',
    code: 'text-blue-600',
    zap: 'text-purple-600',
    'file-text': 'text-green-600',
    eye: 'text-purple-600',
  };
  return iconColorMap[iconId] || 'text-gray-600';
}
