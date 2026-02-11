/**
 * Audit Log Service
 *
 * Provides centralized audit logging for all skill operations.
 * Tracks: creation, updates, deletions, owner changes, tier changes, etc.
 * Stores audit trails in the BuildingBlock.attributes.auditLog field
 */

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'published'
  | 'archived'
  | 'refreshed'
  | 'owner_added'
  | 'owner_removed'
  | 'category_added'
  | 'category_removed'
  | 'tier_changed'
  | 'synced'
  | 'sync_failed';

export interface AuditLogEntry {
  date: string; // ISO timestamp
  action: AuditAction;
  summary: string; // Human-readable description
  userId?: string; // Who made the change
  userName?: string; // User's name for display
  userEmail?: string; // User's email
  details?: Record<string, unknown>; // Additional context
}

export interface AuditLog {
  entries: AuditLogEntry[];
}

/**
 * Create a new audit log entry
 */
export function createAuditEntry(
  action: AuditAction,
  summary: string,
  userId?: string,
  userName?: string,
  userEmail?: string,
  details?: Record<string, unknown>
): AuditLogEntry {
  return {
    date: new Date().toISOString(),
    action,
    summary,
    userId,
    userName,
    userEmail,
    details,
  };
}

/**
 * Add an entry to the audit log
 */
export function addAuditEntry(
  auditLog: AuditLog | undefined,
  entry: AuditLogEntry
): AuditLog {
  const log = auditLog || { entries: [] };
  return {
    entries: [entry, ...(log.entries || [])], // Most recent first
  };
}

/**
 * Get audit log from attributes
 */
export function getAuditLog(attributes: unknown): AuditLog {
  if (!attributes || typeof attributes !== 'object') {
    return { entries: [] };
  }

  const attrs = attributes as Record<string, unknown>;
  const log = attrs.auditLog;

  if (!log || typeof log !== 'object') {
    return { entries: [] };
  }

  const logObj = log as Record<string, unknown>;
  const entries = logObj.entries;

  if (!Array.isArray(entries)) {
    return { entries: [] };
  }

  return {
    entries: entries.filter((e) => {
      if (typeof e !== 'object' || !e) return false;
      const entry = e as Record<string, unknown>;
      return (
        typeof entry.date === 'string' &&
        typeof entry.action === 'string' &&
        typeof entry.summary === 'string'
      );
    }) as AuditLogEntry[],
  };
}

/**
 * Set audit log in attributes
 */
export function setAuditLog(
  attributes: Record<string, unknown>,
  auditLog: AuditLog
): Record<string, unknown> {
  return {
    ...attributes,
    auditLog,
  };
}

/**
 * Create audit entries for common skill operations
 */
export const auditMessages = {
  skillCreated: (title: string) => `Created skill "${title}"`,
  skillUpdated: (title: string, changes: string[]) =>
    `Updated skill "${title}": ${changes.join(', ')}`,
  contentEdited: (title: string) => `Edited content of "${title}"`,
  tierChanged: (oldTier: string, newTier: string) =>
    `Changed tier from ${oldTier} to ${newTier}`,
  categoryAdded: (category: string) => `Added to category "${category}"`,
  categoryRemoved: (category: string) => `Removed from category "${category}"`,
  ownerAdded: (ownerName: string) => `Added owner: ${ownerName}`,
  ownerRemoved: (ownerName: string) => `Removed owner: ${ownerName}`,
  sourceAdded: (sourceUrl: string) => `Added source: ${sourceUrl}`,
  sourceRemoved: (sourceUrl: string) => `Removed source: ${sourceUrl}`,
  skillPublished: (title: string) => `Published skill "${title}"`,
  skillArchived: (title: string) => `Archived skill "${title}"`,
  contentRefreshed: (title: string) => `Refreshed content from sources for "${title}"`,
  syncStarted: () => `Started git sync`,
  syncCompleted: (commitSha: string) => `Completed git sync (${commitSha.substring(0, 7)})`,
  syncFailed: (reason: string) => `Git sync failed: ${reason}`,
};
