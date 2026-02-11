/**
 * FindingsList Component
 *
 * Displays list of contract findings with click-to-scroll behavior.
 */

import { FindingCard } from './FindingCard';
import type { ContractFinding } from '@/types/contractReview';

export interface FindingsListProps {
  findings: ContractFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
}

export function FindingsList({ findings, selectedFindingId, onSelectFinding }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No findings match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {findings.map((finding) => (
        <FindingCard
          key={finding.id}
          finding={finding}
          isSelected={selectedFindingId === finding.id}
          onSelect={() => {
            onSelectFinding(finding.id);
            scrollToClause(finding.id);
          }}
        />
      ))}
    </div>
  );
}

/**
 * Scroll to the highlighted clause in the contract text
 */
function scrollToClause(findingId: string) {
  const clauseEl = document.getElementById(`clause-${findingId}`);
  if (clauseEl) {
    clauseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
