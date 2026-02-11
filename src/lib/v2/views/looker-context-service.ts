/**
 * Looker Context Service
 *
 * Fetches Looker dashboard data for audit views (Coverage, Operations, Adoption).
 * Handles authentication, data fetching, and formatting for LLM context.
 */

import { LookerDiscoveryAdapter } from '@/lib/v2/sources/adapters/looker-adapter';
import type { DiscoveryOptions, LibraryId, LookerSourceMetadata } from '@/types/v2';
import { logger } from '@/lib/logger';

export interface LookerContextPreview {
  dashboardTitle: string;
  dashboardDescription?: string;
  tiles: Array<{
    title: string;
    queryResults: Record<string, unknown>[];
  }>;
  formattedHtml: string; // HTML tables for display
  rawJson: string; // JSON for LLM
}

/**
 * Audit types that require Looker dashboard data
 */
export type AuditType = 'coverage' | 'operations' | 'adoption';

/**
 * Map composition IDs to audit types for dashboard lookup
 */
const COMPOSITION_TO_AUDIT_TYPE: Record<string, AuditType> = {
  customer_coverage_audit: 'coverage',
  customer_operations_audit: 'operations',
  customer_adoption_audit: 'adoption',
};

/**
 * Check if a composition requires Looker data
 */
export function isAuditComposition(compositionId: string): boolean {
  return compositionId in COMPOSITION_TO_AUDIT_TYPE;
}

/**
 * Get audit type from composition ID
 */
export function getAuditTypeFromComposition(compositionId: string): AuditType | null {
  return COMPOSITION_TO_AUDIT_TYPE[compositionId] || null;
}

/**
 * Get Looker dashboard context for audit views
 *
 * @param libraryId - The library context (e.g., 'customers')
 * @param customerId - Optional customer ID for customer-scoped audits
 * @param auditType - Optional audit type to specify which dashboard to fetch
 *                    If not provided, defaults to 'operations' for backwards compatibility
 * @param teamId - Required team ID to load the correct Looker integration config
 */
export async function getLookerContextForAudit(
  libraryId: LibraryId,
  customerId?: string,
  auditType: AuditType = 'operations',
  teamId?: string
): Promise<LookerContextPreview | null> {
  try {
    const adapter = new LookerDiscoveryAdapter();

    // Use audit type as a sub-key for dashboard lookup
    // The libraryId combined with auditType forms the lookup key
    // e.g., 'customers:coverage', 'customers:operations', 'customers:adoption'
    const dashboardKey = `${libraryId}:${auditType}`;

    const options: DiscoveryOptions = {
      libraryId: dashboardKey as LibraryId, // Use combined key for dashboard lookup
      ...(customerId && { customerId }),
      ...(teamId && { teamId }),
      limit: 1,
    };

    // Discover (fetch) the dashboard
    const discovered = await adapter.discover(options);
    if (discovered.length === 0) {
      logger.warn('No Looker dashboard discovered', { libraryId, customerId, auditType, dashboardKey });
      return null;
    }

    const source = discovered[0];
    const metadata = source.metadata as LookerSourceMetadata;

    // Parse dashboard data from content
    let dashboardData;
    try {
      dashboardData = JSON.parse(source.content || '{}');
    } catch (parseError) {
      logger.error('Failed to parse Looker dashboard content', {
        libraryId,
        customerId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return null;
    }

    // Build formatted HTML tables from query results
    const htmlTables: string[] = [];
    const tiles = (dashboardData.queryResults || []).map(
      (result: { tileTitle: string; results: Record<string, unknown>[] }) => {
        const html = buildHtmlTable(result.tileTitle, result.results);
        if (html) htmlTables.push(html);
        return {
          title: result.tileTitle,
          queryResults: result.results,
        };
      }
    );

    return {
      dashboardTitle: metadata.dashboardTitle,
      dashboardDescription: metadata.dashboardDescription,
      tiles,
      formattedHtml: htmlTables.join('\n'),
      rawJson: source.content || '{}',
    };
  } catch (error) {
    logger.error('Failed to get Looker context for audit', { libraryId, customerId, error });
    throw error;
  }
}

/**
 * Build HTML table from query results for display
 */
function buildHtmlTable(title: string, results: Record<string, unknown>[]): string {
  if (!results || results.length === 0) {
    return `<h3>${escapeHtml(title)}</h3>\n<p>No data available</p>`;
  }

  // Get column headers from first result
  const headers = Object.keys(results[0]);
  if (headers.length === 0) {
    return `<h3>${escapeHtml(title)}</h3>\n<p>No columns found</p>`;
  }

  // Build HTML table
  let html = `<h3>${escapeHtml(title)}</h3>\n<table border="1" cellpadding="4">\n<thead>\n<tr>`;

  // Add headers
  for (const header of headers) {
    html += `<th>${escapeHtml(header)}</th>`;
  }
  html += `</tr>\n</thead>\n<tbody>\n`;

  // Add rows (limit to 20 for display)
  const rowsToShow = Math.min(results.length, 20);
  for (let i = 0; i < rowsToShow; i++) {
    const row = results[i];
    html += `<tr>`;
    for (const header of headers) {
      const value = row[header];
      const displayValue = formatValue(value);
      html += `<td>${escapeHtml(displayValue)}</td>`;
    }
    html += `</tr>\n`;
  }

  if (results.length > 20) {
    html += `<tr><td colspan="${headers.length}" style="text-align: center; font-style: italic;">... and ${results.length - 20} more rows</td></tr>\n`;
  }

  html += `</tbody>\n</table>`;
  return html;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
