import { useState, useMemo } from 'react';
import type { ProjectRow } from '../types';

/**
 * Project Filters Hook
 *
 * Manages filter state and provides filtered results with counts.
 * Handles status, confidence, and flagged filters.
 */
export function useProjectFilters(rows: ProjectRow[]) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  // Calculate confidence counts
  const confidenceCounts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const conf = row.confidence?.toLowerCase() || 'unable';
        if (conf === 'high') acc.high++;
        else if (conf === 'medium') acc.medium++;
        else if (conf === 'low') acc.low++;
        else acc.unable++;
        return acc;
      },
      { high: 0, medium: 0, low: 0, unable: 0 }
    );
  }, [rows]);

  // Calculate flagged count
  const flaggedCount = useMemo(() => {
    return rows.filter((r) => r.flaggedForReview).length;
  }, [rows]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && row.status !== 'PENDING') return false;
        if (statusFilter === 'processing' && row.status !== 'PROCESSING') return false;
        if (statusFilter === 'completed' && row.status !== 'COMPLETED') return false;
        if (statusFilter === 'error' && row.status !== 'ERROR') return false;
        if (statusFilter === 'pending-review' && row.reviewStatus !== 'REQUESTED')
          return false;
      }

      // Confidence filter
      if (
        confidenceFilter !== 'all' &&
        row.confidence?.toLowerCase() !== confidenceFilter
      ) {
        return false;
      }

      // Flagged filter
      if (showFlaggedOnly && !row.flaggedForReview) {
        return false;
      }

      return true;
    });
  }, [rows, statusFilter, confidenceFilter, showFlaggedOnly]);

  const clearFilters = () => {
    setStatusFilter('all');
    setConfidenceFilter('all');
    setShowFlaggedOnly(false);
  };

  const hasActiveFilters =
    statusFilter !== 'all' || confidenceFilter !== 'all' || showFlaggedOnly;

  return {
    // Filter state
    statusFilter,
    confidenceFilter,
    showFlaggedOnly,

    // Setters
    setStatusFilter,
    setConfidenceFilter,
    setShowFlaggedOnly,

    // Results
    filteredRows,
    confidenceCounts,
    flaggedCount,
    hasActiveFilters,

    // Actions
    clearFilters,
  };
}
