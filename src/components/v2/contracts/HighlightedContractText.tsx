/**
 * HighlightedContractText Component
 *
 * Displays contract text with clickable highlighted clauses.
 * Clicking a highlight scrolls to the corresponding finding.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ContractFinding, AlignmentRating } from '@/types/contractReview';

export interface HighlightedContractTextProps {
  text: string;
  findings: ContractFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
}

interface TextSegment {
  text: string;
  finding?: ContractFinding;
}

export function HighlightedContractText({
  text,
  findings,
  selectedFindingId,
  onSelectFinding,
}: HighlightedContractTextProps) {
  const segments = useMemo(() => buildHighlightSegments(text, findings), [text, findings]);

  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
      {segments.map((segment, i) => {
        if (segment.finding) {
          const isSelected = selectedFindingId === segment.finding.id;
          return (
            <mark
              key={i}
              id={`clause-${segment.finding.id}`}
              className={cn(
                'cursor-pointer px-1 rounded transition-all',
                isSelected && 'ring-2 ring-primary ring-offset-1',
                getRatingHighlightClass(segment.finding.rating)
              )}
              onClick={() => onSelectFinding(segment.finding!.id)}
            >
              {segment.text}
            </mark>
          );
        }
        return (
          <span key={i} className="text-muted-foreground">
            {segment.text}
          </span>
        );
      })}
    </pre>
  );
}

/**
 * Build text segments with highlight positions
 */
function buildHighlightSegments(text: string, findings: ContractFinding[]): TextSegment[] {
  // Find positions of each clause in the contract text
  const clauseLocations = findings
    .map((finding) => {
      const normalizedClause = finding.clauseText.trim().toLowerCase();
      const normalizedText = text.toLowerCase();
      const index = normalizedText.indexOf(normalizedClause);
      if (index === -1) return null;
      return {
        start: index,
        end: index + finding.clauseText.length,
        finding,
      };
    })
    .filter((loc): loc is NonNullable<typeof loc> => loc !== null)
    .sort((a, b) => a.start - b.start);

  // Build segments, handling overlaps
  const segments: TextSegment[] = [];
  let lastEnd = 0;

  for (const loc of clauseLocations) {
    // Skip overlapping clauses
    if (loc.start < lastEnd) continue;

    // Add plain text before this highlight
    if (loc.start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, loc.start) });
    }

    // Add highlighted segment
    segments.push({
      text: text.slice(loc.start, loc.end),
      finding: loc.finding,
    });

    lastEnd = loc.end;
  }

  // Add trailing plain text
  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd) });
  }

  return segments;
}

/**
 * Get CSS class for rating-based highlighting
 */
function getRatingHighlightClass(rating: AlignmentRating): string {
  const map: Record<AlignmentRating, string> = {
    risk: 'bg-red-200 hover:bg-red-300',
    gap: 'bg-orange-200 hover:bg-orange-300',
    partial: 'bg-yellow-200 hover:bg-yellow-300',
    can_comply: 'bg-green-200 hover:bg-green-300',
    info_only: 'bg-blue-200 hover:bg-blue-300',
  };
  return map[rating] || 'bg-gray-200 hover:bg-gray-300';
}
