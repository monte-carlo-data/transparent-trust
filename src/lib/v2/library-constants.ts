/**
 * Centralized library ID constants
 *
 * Use these instead of hardcoding library arrays throughout the codebase.
 * This ensures consistency and makes updates in one place.
 */

import type { LibraryId } from '@/types/v2';

/**
 * All skill-based libraries (knowledge, it, gtm, talent, customers)
 * These are libraries where you can create and manage skills/content.
 */
export const SKILL_LIBRARIES: LibraryId[] = ['knowledge', 'it', 'gtm', 'talent', 'customers'];

/**
 * Global skill libraries (excludes customer-scoped)
 * Used when filtering for global content.
 */
export const GLOBAL_SKILL_LIBRARIES: LibraryId[] = ['knowledge', 'it', 'gtm', 'talent'];

/**
 * Libraries that support integrations (Slack, Gong, Zendesk, etc.)
 * These are libraries where you can stage and ingest source content.
 */
export const INTEGRATION_SUPPORTED_LIBRARIES: LibraryId[] = ['knowledge', 'it', 'gtm', 'talent', 'customers'];

/**
 * Libraries that support Slack bot responses
 */
export const SLACK_BOT_LIBRARIES: LibraryId[] = ['knowledge', 'it', 'gtm', 'talent'];

/**
 * All libraries available in the system
 */
export const ALL_LIBRARIES: LibraryId[] = [
  'knowledge',
  'it',
  'gtm',
  'talent',
  'customers',
  'prompts',
  'personas',
  'templates',
];

/**
 * Library UI configuration for admin pages
 * Used in: teams settings, access matrix, library listings
 */
export const LIBRARY_UI_CONFIG: Array<{
  id: LibraryId;
  label: string;
  name: string;
  description: string;
}> = [
  { id: 'knowledge', label: 'Knowledge', name: 'Knowledge', description: 'Internal knowledge base' },
  { id: 'it', label: 'IT', name: 'IT', description: 'IT helpdesk knowledge' },
  { id: 'gtm', label: 'GTM / Customers', name: 'GTM', description: 'Customer profiles & GTM' },
  { id: 'talent', label: 'Talent', name: 'Talent', description: 'Recruiting & hiring knowledge' },
  { id: 'prompts', label: 'Prompts', name: 'Prompts', description: 'System prompts' },
  { id: 'personas', label: 'Personas', name: 'Personas', description: 'Communication personas' },
  { id: 'templates', label: 'Templates', name: 'Templates', description: 'Output templates' },
];
