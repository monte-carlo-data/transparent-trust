/**
 * Centralized integration configuration
 * Maps library IDs to human-readable integration connection names
 * Used across all integration endpoints and adapters
 */

/**
 * Get the connection name for a given integration type and library
 * @param integrationType - The integration type (e.g., 'slack', 'zendesk', 'notion', 'gong')
 * @param libraryId - The library ID ('it', 'knowledge', 'gtm', or other)
 * @param customerId - Optional customer ID for customer-scoped connections
 * @returns The connection name to use in the database
 */
export function getIntegrationConnectionName(
  integrationType: string,
  libraryId: string,
  customerId?: string
): string {
  // For customer-scoped connections, use customer ID
  if (customerId) {
    return `Customer ${customerId} ${capitalize(integrationType)}`;
  }

  const libraryNames = getLibraryNames(integrationType);
  return libraryNames[libraryId] || `${libraryId} ${capitalize(integrationType)}`;
}

/**
 * Get all library name mappings for a given integration type
 * @param integrationType - The integration type (e.g., 'slack', 'zendesk')
 * @returns Record mapping library IDs to friendly names
 */
function getLibraryNames(integrationType: string): Record<string, string> {
  const configs: Record<string, Record<string, string>> = {
    slack: {
      'it': 'IT Support Slack',
      'knowledge': 'Knowledge Slack',
      'gtm': 'GTM Slack',
    },
    zendesk: {
      'it': 'IT Zendesk',
      'knowledge': 'Knowledge Zendesk',
      'gtm': 'GTM Zendesk',
    },
    notion: {
      'it': 'IT Notion Documentation',
      'knowledge': 'Knowledge Notion Documentation',
      'gtm': 'GTM Notion Documentation',
    },
    gong: {
      'it': 'IT Gong Integration',
      'knowledge': 'Knowledge Gong Integration',
      'gtm': 'GTM Gong Integration',
    },
  };

  return configs[integrationType] || {};
}

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
