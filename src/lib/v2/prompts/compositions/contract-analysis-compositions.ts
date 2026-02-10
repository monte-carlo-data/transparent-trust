/**
 * V2 Contract Analysis Compositions
 *
 * Compositions for contract review and analysis.
 */

import type { PromptComposition } from '../types';

export const contractAnalysisComposition: PromptComposition = {
  context: 'contract_analysis' as const,
  name: 'Contract Analysis',
  description: 'Analyze contracts for legal and security risks, obligations, and negotiation points.',
  category: 'contract',
  usedBy: [
    { feature: 'Contract Analysis', location: '/v2/contracts/analyze', type: 'ui' },
    { feature: 'Contract API', location: '/api/v2/contracts/analyze', type: 'api' },
  ],
  blockIds: [
    'contract_analysis_role',
    'contract_analysis_categories',
    'contract_analysis_ratings',
    'contract_analysis_guidelines',
    'contract_analysis_output',
  ],
  outputFormat: 'json',
  outputSchema: `{
  "overallRating": "compliant" | "mostly_compliant" | "needs_review" | "high_risk",
  "summary": "Executive summary of the contract analysis (2-3 paragraphs)",
  "findings": [
    {
      "category": "category_name",
      "clauseText": "The exact or summarized clause text from the contract",
      "rating": "can_comply" | "partial" | "gap" | "risk" | "info_only",
      "rationale": "Why this rating was given, referencing your capabilities",
      "suggestedResponse": "Optional: How to respond or negotiate if needed"
    }
  ]
}`,
};

export const contractAnalysisCompositions: PromptComposition[] = [
  contractAnalysisComposition,
];
