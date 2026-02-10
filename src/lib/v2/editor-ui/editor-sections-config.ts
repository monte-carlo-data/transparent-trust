/**
 * Editor sections configuration
 *
 * Defines which sections appear in the skill editor for each library.
 * Controls visibility, ordering, and section-specific settings.
 */

import type { LibraryId } from '@/types/v2/building-block';

export interface EditorSectionConfig {
  key: string;
  label: string;
  order: number;
  /** Whether this section is visible for the given library */
  visible?: boolean;
  /** Description or hint text for the section */
  hint?: string;
}

/**
 * Define editor sections per library
 * Order matters - sections render in order
 */
export const EDITOR_SECTIONS_CONFIG: Record<LibraryId, EditorSectionConfig[]> = {
  knowledge: [
    { key: 'basic', label: 'Basic Info', order: 1 },
    { key: 'categories', label: 'Categories', order: 2 },
    { key: 'attributes', label: 'Attributes', order: 3 },
    { key: 'scope', label: 'Scope Definition', order: 4 },
  ],
  it: [
    { key: 'basic', label: 'Basic Info', order: 1 },
    { key: 'categories', label: 'Categories', order: 2 },
    { key: 'attributes', label: 'Attributes', order: 3 },
    { key: 'scope', label: 'Scope Definition', order: 4 },
  ],
  gtm: [
    { key: 'basic', label: 'Basic Info', order: 1 },
    { key: 'categories', label: 'Categories', order: 2 },
    { key: 'attributes', label: 'Attributes', order: 3 },
    { key: 'scope', label: 'Scope Definition', order: 4 },
  ],
  talent: [
    { key: 'basic', label: 'Basic Info', order: 1 },
    { key: 'categories', label: 'Categories', order: 2 },
    { key: 'attributes', label: 'Attributes', order: 3 },
    { key: 'scope', label: 'Scope Definition', order: 4 },
  ],
  customers: [
    { key: 'basic', label: 'Basic Info', order: 1 },
    { key: 'categories', label: 'Categories', order: 2 },
    { key: 'attributes', label: 'Attributes', order: 3 },
    { key: 'scope', label: 'Scope Definition', order: 4 },
  ],
  // Non-skill libraries don't use the editor
  prompts: [],
  personas: [],
  templates: [],
  views: [],
};

/**
 * Get visible sections for a library
 */
export function getVisibleEditorSections(libraryId: LibraryId): EditorSectionConfig[] {
  return (EDITOR_SECTIONS_CONFIG[libraryId] || [])
    .filter((section) => section.visible !== false)
    .sort((a, b) => a.order - b.order);
}

/**
 * Attribute fields configuration per library
 * Defines which attributes are editable and how they're rendered
 */
export interface AttributeFieldConfig {
  key: string;
  label: string;
  type: 'checkboxes' | 'user-picker' | 'text' | 'tags';
  options?: string[];
  hint?: string;
}

export const ATTRIBUTE_FIELDS_CONFIG: Record<LibraryId, AttributeFieldConfig[]> = {
  knowledge: [
    {
      key: 'exposedTo',
      label: 'Exposed To',
      type: 'checkboxes',
      options: ['slackbot', 'chat', 'rfp'],
      hint: 'Which interfaces should this skill be exposed to?',
    },
    { key: 'owners', label: 'Owners/SMEs', type: 'user-picker', hint: 'Who are the subject matter experts?' },
  ],
  it: [
    {
      key: 'exposedTo',
      label: 'Exposed To',
      type: 'checkboxes',
      options: ['slackbot', 'chat', 'rfp'],
    },
    { key: 'owners', label: 'Owners/SMEs', type: 'user-picker' },
  ],
  gtm: [
    {
      key: 'exposedTo',
      label: 'Exposed To',
      type: 'checkboxes',
      options: ['slackbot', 'chat', 'rfp'],
    },
    { key: 'owners', label: 'Owners/SMEs', type: 'user-picker' },
  ],
  talent: [
    {
      key: 'exposedTo',
      label: 'Exposed To',
      type: 'checkboxes',
      options: ['slackbot', 'chat', 'rfp'],
    },
    { key: 'owners', label: 'Owners/SMEs', type: 'user-picker' },
  ],
  customers: [
    {
      key: 'exposedTo',
      label: 'Exposed To',
      type: 'checkboxes',
      options: ['slackbot', 'chat', 'rfp'],
    },
    { key: 'owners', label: 'Owners/SMEs', type: 'user-picker' },
  ],
  prompts: [],
  personas: [],
  templates: [],
  views: [],
};

export function getAttributeFields(libraryId: LibraryId): AttributeFieldConfig[] {
  return ATTRIBUTE_FIELDS_CONFIG[libraryId] || [];
}
