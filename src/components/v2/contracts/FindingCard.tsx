/**
 * FindingCard Component
 *
 * Displays individual contract finding with rating, category, and details.
 */

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Flag, Shield, AlertCircle, XCircle, CheckCircle, Info } from 'lucide-react';
import type { ContractFinding, AlignmentRating, FindingCategory } from '@/types/contractReview';

export interface FindingCardProps {
  finding: ContractFinding;
  isSelected: boolean;
  onSelect: () => void;
}

export function FindingCard({ finding, isSelected, onSelect }: FindingCardProps) {
  const ratingConfig = alignmentConfig[finding.rating];
  const categoryLabel = categoryLabels[finding.category] || finding.category;

  return (
    <div
      className={cn(
        'border rounded-lg p-3 border-l-4 cursor-pointer transition-all text-sm',
        ratingConfig.borderColor,
        isSelected && 'ring-2 ring-primary',
        finding.flaggedForReview && 'bg-amber-50'
      )}
      onClick={onSelect}
    >
      {/* Header: Badges */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-1.5 flex-wrap">
          <Badge className={ratingConfig.className}>
            {ratingConfig.icon}
            {ratingConfig.label}
          </Badge>
          <Badge variant="secondary">{categoryLabel}</Badge>
          {finding.flaggedForReview && (
            <Badge className="bg-amber-100 text-amber-800">
              <Flag size={10} className="mr-1" />
              Flagged
            </Badge>
          )}
          {finding.assignedToSecurity && (
            <Badge className="bg-purple-100 text-purple-800">
              <Shield size={10} className="mr-1" />
              Security
            </Badge>
          )}
        </div>
      </div>

      {/* Clause Text */}
      <div className="text-xs text-muted-foreground mb-2 line-clamp-2 italic">
        &ldquo;{finding.clauseText.slice(0, 200)}
        {finding.clauseText.length > 200 && '...'}&rdquo;
      </div>

      {/* Rationale */}
      <div className="text-xs text-foreground line-clamp-3">{finding.rationale}</div>

      {/* Suggested Response (collapsible) */}
      {finding.suggestedResponse && (
        <details className="mt-2">
          <summary className="bg-blue-50 p-2 rounded text-xs text-blue-800 cursor-pointer hover:bg-blue-100">
            Suggested Response
          </summary>
          <div className="bg-blue-50 px-2 pb-2 text-xs text-blue-800 mt-1">
            {finding.suggestedResponse}
          </div>
        </details>
      )}
    </div>
  );
}

// Rating configuration
const alignmentConfig: Record<
  AlignmentRating,
  { label: string; className: string; borderColor: string; icon: ReactNode }
> = {
  risk: {
    label: 'Risk',
    className: 'bg-red-100 text-red-800 border-red-200',
    borderColor: 'border-l-red-500',
    icon: <AlertCircle size={10} className="mr-1" />,
  },
  gap: {
    label: 'Gap',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    borderColor: 'border-l-orange-500',
    icon: <XCircle size={10} className="mr-1" />,
  },
  partial: {
    label: 'Partial',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    borderColor: 'border-l-yellow-500',
    icon: <Info size={10} className="mr-1" />,
  },
  can_comply: {
    label: 'Can Comply',
    className: 'bg-green-100 text-green-800 border-green-200',
    borderColor: 'border-l-green-500',
    icon: <CheckCircle size={10} className="mr-1" />,
  },
  info_only: {
    label: 'Info Only',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    borderColor: 'border-l-blue-500',
    icon: <Info size={10} className="mr-1" />,
  },
};

// Category labels
const categoryLabels: Record<FindingCategory, string> = {
  // Security
  data_protection: 'Data Protection',
  security_controls: 'Security Controls',
  certifications: 'Certifications',
  incident_response: 'Incident Response',
  vulnerability_management: 'Vulnerability Mgmt',
  access_control: 'Access Control',
  encryption: 'Encryption',
  penetration_testing: 'Penetration Testing',
  // Legal
  liability: 'Liability',
  indemnification: 'Indemnification',
  limitation_of_liability: 'Limitation of Liability',
  insurance: 'Insurance',
  termination: 'Termination',
  intellectual_property: 'Intellectual Property',
  warranties: 'Warranties',
  governing_law: 'Governing Law',
  // Compliance
  audit_rights: 'Audit Rights',
  subprocessors: 'Subprocessors',
  data_retention: 'Data Retention',
  confidentiality: 'Confidentiality',
  regulatory_compliance: 'Regulatory Compliance',
  // General
  sla_performance: 'SLA Performance',
  payment_terms: 'Payment Terms',
  other: 'Other',
};
