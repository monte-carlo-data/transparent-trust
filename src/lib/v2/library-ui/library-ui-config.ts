/**
 * Library UI Configuration
 *
 * Centralized configuration for metadata bars and sidebars per library.
 */

import type { LibraryMetadataConfig, LibrarySidebarConfig } from './types';
import type { LibraryId, CustomerProfileAttributes } from '@/types/v2';
import {
  textFieldRenderer,
  healthScoreRenderer,
} from './field-renderers';
import {
  scopeSection,
  incorporatedSourcesSection,
  relatedSkillsSection,
  citationsSection,
  contradictionsSection,
} from './section-composers';

// =============================================================================
// METADATA BAR CONFIGURATIONS
// =============================================================================

export const METADATA_CONFIGS: Record<LibraryId, LibraryMetadataConfig> = {
  // Knowledge has no metadata bar fields
  knowledge: {
    libraryId: 'knowledge',
    fields: [],
  },

  // IT Library: No custom metadata fields
  it: {
    libraryId: 'it',
    fields: [],
  },

  // GTM Library: No custom metadata fields
  gtm: {
    libraryId: 'gtm',
    fields: [],
  },

  // Talent Library: No custom metadata fields
  talent: {
    libraryId: 'talent',
    fields: [],
  },

  // Customers Library: Health Score, Tier, Industry
  customers: {
    libraryId: 'customers',
    fields: [
      {
        key: 'healthScore',
        label: 'Health Score',
        description: 'Overall health',
        renderer: healthScoreRenderer,
        getValue: (block) => {
          if (block.libraryId !== 'customers') return undefined;
          const attrs = block.attributes as CustomerProfileAttributes;
          return attrs?.healthScore;
        },
        visible: (block) => {
          if (block.libraryId !== 'customers') return false;
          const attrs = block.attributes as CustomerProfileAttributes;
          return attrs?.healthScore !== undefined;
        },
        order: 1,
      },
      {
        key: 'tier',
        label: 'Tier',
        description: 'Account tier',
        renderer: textFieldRenderer,
        getValue: (block) => {
          if (block.libraryId !== 'customers') return undefined;
          const attrs = block.attributes as CustomerProfileAttributes;
          return attrs?.tier;
        },
        visible: (block) => {
          if (block.libraryId !== 'customers') return false;
          const attrs = block.attributes as CustomerProfileAttributes;
          return !!attrs?.tier;
        },
        order: 2,
      },
      {
        key: 'industry',
        label: 'Industry',
        description: 'Sector',
        renderer: textFieldRenderer,
        getValue: (block) => {
          if (block.libraryId !== 'customers') return undefined;
          const attrs = block.attributes as CustomerProfileAttributes;
          return attrs?.industry;
        },
        visible: (block) => {
          if (block.libraryId !== 'customers') return false;
          const attrs = block.attributes as CustomerProfileAttributes;
          return !!attrs?.industry;
        },
        order: 3,
      },
    ],
  },

  // Other libraries (no metadata bars)
  prompts: { libraryId: 'prompts', fields: [] },
  personas: { libraryId: 'personas', fields: [] },
  templates: { libraryId: 'templates', fields: [] },
  views: { libraryId: 'views', fields: [] },
};

// =============================================================================
// SIDEBAR CONFIGURATIONS
// =============================================================================

export const SIDEBAR_CONFIGS: Record<LibraryId, LibrarySidebarConfig> = {
  // Knowledge Library Sidebar
  knowledge: {
    libraryId: 'knowledge',
    sections: [
      { key: 'scope', component: scopeSection, order: 1 },
      { key: 'incorporated', component: incorporatedSourcesSection, order: 2 },
      { key: 'related', component: relatedSkillsSection, order: 3 },
      { key: 'citations', component: citationsSection, order: 4 },
      { key: 'contradictions', component: contradictionsSection, order: 5 },
    ],
  },

  // IT Library Sidebar
  it: {
    libraryId: 'it',
    sections: [
      { key: 'scope', component: scopeSection, order: 1 },
      { key: 'incorporated', component: incorporatedSourcesSection, order: 2 },
      { key: 'related', component: relatedSkillsSection, order: 3 },
    ],
  },

  // GTM Library Sidebar
  gtm: {
    libraryId: 'gtm',
    sections: [
      { key: 'scope', component: scopeSection, order: 1 },
      { key: 'incorporated', component: incorporatedSourcesSection, order: 2 },
      { key: 'related', component: relatedSkillsSection, order: 3 },
    ],
  },

  // Talent Library Sidebar
  talent: {
    libraryId: 'talent',
    sections: [
      { key: 'scope', component: scopeSection, order: 1 },
      { key: 'incorporated', component: incorporatedSourcesSection, order: 2 },
      { key: 'related', component: relatedSkillsSection, order: 3 },
    ],
  },

  // Customers Library Sidebar
  customers: {
    libraryId: 'customers',
    sections: [
      { key: 'scope', component: scopeSection, order: 1 },
      { key: 'incorporated', component: incorporatedSourcesSection, order: 2 },
      { key: 'related', component: relatedSkillsSection, order: 3 },
    ],
  },

  // Other libraries (minimal sidebars)
  prompts: { libraryId: 'prompts', sections: [] },
  personas: { libraryId: 'personas', sections: [] },
  templates: { libraryId: 'templates', sections: [] },
  views: { libraryId: 'views', sections: [] },
};

// =============================================================================
// ACCESSOR FUNCTIONS
// =============================================================================

export function getMetadataConfig(libraryId: LibraryId): LibraryMetadataConfig {
  return METADATA_CONFIGS[libraryId];
}

export function getSidebarConfig(libraryId: LibraryId): LibrarySidebarConfig {
  return SIDEBAR_CONFIGS[libraryId];
}
