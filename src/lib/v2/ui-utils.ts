/**
 * UI Utility Functions
 *
 * Shared utility functions for consistent UI styling across components.
 */

/**
 * Returns Tailwind classes for confidence level styling.
 * Used in skill selection, response cards, and row displays.
 */
export function getConfidenceColor(confidence: string): string {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

/**
 * Returns Tailwind classes for confidence badge styling (alternative colors).
 * Used in response cards for emerald/amber/red scheme.
 */
export function getConfidenceBadgeClasses(confidence: string): string {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'bg-emerald-100 text-emerald-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-red-100 text-red-700';
  }
}
