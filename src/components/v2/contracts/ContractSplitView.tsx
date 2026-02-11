/**
 * ContractSplitView Component
 *
 * Split-pane layout for contract analysis:
 * - Left: Contract text with highlighted clauses
 * - Right: Findings list
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HighlightedContractText } from './HighlightedContractText';
import { FindingsList } from './FindingsList';
import type { ContractFinding } from '@/types/contractReview';

export interface ContractSplitViewProps {
  contractText: string;
  findings: ContractFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
}

export function ContractSplitView({
  contractText,
  findings,
  selectedFindingId,
  onSelectFinding,
}: ContractSplitViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: '70vh' }}>
      {/* Left: Contract Text */}
      <Card className="overflow-hidden flex flex-col">
        <CardHeader className="py-3 border-b flex-shrink-0">
          <CardTitle className="text-sm">Contract Text</CardTitle>
        </CardHeader>
        <CardContent className="p-4 overflow-y-auto flex-1">
          <HighlightedContractText
            text={contractText}
            findings={findings}
            selectedFindingId={selectedFindingId}
            onSelectFinding={onSelectFinding}
          />
        </CardContent>
      </Card>

      {/* Right: Findings Panel */}
      <Card className="overflow-hidden flex flex-col">
        <CardHeader className="py-3 border-b flex-shrink-0">
          <CardTitle className="text-sm">
            Findings ({findings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-y-auto flex-1">
          <FindingsList
            findings={findings}
            selectedFindingId={selectedFindingId}
            onSelectFinding={onSelectFinding}
          />
        </CardContent>
      </Card>
    </div>
  );
}
