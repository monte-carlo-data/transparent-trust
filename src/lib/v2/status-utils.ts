/**
 * Shared status utilities for V2 components
 *
 * Centralizes color mappings and styling for confidence levels,
 * review status, and time formatting across pages.
 */

/**
 * Get confidence level styling
 */
export function getConfidenceStyles(confidence?: string): string {
  if (!confidence) return 'bg-gray-100 text-gray-600';
  const lower = confidence.toLowerCase();
  if (lower.includes('high')) return 'bg-green-100 text-green-700';
  if (lower.includes('medium')) return 'bg-yellow-100 text-yellow-700';
  if (lower.includes('low')) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

/**
 * Get review status styling
 */
export function getReviewStatusStyles(status?: string): string {
  if (!status) return 'bg-gray-100 text-gray-700';
  switch (status.toUpperCase()) {
    case 'REQUESTED':
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700';
    case 'APPROVED':
      return 'bg-green-100 text-green-700';
    case 'CORRECTED':
      return 'bg-blue-100 text-blue-700';
    case 'FLAGGED':
      return 'bg-red-100 text-red-700';
    case 'RESOLVED':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get review status label
 */
export function getReviewStatusLabel(status?: string): string {
  if (!status) return '';
  switch (status.toUpperCase()) {
    case 'REQUESTED':
      return 'Need Help';
    case 'PENDING':
      return 'Pending';
    case 'APPROVED':
      return 'Approved';
    case 'CORRECTED':
      return 'Corrected';
    case 'FLAGGED':
      return 'Flagged';
    case 'RESOLVED':
      return 'Resolved';
    default:
      return status;
  }
}

/**
 * Format date as relative time ago
 */
export function formatTimeAgo(dateString?: string | Date): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get project status styling
 */
export function getProjectStatusStyles(status?: string): string {
  if (!status) return 'bg-gray-100 text-gray-800';
  switch (status.toUpperCase()) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    case 'IN_PROGRESS':
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'ARCHIVED':
      return 'bg-yellow-100 text-yellow-800';
    case 'ERROR':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get risk level styling
 */
export function getRiskLevelStyles(risk?: string): string {
  if (!risk) return 'bg-gray-100 text-gray-800';
  switch (risk.toLowerCase()) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get block status styling (DRAFT, ACTIVE)
 */
export function getBlockStatusStyles(status?: string): string {
  if (!status) return 'bg-gray-100 text-gray-700';
  switch (status.toUpperCase()) {
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-700';
    case 'ACTIVE':
      return 'bg-green-100 text-green-700';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
